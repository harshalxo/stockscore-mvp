// stock-data edge function — real Yahoo Finance data via yahoo-finance2
// Frontend never calls Yahoo directly. All response shapes are backward-compatible
// supersets of what the UI already consumes.
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

// Silence yahoo-finance2 survey/notice noise and schema-validation warnings.
try {
  // @ts-ignore - runtime API exists
  yahooFinance.suppressNotices?.(['yahooSurvey', 'ripHistorical']);
  // @ts-ignore
  yahooFinance.setGlobalConfig?.({ validation: { logErrors: false, logOptionsErrors: false } });
} catch (_) { /* no-op */ }

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[stock-data] ${label} failed: ${(e as Error).message}`);
    return null;
  }
}

// ── search ──────────────────────────────────────────────────────────────
async function handleSearch(query: string) {
  if (!query) return [];
  const res = await yahooFinance.search(query, { quotesCount: 12, newsCount: 0 });
  return (res.quotes || [])
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
  const [quote, summary] = await Promise.all([
    safe('quote', () => yahooFinance.quote(symbol)),
    safe('quoteSummary(overview)', () =>
      yahooFinance.quoteSummary(symbol, {
        modules: ['assetProfile', 'price', 'summaryDetail', 'financialData'],
      })
    ),
  ]);

  if (!quote && !summary) return null;

  const profile: any = summary?.assetProfile ?? {};
  const price: any = summary?.price ?? {};
  const sd: any = summary?.summaryDetail ?? {};
  const fd: any = summary?.financialData ?? {};
  const q: any = quote ?? {};

  return {
    symbol,
    name: q.longName || q.shortName || price.longName || price.shortName || symbol,
    exchange: q.fullExchangeName || price.exchangeName || q.exchange || '',
    market: q.market || '',
    sector: profile.sector || '',
    industry: profile.industry || '',
    description: profile.longBusinessSummary || '',
    businessSummary: profile.longBusinessSummary || '',
    marketCap: q.marketCap ?? price.marketCap ?? 0,
    employees: profile.fullTimeEmployees || 0,
    website: profile.website || '',
    ceo: profile.companyOfficers?.[0]?.name || 'N/A',
    country: profile.country || '',
    currency: q.currency || price.currency || 'USD',
    currentPrice: q.regularMarketPrice ?? price.regularMarketPrice ?? fd.currentPrice ?? null,
    trailingPE: q.trailingPE ?? sd.trailingPE ?? null,
    priceToBook: q.priceToBook ?? sd.priceToBook ?? null,
    sharesOutstanding: q.sharesOutstanding ?? null,
    logo: '',
    fetchedAt: new Date().toISOString(),
  };
}

// ── fundamentals (real time-series) ─────────────────────────────────────
const TS_KEYS = [
  'annualTotalRevenue',
  'annualEBIT',
  'annualNetIncome',
  'annualTotalAssets',
  'annualStockholdersEquity',
  'annualTotalDebt',
  'annualCashAndCashEquivalents',
  'annualOperatingCashFlow',
  'annualCapitalExpenditure',
  'annualFreeCashFlow',
  'annualInterestExpense',
];

function pickYear(d: Date | string): number {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.getUTCFullYear();
}

async function fetchAnnualSeries(symbol: string) {
  const period2 = new Date();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 5);
  const rows = await safe('fundamentalsTimeSeries', () =>
    // @ts-ignore - module exists at runtime
    yahooFinance.fundamentalsTimeSeries(symbol, {
      period1,
      period2,
      type: 'annual',
      module: 'all',
    })
  );
  if (!Array.isArray(rows) || !rows.length) return [];

  // Group by year, then map to normalized shape
  const byYear = new Map<number, any>();
  for (const row of rows as any[]) {
    const y = pickYear(row.date);
    if (!byYear.has(y)) byYear.set(y, { year: y });
    const entry = byYear.get(y);
    for (const k of TS_KEYS) {
      if (row[k] != null && entry[k] == null) entry[k] = row[k];
    }
  }

  const years = Array.from(byYear.values())
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
      freeCf:
        e.annualFreeCashFlow ??
        (e.annualOperatingCashFlow != null && e.annualCapitalExpenditure != null
          ? e.annualOperatingCashFlow + e.annualCapitalExpenditure // capex is negative
          : null),
      interestExpense: e.annualInterestExpense ?? null,
    }));

  return years;
}

async function handleFundamentals(symbol: string) {
  const [summary, annual] = await Promise.all([
    safe('quoteSummary(fund)', () =>
      yahooFinance.quoteSummary(symbol, {
        modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price'],
      })
    ),
    fetchAnnualSeries(symbol),
  ]);

  const ks: any = summary?.defaultKeyStatistics ?? {};
  const fd: any = summary?.financialData ?? {};
  const sd: any = summary?.summaryDetail ?? {};
  const price: any = summary?.price ?? {};

  if (!summary && (!annual || !annual.length)) return null;

  const latest = annual?.[0] ?? null;

  return {
    symbol,
    // Legacy flat fields the UI already renders ──────────────────────────
    peRatio: sd.trailingPE ?? ks.trailingPE ?? null,
    pbRatio: ks.priceToBook ?? sd.priceToBook ?? null,
    debtToEquity: fd.debtToEquity != null ? fd.debtToEquity / 100 : null,
    currentRatio: fd.currentRatio ?? null,
    roe: fd.returnOnEquity ?? null,
    revenueGrowth: fd.revenueGrowth ?? null,
    earningsGrowth: fd.earningsGrowth ?? null,
    dividendYield: sd.dividendYield ?? null,
    grossMargin: fd.grossMargins ?? null,
    operatingMargin: fd.operatingMargins ?? null,
    netMargin: fd.profitMargins ?? null,
    freeCashFlow: latest?.freeCf ?? fd.freeCashflow ?? null,
    revenue: latest?.revenue ?? fd.totalRevenue ?? null,
    netIncome: latest?.netIncome ?? null,
    totalDebt: latest?.totalDebt ?? fd.totalDebt ?? null,
    totalCash: latest?.cashAndEquiv ?? fd.totalCash ?? null,
    beta: ks.beta ?? null,
    currency: price.currency || sd.currency || 'USD',
    // New: normalized 3-year annual time series ─────────────────────────
    annual,
    fetchedAt: new Date().toISOString(),
  };
}

// ── prices ──────────────────────────────────────────────────────────────
async function handlePrices(symbol: string) {
  const period2 = new Date();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);

  const [hist, quote, summary] = await Promise.all([
    safe('historical', () =>
      // @ts-ignore - chart() is preferred internally; historical still works
      yahooFinance.historical(symbol, { period1, period2, interval: '1d' })
    ),
    safe('quote(prices)', () => yahooFinance.quote(symbol)),
    safe('quoteSummary(prices)', () =>
      yahooFinance.quoteSummary(symbol, { modules: ['price', 'summaryDetail'] })
    ),
  ]);

  const q: any = quote ?? {};
  const price: any = summary?.price ?? {};
  const sd: any = summary?.summaryDetail ?? {};

  const history = (hist || [])
    .filter((p: any) => p && p.close != null)
    .map((p: any) => ({
      date: new Date(p.date).toISOString().split('T')[0],
      open: p.open ?? null,
      high: p.high ?? null,
      low: p.low ?? null,
      close: Math.round(p.close * 100) / 100,
      volume: p.volume ?? 0,
    }));

  const currentPrice = q.regularMarketPrice ?? price.regularMarketPrice ?? 0;
  const previousClose = q.regularMarketPreviousClose ?? price.regularMarketPreviousClose ?? 0;

  if (!currentPrice && !previousClose && !history.length) return null;

  return {
    symbol,
    currentPrice,
    previousClose,
    change: Math.round((currentPrice - previousClose) * 100) / 100,
    changePercent: previousClose
      ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100
      : 0,
    high52Week: q.fiftyTwoWeekHigh ?? sd.fiftyTwoWeekHigh ?? 0,
    low52Week: q.fiftyTwoWeekLow ?? sd.fiftyTwoWeekLow ?? 0,
    volume: q.regularMarketVolume ?? 0,
    avgVolume: q.averageDailyVolume10Day ?? sd.averageDailyVolume10Day ?? 0,
    currency: q.currency || price.currency || 'USD',
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
  const [fund, summary] = await Promise.all([
    handleFundamentals(symbol).catch(() => null),
    safe('quoteSummary(score)', () =>
      yahooFinance.quoteSummary(symbol, { modules: ['price', 'summaryDetail'] })
    ),
  ]);
  const quote = await safe('quote(score)', () => yahooFinance.quote(symbol));

  const price: any = summary?.price ?? {};
  const sd: any = summary?.summaryDetail ?? {};
  const q: any = quote ?? {};

  const f: any = fund || {};
  const currentPrice = q.regularMarketPrice ?? price.regularMarketPrice ?? 0;
  const high52 = q.fiftyTwoWeekHigh ?? sd.fiftyTwoWeekHigh ?? currentPrice;
  const low52 = q.fiftyTwoWeekLow ?? sd.fiftyTwoWeekLow ?? currentPrice;
  const shortName = q.longName || q.shortName || price.shortName || symbol;
  const currency = q.currency || price.currency || f.currency || 'USD';

  const m = {
    grossMargin: f.grossMargin != null ? f.grossMargin * 120 : null,
    operatingMargin: f.operatingMargin != null ? f.operatingMargin * 200 : null,
    netMargin: f.netMargin != null ? f.netMargin * 250 : null,
    roe: f.roe != null ? Math.min(f.roe * 200, 100) : null,
    revenueGrowth: f.revenueGrowth != null ? 50 + f.revenueGrowth * 200 : null,
    earningsGrowth: f.earningsGrowth != null ? 50 + f.earningsGrowth * 150 : null,
    currentRatio: f.currentRatio != null ? Math.min(f.currentRatio * 40, 100) : null,
    debtToEquity: f.debtToEquity != null ? Math.max(100 - f.debtToEquity * 30, 0) : null,
    cashCoverage:
      f.totalCash != null && f.totalDebt != null && f.totalDebt > 0
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

  // Penalties: explicit deductions when red flags are present
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
      details: currentPrice > 0
        ? `Trading at ${Math.round(((currentPrice - low52) / range) * 100)}% of 52-week range.`
        : 'Insufficient price data.' },
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
    // Alias for new shape requirement
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

    if (result === null) {
      return json({ error: 'No data available for symbol', symbol, action }, 404);
    }
    return json(result);
  } catch (err) {
    const message = (err as Error).message || 'Unknown error';
    console.error('[stock-data] fatal:', message);
    return json({ error: message, ok: false }, 500);
  }
});
