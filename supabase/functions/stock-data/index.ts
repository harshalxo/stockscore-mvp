// stock-data edge function — Yahoo Finance via yahoo-finance2.
// Frontend never calls Yahoo directly. Response shapes are backward-compatible
// supersets of what the existing UI consumes.
//
// NOTE: yahoo-finance2's built-in crumb fetcher fails from Supabase edge IPs
// (Yahoo returns 200 instead of redirecting to guce.yahoo.com). We pre-warm a
// crumb + cookie pair via fc.yahoo.com and inject it into yahoo-finance2 with
// `setGlobalConfig({ cookieJar, _crumb })` so every call authenticates.
import yahooFinance from 'npm:yahoo-finance2@2.13.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── yahoo-finance2 global config ────────────────────────────────────────
try {
  // @ts-ignore - runtime API
  yahooFinance.suppressNotices?.(['yahooSurvey', 'ripHistorical']);
  // @ts-ignore
  yahooFinance.setGlobalConfig?.({ validation: { logErrors: false, logOptionsErrors: false } });
} catch (_) { /* no-op */ }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── manual crumb (works around yahoo-finance2's broken consent flow) ───
let creds: { crumb: string; cookie: string; ts: number } | null = null;
async function getCreds(): Promise<{ crumb: string; cookie: string }> {
  if (creds && Date.now() - creds.ts < 5 * 60 * 1000) return creds;
  const consent = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  await consent.text();
  const cookie = (consent.headers.get('set-cookie') || '')
    .split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  const r = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
  });
  const crumb = (await r.text()).trim();
  if (!crumb || crumb.includes('Unauthorized') || crumb.length > 32) {
    throw new Error(`Failed to obtain Yahoo crumb (got: ${crumb.slice(0, 60)})`);
  }
  creds = { crumb, cookie, ts: Date.now() };
  return creds;
}

// Low-level authenticated fetch against Yahoo (used as our hybrid client).
async function yf<T = any>(path: string): Promise<T> {
  const { crumb, cookie } = await getCreds();
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://query2.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(crumb)}`;
  let res = await fetch(url, { headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'application/json' } });
  if (res.status === 401 || res.status === 403) {
    creds = null;
    const fresh = await getCreds();
    res = await fetch(`https://query2.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(fresh.crumb)}`,
      { headers: { 'User-Agent': UA, 'Cookie': fresh.cookie, 'Accept': 'application/json' } });
  }
  if (!res.ok) throw new Error(`Yahoo ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); }
  catch (e) { console.warn(`[stock-data] ${label}: ${(e as Error).message}`); return null; }
}

// ── thin wrappers that match yahoo-finance2's response shapes ──────────
const raw = (o: any) => (o && typeof o === 'object' && 'raw' in o ? o.raw : o);
async function quoteSummary(symbol: string, modules: string[]) {
  const data = await yf(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules.join(',')}`);
  return data?.quoteSummary?.result?.[0] ?? {};
}
async function quote(symbol: string) {
  const data = await yf(`/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`);
  return data?.quoteResponse?.result?.[0] ?? null;
}

// ── search (uses yahoo-finance2 directly) ──────────────────────────────
async function handleSearch(query: string) {
  if (!query) return [];
  let quotes: any[] = [];
  try {
    const res = await yahooFinance.search(query, { quotesCount: 12, newsCount: 0 });
    quotes = res.quotes || [];
  } catch (e) {
    console.warn(`[stock-data] yahoo.search fallback: ${(e as Error).message}`);
    const { crumb, cookie } = await getCreds();
    const r = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&crumb=${encodeURIComponent(crumb)}`,
      { headers: { 'User-Agent': UA, 'Cookie': cookie } },
    );
    const j = await r.json();
    quotes = j.quotes || [];
  }
  return quotes
    .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.isYahooFinance))
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange || q.exchDisp || '',
      quoteType: q.quoteType || 'EQUITY',
      market: q.market || '',
      type: 'Equity',
    }));
}

// ── overview ────────────────────────────────────────────────────────────
async function handleOverview(symbol: string) {
  const [q, s] = await Promise.all([
    safe('quote', () => quote(symbol)),
    safe('quoteSummary(overview)', () => quoteSummary(symbol, ['assetProfile', 'price', 'summaryDetail', 'financialData'])),
  ]);
  if (!q && !s) return null;

  const profile: any = s?.assetProfile ?? {};
  const price: any = s?.price ?? {};
  const sd: any = s?.summaryDetail ?? {};
  const fd: any = s?.financialData ?? {};
  const Q: any = q ?? {};

  return {
    symbol,
    name: Q.longName || Q.shortName || price.longName || price.shortName || symbol,
    exchange: Q.fullExchangeName || price.exchangeName || Q.exchange || '',
    market: Q.market || '',
    sector: profile.sector || '',
    industry: profile.industry || '',
    description: profile.longBusinessSummary || '',
    businessSummary: profile.longBusinessSummary || '',
    marketCap: Q.marketCap ?? raw(price.marketCap) ?? 0,
    employees: profile.fullTimeEmployees || 0,
    website: profile.website || '',
    ceo: profile.companyOfficers?.[0]?.name || 'N/A',
    country: profile.country || '',
    currency: Q.currency || price.currency || 'USD',
    currentPrice: Q.regularMarketPrice ?? raw(price.regularMarketPrice) ?? raw(fd.currentPrice) ?? null,
    trailingPE: Q.trailingPE ?? raw(sd.trailingPE) ?? null,
    priceToBook: Q.priceToBook ?? raw(sd.priceToBook) ?? null,
    sharesOutstanding: Q.sharesOutstanding ?? null,
    logo: '',
    fetchedAt: new Date().toISOString(),
  };
}

// ── fundamentals (annual time series via timeseries endpoint) ──────────
const TS_FIELDS = [
  'annualTotalRevenue', 'annualEBIT', 'annualNetIncome',
  'annualTotalAssets', 'annualStockholdersEquity', 'annualTotalDebt',
  'annualCashAndCashEquivalents', 'annualOperatingCashFlow',
  'annualCapitalExpenditure', 'annualFreeCashFlow', 'annualInterestExpense',
];

async function fetchAnnualSeries(symbol: string) {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 5 * 365 * 86400;
  const types = TS_FIELDS.join(',');
  const path = `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${types}&period1=${period1}&period2=${period2}&corsDomain=finance.yahoo.com`;
  const data = await safe('fundamentalsTimeSeries', () => yf(path));
  if (!data?.timeseries?.result) return [];

  const byYear = new Map<number, any>();
  for (const series of data.timeseries.result as any[]) {
    const key = TS_FIELDS.find((f) => series[f]);
    if (!key) continue;
    for (const row of series[key] as any[]) {
      if (!row?.asOfDate) continue;
      const y = new Date(row.asOfDate).getUTCFullYear();
      if (!byYear.has(y)) byYear.set(y, { year: y });
      const entry = byYear.get(y);
      const value = raw(row.reportedValue);
      if (value != null && entry[key] == null) entry[key] = value;
    }
  }

  return Array.from(byYear.values())
    .sort((a, b) => b.year - a.year)
    .slice(0, 3)
    .map((e) => ({
      year: e.year,
      revenue: e.annualTotalRevenue ?? null,
      ebit: e.annualEBIT ?? null,
      netIncome: e.annualNetIncome ?? null,
      totalAssets: e.annualTotalAssets ?? null,
      totalEquity: e.annualStockholdersEquity ?? null,
      totalDebt: e.annualTotalDebt ?? null,
      cashAndEquiv: e.annualCashAndCashEquivalents ?? null,
      operatingCf: e.annualOperatingCashFlow ?? null,
      capex: e.annualCapitalExpenditure ?? null,
      freeCf: e.annualFreeCashFlow
        ?? (e.annualOperatingCashFlow != null && e.annualCapitalExpenditure != null
          ? e.annualOperatingCashFlow + e.annualCapitalExpenditure : null),
      interestExpense: e.annualInterestExpense ?? null,
    }));
}

async function handleFundamentals(symbol: string) {
  const [s, annual] = await Promise.all([
    safe('quoteSummary(fund)', () => quoteSummary(symbol, ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price'])),
    fetchAnnualSeries(symbol),
  ]);

  if (!s && (!annual || !annual.length)) return null;

  const ks: any = s?.defaultKeyStatistics ?? {};
  const fd: any = s?.financialData ?? {};
  const sd: any = s?.summaryDetail ?? {};
  const price: any = s?.price ?? {};
  const latest = annual?.[0] ?? null;

  return {
    symbol,
    peRatio: raw(sd.trailingPE) ?? raw(ks.trailingPE) ?? null,
    pbRatio: raw(ks.priceToBook) ?? raw(sd.priceToBook) ?? null,
    debtToEquity: raw(fd.debtToEquity) != null ? raw(fd.debtToEquity) / 100 : null,
    currentRatio: raw(fd.currentRatio) ?? null,
    roe: raw(fd.returnOnEquity) ?? null,
    revenueGrowth: raw(fd.revenueGrowth) ?? null,
    earningsGrowth: raw(fd.earningsGrowth) ?? null,
    dividendYield: raw(sd.dividendYield) ?? null,
    grossMargin: raw(fd.grossMargins) ?? null,
    operatingMargin: raw(fd.operatingMargins) ?? null,
    netMargin: raw(fd.profitMargins) ?? null,
    freeCashFlow: latest?.freeCf ?? raw(fd.freeCashflow) ?? null,
    revenue: latest?.revenue ?? raw(fd.totalRevenue) ?? null,
    netIncome: latest?.netIncome ?? null,
    totalDebt: latest?.totalDebt ?? raw(fd.totalDebt) ?? null,
    totalCash: latest?.cashAndEquiv ?? raw(fd.totalCash) ?? null,
    beta: raw(ks.beta) ?? null,
    currency: price.currency || sd.currency || 'USD',
    annual,
    fetchedAt: new Date().toISOString(),
  };
}

// ── prices ──────────────────────────────────────────────────────────────
async function handlePrices(symbol: string) {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 365 * 86400;

  const [chart, q, s] = await Promise.all([
    safe('chart', () => yf(`/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`)),
    safe('quote(prices)', () => quote(symbol)),
    safe('quoteSummary(prices)', () => quoteSummary(symbol, ['price', 'summaryDetail'])),
  ]);

  const Q: any = q ?? {};
  const price: any = s?.price ?? {};
  const sd: any = s?.summaryDetail ?? {};
  const r: any = chart?.chart?.result?.[0];
  const quoteArr = r?.indicators?.quote?.[0] ?? {};
  const ts: number[] = r?.timestamp ?? [];

  const history = ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    open: quoteArr.open?.[i] ?? null,
    high: quoteArr.high?.[i] ?? null,
    low: quoteArr.low?.[i] ?? null,
    close: quoteArr.close?.[i] != null ? Math.round(quoteArr.close[i] * 100) / 100 : 0,
    volume: quoteArr.volume?.[i] ?? 0,
  })).filter((p) => p.close > 0);

  const currentPrice = Q.regularMarketPrice ?? raw(price.regularMarketPrice) ?? r?.meta?.regularMarketPrice ?? 0;
  const previousClose = Q.regularMarketPreviousClose ?? raw(price.regularMarketPreviousClose) ?? r?.meta?.chartPreviousClose ?? 0;
  if (!currentPrice && !previousClose && !history.length) return null;

  return {
    symbol,
    currentPrice,
    previousClose,
    change: Math.round((currentPrice - previousClose) * 100) / 100,
    changePercent: previousClose ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100 : 0,
    high52Week: Q.fiftyTwoWeekHigh ?? raw(sd.fiftyTwoWeekHigh) ?? r?.meta?.fiftyTwoWeekHigh ?? 0,
    low52Week: Q.fiftyTwoWeekLow ?? raw(sd.fiftyTwoWeekLow) ?? r?.meta?.fiftyTwoWeekLow ?? 0,
    volume: Q.regularMarketVolume ?? 0,
    avgVolume: Q.averageDailyVolume10Day ?? raw(sd.averageDailyVolume10Day) ?? 0,
    currency: Q.currency || price.currency || r?.meta?.currency || 'USD',
    history,
    fetchedAt: new Date().toISOString(),
  };
}

// ── score ───────────────────────────────────────────────────────────────
function clamp(v: number) { return Math.round(Math.max(0, Math.min(100, v))); }
function avg(vals: (number | null)[]) {
  const valid = vals.filter((v): v is number => v != null && isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 50;
}
function toGrade(s: number) {
  if (s >= 95) return 'A+'; if (s >= 90) return 'A'; if (s >= 85) return 'A-';
  if (s >= 80) return 'B+'; if (s >= 75) return 'B'; if (s >= 70) return 'B-';
  if (s >= 65) return 'C+'; if (s >= 60) return 'C'; if (s >= 55) return 'C-';
  if (s >= 45) return 'D'; return 'F';
}
function fmtPct(v: number | null) { return v != null ? `${Math.round(v * 100)}%` : 'N/A'; }

// ── Phase 1 transparent scoring ────────────────────────────────────────
// Pillars: Quality 0.30, Growth 0.20, Cash Flow 0.20, Risk 0.15, Valuation 0.15.
// Each metric is bucketed into a 0-100 score with an explicit formula. Missing
// metrics are dropped and the remaining metric weights are renormalized; the
// same renormalization applies across pillars. Confidence is MEDIUM with a full
// 3-year history, otherwise LOW (HIGH is reserved for post-Phase-1 data depth).
type Bin = { min: number; score: number };
// bins are sorted descending by `min`; pick the first whose threshold the value meets.
function binScore(value: number | null, bins: Bin[]): number | null {
  if (value == null || !isFinite(value)) return null;
  for (const b of bins) if (value >= b.min) return b.score;
  return 0;
}
function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !isFinite(a) || !isFinite(b) || b === 0) return null;
  return a / b;
}
function cagr(latest: number | null, oldest: number | null, years: number): number | null {
  if (latest == null || oldest == null || years <= 0) return null;
  if (oldest <= 0 || latest <= 0) return null; // sign flips make CAGR meaningless
  return Math.pow(latest / oldest, 1 / years) - 1;
}

type MetricEntry = {
  pillar: string;
  metric: string;
  rawValue: number | null;
  score: number | null;
  weight: number;
  formula: string;
  explanation: string;
};

function weightedPillar(entries: MetricEntry[]): number | null {
  const scored = entries.filter((e) => e.score != null);
  if (!scored.length) return null;
  const totalW = scored.reduce((s, e) => s + e.weight, 0) || 1;
  return scored.reduce((s, e) => s + (e.score as number) * (e.weight / totalW), 0);
}

// ── Phase 1 data validation layer ──────────────────────────────────────
// Validates Yahoo fundamentals before scoring/DCF. Flags missing, suspicious,
// and impossible values. Returns a structured DataHealth object the UI shows.
type DataHealth = {
  completenessScore: number;
  missingFields: string[];
  warnings: string[];
  coverageLevel: 'Complete' | 'Partial' | 'Limited';
  qualityLabel: 'High' | 'Medium' | 'Low';
  yearsAvailable: number;
};

function computeDataHealth(fund: any, annual: any[], sector?: string): DataHealth {
  const missing: string[] = [];
  const warnings: string[] = [];

  const reqFund: [string, any][] = [
    ['peRatio', fund?.peRatio], ['pbRatio', fund?.pbRatio],
    ['roe', fund?.roe], ['debtToEquity', fund?.debtToEquity],
    ['currentRatio', fund?.currentRatio], ['grossMargin', fund?.grossMargin],
    ['operatingMargin', fund?.operatingMargin], ['netMargin', fund?.netMargin],
    ['freeCashFlow', fund?.freeCashFlow], ['revenue', fund?.revenue],
    ['netIncome', fund?.netIncome], ['totalDebt', fund?.totalDebt],
  ];
  for (const [k, v] of reqFund) if (v == null) missing.push(k);

  const latest = annual?.[0] ?? {};
  const reqAnnual: [string, any][] = [
    ['annual.revenue', latest.revenue], ['annual.ebit', latest.ebit],
    ['annual.netIncome', latest.netIncome], ['annual.totalAssets', latest.totalAssets],
    ['annual.totalEquity', latest.totalEquity], ['annual.totalDebt', latest.totalDebt],
    ['annual.operatingCf', latest.operatingCf], ['annual.freeCf', latest.freeCf],
  ];
  for (const [k, v] of reqAnnual) if (v == null) missing.push(k);

  if (latest.revenue != null && latest.revenue < 0) warnings.push('Revenue is negative — impossible for a normal operating company.');
  if (latest.totalAssets != null && latest.totalAssets <= 0) warnings.push('Total Assets ≤ 0 — impossible value.');
  if (latest.totalEquity != null && latest.totalEquity === 0) warnings.push('Total Equity is exactly 0 — ROE and D/E cannot be computed.');
  if (latest.totalEquity != null && latest.totalEquity < 0) warnings.push('Total Equity is negative — book-value metrics are unreliable.');
  const isFinancial = /financial|bank|insurance/i.test(sector || '');
  if (!isFinancial && latest.interestExpense != null && latest.interestExpense === 0 && (latest.totalDebt ?? 0) > 0) {
    warnings.push('Interest Expense reported as 0 despite debt outstanding — interest coverage may be misleading.');
  }
  if ((annual?.length ?? 0) < 2) warnings.push('Fewer than 2 years of fundamentals — CAGR cannot be computed.');
  if (fund?.peRatio != null && fund.peRatio < 0) warnings.push('P/E is negative — company is unprofitable on a trailing basis.');

  const totalRequired = reqFund.length + reqAnnual.length;
  const present = totalRequired - missing.length;
  const completenessScore = Math.round((present / totalRequired) * 100);

  const yearsAvailable = annual?.length ?? 0;
  let coverageLevel: DataHealth['coverageLevel'] = 'Complete';
  if (completenessScore < 60 || yearsAvailable < 2) coverageLevel = 'Limited';
  else if (completenessScore < 85 || missing.length > 0 || warnings.length > 0) coverageLevel = 'Partial';

  let qualityLabel: DataHealth['qualityLabel'] = 'High';
  if (coverageLevel === 'Limited') qualityLabel = 'Low';
  else if (coverageLevel === 'Partial') qualityLabel = 'Medium';

  return { completenessScore, missingFields: missing, warnings, coverageLevel, qualityLabel, yearsAvailable };
}

async function handleScore(symbol: string) {
  const [fund, s, q] = await Promise.all([
    handleFundamentals(symbol).catch(() => null),
    safe('quoteSummary(score)', () => quoteSummary(symbol, ['price', 'summaryDetail', 'assetProfile'])),
    safe('quote(score)', () => quote(symbol)),
  ]);

  const price: any = s?.price ?? {};
  const profile: any = s?.assetProfile ?? {};
  const Q: any = q ?? {};
  const f: any = fund || {};
  const annual: any[] = Array.isArray(f.annual) ? f.annual : [];
  const shortName = Q.longName || Q.shortName || price.shortName || symbol;
  const currency = Q.currency || price.currency || f.currency || 'USD';

  const dataHealth = computeDataHealth(f, annual, profile.sector);
  console.log(`[stock-data] score ${symbol} dataHealth: ${dataHealth.coverageLevel} completeness=${dataHealth.completenessScore} missing=${dataHealth.missingFields.length} warnings=${dataHealth.warnings.length}`);

  const latest = annual[0] ?? {};
  const oldest = annual[annual.length - 1] ?? {};
  const yearSpan = Math.max(annual.length - 1, 0);

  // ── raw metrics ──
  const roce = safeDiv(latest.ebit, ((latest.totalEquity ?? 0) + (latest.totalDebt ?? 0) - (latest.cashAndEquiv ?? 0)) || null);
  const roe = safeDiv(latest.netIncome, latest.totalEquity) ?? f.roe ?? null;
  const roa = safeDiv(latest.netIncome, latest.totalAssets);
  const ebitMargin = safeDiv(latest.ebit, latest.revenue);
  const revCagr = cagr(latest.revenue, oldest.revenue, yearSpan);
  const niCagr = cagr(latest.netIncome, oldest.netIncome, yearSpan);
  const fcfMargin = safeDiv(latest.freeCf, latest.revenue);
  const ocfNi = safeDiv(latest.operatingCf, latest.netIncome);
  const de = safeDiv(latest.totalDebt, latest.totalEquity) ?? f.debtToEquity ?? null;
  const intCov = safeDiv(latest.ebit, latest.interestExpense != null ? Math.abs(latest.interestExpense) : null);
  const pe = f.peRatio ?? null;
  const pb = f.pbRatio ?? null;

  // ── transparent bins (each row: "value ≥ min → score") ──
  const pctBins = (a: number, b: number, c: number, d: number): Bin[] => [
    { min: a, score: 100 }, { min: b, score: 80 }, { min: c, score: 60 }, { min: d, score: 40 }, { min: -Infinity, score: 20 },
  ];

  const entries: MetricEntry[] = [
    { pillar: 'Quality', metric: 'ROCE', rawValue: roce, weight: 0.30,
      score: binScore(roce, pctBins(0.20, 0.15, 0.10, 0.05)),
      formula: 'EBIT / (Equity + Debt − Cash)',
      explanation: '≥20% → 100, ≥15% → 80, ≥10% → 60, ≥5% → 40, else 20.' },
    { pillar: 'Quality', metric: 'ROE', rawValue: roe, weight: 0.30,
      score: binScore(roe, pctBins(0.20, 0.15, 0.10, 0.05)),
      formula: 'Net Income / Total Equity',
      explanation: '≥20% → 100, ≥15% → 80, ≥10% → 60, ≥5% → 40, else 20.' },
    { pillar: 'Quality', metric: 'ROA', rawValue: roa, weight: 0.20,
      score: binScore(roa, pctBins(0.10, 0.07, 0.04, 0.02)),
      formula: 'Net Income / Total Assets',
      explanation: '≥10% → 100, ≥7% → 80, ≥4% → 60, ≥2% → 40, else 20.' },
    { pillar: 'Quality', metric: 'EBIT Margin', rawValue: ebitMargin, weight: 0.20,
      score: binScore(ebitMargin, pctBins(0.25, 0.18, 0.12, 0.06)),
      formula: 'EBIT / Revenue',
      explanation: '≥25% → 100, ≥18% → 80, ≥12% → 60, ≥6% → 40, else 20.' },

    { pillar: 'Growth', metric: 'Revenue CAGR', rawValue: revCagr, weight: 0.50,
      score: binScore(revCagr, pctBins(0.20, 0.12, 0.06, 0.02)),
      formula: `(Latest Revenue / Oldest Revenue)^(1/${yearSpan || 'n'}) − 1`,
      explanation: '≥20% → 100, ≥12% → 80, ≥6% → 60, ≥2% → 40, else 20.' },
    { pillar: 'Growth', metric: 'Net Income CAGR', rawValue: niCagr, weight: 0.50,
      score: binScore(niCagr, pctBins(0.20, 0.12, 0.06, 0.02)),
      formula: `(Latest Net Income / Oldest Net Income)^(1/${yearSpan || 'n'}) − 1`,
      explanation: '≥20% → 100, ≥12% → 80, ≥6% → 60, ≥2% → 40, else 20.' },

    { pillar: 'Cash Flow', metric: 'FCF Margin', rawValue: fcfMargin, weight: 0.50,
      score: binScore(fcfMargin, pctBins(0.15, 0.10, 0.05, 0.00)),
      formula: 'Free Cash Flow / Revenue',
      explanation: '≥15% → 100, ≥10% → 80, ≥5% → 60, ≥0% → 40, else 20.' },
    { pillar: 'Cash Flow', metric: 'OCF / Net Income', rawValue: ocfNi, weight: 0.50,
      score: binScore(ocfNi, pctBins(1.2, 1.0, 0.8, 0.5)),
      formula: 'Operating Cash Flow / Net Income',
      explanation: '≥1.2 → 100, ≥1.0 → 80, ≥0.8 → 60, ≥0.5 → 40, else 20.' },

    { pillar: 'Risk', metric: 'Debt / Equity', rawValue: de, weight: 0.50,
      // lower is better → invert by negating value against descending thresholds
      score: de == null ? null : binScore(-de, [
        { min: -0.3, score: 100 }, { min: -0.6, score: 80 }, { min: -1.0, score: 60 }, { min: -2.0, score: 40 }, { min: -Infinity, score: 20 },
      ]),
      formula: 'Total Debt / Total Equity',
      explanation: '≤0.3 → 100, ≤0.6 → 80, ≤1.0 → 60, ≤2.0 → 40, else 20.' },
    { pillar: 'Risk', metric: 'Interest Coverage', rawValue: intCov, weight: 0.50,
      score: binScore(intCov, [
        { min: 15, score: 100 }, { min: 8, score: 80 }, { min: 4, score: 60 }, { min: 2, score: 40 }, { min: -Infinity, score: 20 },
      ]),
      formula: 'EBIT / Interest Expense',
      explanation: '≥15× → 100, ≥8× → 80, ≥4× → 60, ≥2× → 40, else 20.' },

    { pillar: 'Valuation', metric: 'P/E', rawValue: pe, weight: 0.50,
      score: pe == null || pe <= 0 ? null : binScore(-pe, [
        { min: -10, score: 100 }, { min: -18, score: 80 }, { min: -25, score: 60 }, { min: -40, score: 40 }, { min: -Infinity, score: 20 },
      ]),
      formula: 'trailingPE',
      explanation: '≤10 → 100, ≤18 → 80, ≤25 → 60, ≤40 → 40, else 20. Non-positive P/E ignored.' },
    { pillar: 'Valuation', metric: 'P/B', rawValue: pb, weight: 0.50,
      score: pb == null || pb <= 0 ? null : binScore(-pb, [
        { min: -1, score: 100 }, { min: -2, score: 80 }, { min: -4, score: 60 }, { min: -6, score: 40 }, { min: -Infinity, score: 20 },
      ]),
      formula: 'priceToBook',
      explanation: '≤1 → 100, ≤2 → 80, ≤4 → 60, ≤6 → 40, else 20. Non-positive P/B ignored.' },
  ];

  const pillarMeta: Record<string, { weight: number }> = {
    Quality:     { weight: 0.30 },
    Growth:      { weight: 0.20 },
    'Cash Flow': { weight: 0.20 },
    Risk:        { weight: 0.15 },
    Valuation:   { weight: 0.15 },
  };

  // ── penalties (Phase 1 explicit rules) ──
  const penalties: { code: string; points: number; reason: string }[] = [];
  const ocfs = annual.map((y) => y.operatingCf).filter((v) => v != null);
  const nis = annual.map((y) => y.netIncome).filter((v) => v != null);
  if (annual.length >= 3 && ocfs.length === annual.length && nis.length === annual.length
      && annual.every((y) => y.operatingCf < y.netIncome)) {
    penalties.push({ code: 'OCF_LT_NI_3Y', points: 10, reason: 'Operating cash flow below net income in every available year.' });
  }
  const debts = annual.map((y) => y.totalDebt).filter((v) => v != null);
  const covs = annual.map((y) => safeDiv(y.ebit, y.interestExpense != null ? Math.abs(y.interestExpense) : null)).filter((v) => v != null) as number[];
  const debtIncreasing = debts.length >= 2 && debts[0]! > debts[debts.length - 1]!;
  const coverageFalling = covs.length >= 2 && covs[0]! < covs[covs.length - 1]!;
  if (debtIncreasing && coverageFalling) {
    penalties.push({ code: 'DEBT_UP_COV_DOWN', points: 10, reason: 'Debt rising while interest coverage deteriorates.' });
  }
  const fcfs = annual.map((y) => y.freeCf).filter((v) => v != null);
  const capCashFlow = annual.length >= 1 && fcfs.length === annual.length && annual.every((y) => y.freeCf < 0);
  if (capCashFlow) {
    penalties.push({ code: 'FCF_NEG_ALL', points: 0, reason: 'Free cash flow negative in every available year — Cash Flow pillar capped at 40.' });
  }

  // ── compute pillar scores with renormalization, then overall ──
  const pillars = Object.entries(pillarMeta).map(([name, meta]) => {
    let score = weightedPillar(entries.filter((e) => e.pillar === name));
    if (name === 'Cash Flow' && capCashFlow && score != null) score = Math.min(score, 40);
    const detailParts = entries.filter((e) => e.pillar === name)
      .map((e) => `${e.metric}: ${e.rawValue == null ? 'N/A' : (Math.abs(e.rawValue) < 10 ? e.rawValue.toFixed(2) : e.rawValue.toFixed(1))}${e.score == null ? '' : ` → ${e.score}`}`);
    return {
      name,
      score: score == null ? null : Math.round(score),
      weight: meta.weight,
      grade: score == null ? 'N/A' : toGrade(score),
      details: detailParts.join(' · ') || 'No metrics available.',
    };
  });

  const available = pillars.filter((p) => p.score != null);
  const totalW = available.reduce((s, p) => s + p.weight, 0) || 1;
  const weighted = available.reduce((s, p) => s + (p.score as number) * (p.weight / totalW), 0);
  const penaltyPoints = penalties.reduce((s, p) => s + p.points, 0);
  const overall = available.length ? clamp(weighted - penaltyPoints) : 0;

  const yearsUsed = annual.map((a: any) => a.year);
  const confidence: 'high' | 'medium' | 'low' = annual.length >= 3 ? 'medium' : 'low';

  // UI-facing pillars must always render — fill missing with score 0 + N/A grade.
  const pillarsForUi = pillars.map((p) => ({
    ...p,
    score: p.score ?? 0,
  }));

  return {
    symbol,
    overallScore: overall,
    grade: toGrade(overall),
    confidence,
    pillars: pillarsForUi,
    pillarScores: pillars.reduce((acc: any, p) => { acc[p.name] = p.score; return acc; }, {}),
    metricBreakdown: entries,
    penalties,
    yearsUsed,
    currency,
    summary: `${shortName} scores ${overall}/100 (${toGrade(overall)}) using ${annual.length}-year fundamentals (${confidence} confidence).`,
    lastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
}

// ── DCF Lite (Phase 1 Basic Fair Value Estimate) ────────────────────────
// NOT an institutional DCF. Educational, transparent, assumption-driven.
type DcfAssumptions = {
  forecastYears: number;
  fcfGrowthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  safetyMargin: number;
};
const DEFAULT_DCF: DcfAssumptions = {
  forecastYears: 5,
  fcfGrowthRate: 0.06,
  discountRate: 0.10,
  terminalGrowthRate: 0.025,
  safetyMargin: 0.15,
};

function num(v: any): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) ? n : null;
}

async function handleDcf(symbol: string, paramsIn: any) {
  const a: DcfAssumptions = {
    forecastYears: Math.max(1, Math.min(10, num(paramsIn.forecastYears) ?? DEFAULT_DCF.forecastYears)),
    fcfGrowthRate: num(paramsIn.fcfGrowthRate) ?? DEFAULT_DCF.fcfGrowthRate,
    discountRate: num(paramsIn.discountRate) ?? DEFAULT_DCF.discountRate,
    terminalGrowthRate: num(paramsIn.terminalGrowthRate) ?? DEFAULT_DCF.terminalGrowthRate,
    safetyMargin: num(paramsIn.safetyMargin) ?? DEFAULT_DCF.safetyMargin,
  };

  const warnings: string[] = [];
  const fetchedAt = new Date().toISOString();

  if (a.discountRate <= a.terminalGrowthRate) {
    return {
      symbol, assumptions: a, warnings,
      error: 'Validation error: discountRate must be greater than terminalGrowthRate.',
      fetchedAt,
    };
  }

  const [overview, fund] = await Promise.all([
    handleOverview(symbol).catch(() => null),
    handleFundamentals(symbol).catch(() => null),
  ]);

  if (!overview && !fund) {
    return { symbol, assumptions: a, warnings: ['No data available from Yahoo Finance for this symbol.'], error: 'No data available.', fetchedAt };
  }

  const currency = overview?.currency || fund?.currency || 'USD';
  const currentPrice: number | null = num(overview?.currentPrice);
  const sharesOutstanding: number | null = num(overview?.sharesOutstanding);

  // Base FCF: prefer fundamentals.freeCashFlow, else latest annual FCF, else OCF - |Capex|
  const annual = Array.isArray((fund as any)?.annual) ? (fund as any).annual : [];
  const latest = annual[0] ?? {};
  let baseFcf: number | null = num(fund?.freeCashFlow) ?? num(latest.freeCf);
  let baseFcfSource = baseFcf != null ? (num(fund?.freeCashFlow) != null ? 'fundamentals.freeCashFlow' : 'latest annual freeCashFlow') : null;
  if (baseFcf == null) {
    const ocf = num(latest.operatingCf);
    const capex = num(latest.capex);
    if (ocf != null && capex != null) {
      // capex is reported negative on Yahoo; OCF - |capex| is safe either way
      baseFcf = ocf - Math.abs(capex);
      baseFcfSource = 'Operating Cash Flow − |Capex|';
    }
  }

  if (baseFcf == null) warnings.push('Free Cash Flow could not be determined from available data.');
  if (sharesOutstanding == null) warnings.push('Shares outstanding unavailable — per-share intrinsic value cannot be computed.');
  if (currentPrice == null) warnings.push('Current price unavailable — upside/downside cannot be computed.');
  if (baseFcf != null && baseFcf < 0) warnings.push('Base Free Cash Flow is negative. A DCF on negative FCF produces a misleading valuation; treat results as not meaningful.');

  // Always project the schedule (even with negative/null FCF) so the UI can render the table,
  // but mark intrinsicValuePerShare as null when inputs are unsafe.
  const projectedFcfs: { year: number; fcf: number | null; discounted: number | null }[] = [];
  let pvFcfSum = 0;
  let lastProjected: number | null = null;
  for (let t = 1; t <= a.forecastYears; t++) {
    const proj = baseFcf == null ? null : baseFcf * Math.pow(1 + a.fcfGrowthRate, t);
    const disc = proj == null ? null : proj / Math.pow(1 + a.discountRate, t);
    if (disc != null) pvFcfSum += disc;
    if (proj != null) lastProjected = proj;
    projectedFcfs.push({ year: t, fcf: proj, discounted: disc });
  }

  const terminalValue = lastProjected == null
    ? null
    : (lastProjected * (1 + a.terminalGrowthRate)) / (a.discountRate - a.terminalGrowthRate);
  const pvTerminalValue = terminalValue == null
    ? null
    : terminalValue / Math.pow(1 + a.discountRate, a.forecastYears);

  const enterpriseValue = (lastProjected != null && pvTerminalValue != null) ? pvFcfSum + pvTerminalValue : null;

  const valuationSafe = baseFcf != null && baseFcf > 0 && sharesOutstanding != null && sharesOutstanding > 0 && enterpriseValue != null;
  const intrinsicValuePerShare = valuationSafe ? (enterpriseValue as number) / (sharesOutstanding as number) : null;
  const upsideDownsidePct = (intrinsicValuePerShare != null && currentPrice != null && currentPrice > 0)
    ? (intrinsicValuePerShare - currentPrice) / currentPrice
    : null;

  const fairValueRange = intrinsicValuePerShare == null ? null : {
    downside: intrinsicValuePerShare * (1 - a.safetyMargin),
    upside: intrinsicValuePerShare * (1 + a.safetyMargin),
  };

  let interpretation = 'Insufficient data to estimate fair value.';
  if (intrinsicValuePerShare != null && currentPrice != null && fairValueRange) {
    if (currentPrice < fairValueRange.downside) interpretation = 'Appears below estimated fair value range. Valuation depends heavily on assumptions.';
    else if (currentPrice > fairValueRange.upside) interpretation = 'Appears above estimated fair value range. Valuation depends heavily on assumptions.';
    else interpretation = 'Appears within the estimated fair value range. Valuation depends heavily on assumptions.';
  }

  return {
    symbol,
    currency,
    baseFcf,
    baseFcfSource,
    assumptions: a,
    projectedFcfs,
    discountedFcfs: projectedFcfs.map((p) => ({ year: p.year, value: p.discounted })),
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    sharesOutstanding,
    intrinsicValuePerShare,
    currentPrice,
    upsideDownsidePct,
    fairValueRange,
    interpretation,
    warnings,
    fetchedAt,
  };
}

// ── server ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { action, ...params } = await req.json();
    const symbol = String(params.symbol || '').trim().toUpperCase();
    const query = String(params.query || '').trim();

    let result: unknown;
    switch (action) {
      case 'search': result = await handleSearch(query); break;
      case 'overview': result = await handleOverview(symbol); break;
      case 'fundamentals': result = await handleFundamentals(symbol); break;
      case 'prices': result = await handlePrices(symbol); break;
      case 'score': result = await handleScore(symbol); break;
      case 'dcf': result = await handleDcf(symbol, params); break;
      default: return json({ error: 'Unknown action', action }, 400);
    }
    if (result === null) return json({ error: 'No data available for symbol', symbol, action }, 404);
    return json(result);
  } catch (err) {
    const message = (err as Error).message || 'Unknown error';
    console.error('[stock-data] fatal:', message);
    return json({ error: message, ok: false }, 500);
  }
});
