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

async function handleScore(symbol: string) {
  const [fund, s, q] = await Promise.all([
    handleFundamentals(symbol).catch(() => null),
    safe('quoteSummary(score)', () => quoteSummary(symbol, ['price', 'summaryDetail'])),
    safe('quote(score)', () => quote(symbol)),
  ]);

  const price: any = s?.price ?? {};
  const sd: any = s?.summaryDetail ?? {};
  const Q: any = q ?? {};
  const f: any = fund || {};

  const currentPrice = Q.regularMarketPrice ?? raw(price.regularMarketPrice) ?? 0;
  const high52 = Q.fiftyTwoWeekHigh ?? raw(sd.fiftyTwoWeekHigh) ?? currentPrice;
  const low52 = Q.fiftyTwoWeekLow ?? raw(sd.fiftyTwoWeekLow) ?? currentPrice;
  const shortName = Q.longName || Q.shortName || price.shortName || symbol;
  const currency = Q.currency || price.currency || f.currency || 'USD';

  const m = {
    grossMargin: f.grossMargin != null ? f.grossMargin * 120 : null,
    operatingMargin: f.operatingMargin != null ? f.operatingMargin * 200 : null,
    netMargin: f.netMargin != null ? f.netMargin * 250 : null,
    roe: f.roe != null ? Math.min(f.roe * 200, 100) : null,
    revenueGrowth: f.revenueGrowth != null ? 50 + f.revenueGrowth * 200 : null,
    earningsGrowth: f.earningsGrowth != null ? 50 + f.earningsGrowth * 150 : null,
    currentRatio: f.currentRatio != null ? Math.min(f.currentRatio * 40, 100) : null,
    debtToEquity: f.debtToEquity != null ? Math.max(100 - f.debtToEquity * 30, 0) : null,
    cashCoverage: f.totalCash != null && f.totalDebt != null && f.totalDebt > 0
      ? Math.min((f.totalCash / f.totalDebt) * 60, 100) : null,
    pe: f.peRatio != null ? Math.max(100 - (f.peRatio - 15) * 2, 0) : null,
    pb: f.pbRatio != null ? Math.max(100 - (f.pbRatio - 3) * 8, 0) : null,
  };

  const profit = clamp(avg([m.grossMargin, m.operatingMargin, m.netMargin, m.roe]));
  const growth = clamp(avg([m.revenueGrowth, m.earningsGrowth]));
  const health = clamp(avg([m.currentRatio, m.debtToEquity, m.cashCoverage]));
  const val = clamp(avg([m.pe, m.pb]));
  const range = (high52 - low52) || 1;
  const mom = currentPrice > 0 ? clamp(((currentPrice - low52) / range) * 100) : 50;

  const penalties: { reason: string; points: number }[] = [];
  if (f.netMargin != null && f.netMargin < 0) penalties.push({ reason: 'Negative net margin', points: 5 });
  if (f.debtToEquity != null && f.debtToEquity > 2) penalties.push({ reason: 'High leverage (D/E > 2)', points: 5 });
  if (f.currentRatio != null && f.currentRatio < 1) penalties.push({ reason: 'Current ratio < 1', points: 3 });

  const pillars = [
    { name: 'Profitability', score: profit, weight: 0.25, grade: toGrade(profit),
      details: `Gross ${fmtPct(f.grossMargin)}, op ${fmtPct(f.operatingMargin)}, net ${fmtPct(f.netMargin)}, ROE ${fmtPct(f.roe)}.` },
    { name: 'Growth', score: growth, weight: 0.20, grade: toGrade(growth),
      details: `Revenue growth ${fmtPct(f.revenueGrowth)}, earnings growth ${fmtPct(f.earningsGrowth)}.` },
    { name: 'Financial Health', score: health, weight: 0.20, grade: toGrade(health),
      details: `Current ratio ${f.currentRatio?.toFixed?.(2) ?? 'N/A'}, D/E ${f.debtToEquity?.toFixed?.(2) ?? 'N/A'}.` },
    { name: 'Valuation', score: val, weight: 0.20, grade: toGrade(val),
      details: `P/E ${f.peRatio?.toFixed?.(1) ?? 'N/A'}, P/B ${f.pbRatio?.toFixed?.(1) ?? 'N/A'}.` },
    { name: 'Momentum', score: mom, weight: 0.15, grade: toGrade(mom),
      details: currentPrice > 0 ? `Trading at ${Math.round(((currentPrice - low52) / range) * 100)}% of 52-week range.` : 'Insufficient price data.' },
  ];

  const weighted = pillars.reduce((s, p) => s + p.score * p.weight, 0);
  const penaltyTotal = penalties.reduce((s, p) => s + p.points, 0);
  const overall = clamp(weighted - penaltyTotal);

  const available = [f.peRatio, f.roe, f.revenueGrowth, f.grossMargin].filter((v) => v != null).length;
  const confidence = available >= 3 ? 'high' : f.peRatio != null ? 'medium' : 'low';
  const yearsUsed = Array.isArray(f.annual) ? f.annual.map((a: any) => a.year) : [];

  return {
    symbol,
    overallScore: overall,
    grade: toGrade(overall),
    confidence,
    pillars,
    pillarScores: pillars.reduce((acc: any, p) => { acc[p.name] = p.score; return acc; }, {}),
    metricBreakdown: m,
    penalties,
    yearsUsed,
    currency,
    summary: `${shortName} scores ${overall}/100 (${toGrade(overall)}) from live fundamentals.`,
    lastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
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
