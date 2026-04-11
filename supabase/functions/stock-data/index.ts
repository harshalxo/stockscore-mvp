import YahooFinance from "npm:yahoo-finance2@2.14.0";
const yahooFinance = new YahooFinance();

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

// ── search ──────────────────────────────────────────────────────────────
async function handleSearch(query: string) {
  const res = await yahooFinance.search(query, { newsCount: 0 });
  return (res.quotes || [])
    .filter((q: any) => q.quoteType === 'EQUITY' && q.symbol)
    .slice(0, 12)
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange || '',
      type: 'Equity',
    }));
}

// ── overview ────────────────────────────────────────────────────────────
async function handleOverview(symbol: string) {
  const q = await yahooFinance.quoteSummary(symbol, {
    modules: ['assetProfile', 'summaryDetail', 'price'],
  });
  const profile = q.assetProfile || {} as any;
  const price = q.price || {} as any;
  return {
    symbol,
    name: price.longName || price.shortName || symbol,
    exchange: price.exchangeName || '',
    sector: profile.sector || '',
    industry: profile.industry || '',
    description: profile.longBusinessSummary || '',
    marketCap: price.marketCap || 0,
    employees: profile.fullTimeEmployees || 0,
    website: profile.website || '',
    ceo: profile.companyOfficers?.[0]?.name || 'N/A',
    country: profile.country || '',
  };
}

// ── fundamentals ────────────────────────────────────────────────────────
async function handleFundamentals(symbol: string) {
  const q = await yahooFinance.quoteSummary(symbol, {
    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'incomeStatementHistory', 'balanceSheetHistory'],
  });
  const ks = q.defaultKeyStatistics || {} as any;
  const fd = q.financialData || {} as any;
  const sd = q.summaryDetail || {} as any;

  return {
    symbol,
    peRatio: sd.trailingPE ?? ks.trailingPE ?? null,
    pbRatio: ks.priceToBook ?? null,
    debtToEquity: fd.debtToEquity != null ? fd.debtToEquity / 100 : null,
    currentRatio: fd.currentRatio ?? null,
    roe: fd.returnOnEquity ?? null,
    revenueGrowth: fd.revenueGrowth ?? null,
    earningsGrowth: fd.earningsGrowth ?? null,
    dividendYield: sd.dividendYield ?? null,
    grossMargin: fd.grossMargins ?? null,
    operatingMargin: fd.operatingMargins ?? null,
    netMargin: fd.profitMargins ?? null,
    freeCashFlow: fd.freeCashflow ?? null,
    revenue: fd.totalRevenue ?? null,
    netIncome: null, // not directly exposed as single field
    totalDebt: fd.totalDebt ?? null,
    totalCash: fd.totalCash ?? null,
    beta: ks.beta ?? null,
  };
}

// ── prices ──────────────────────────────────────────────────────────────
async function handlePrices(symbol: string) {
  const [quote, hist] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      interval: '1d',
    }),
  ]);

  const history = (hist.quotes || []).map((p: any) => ({
    date: new Date(p.date).toISOString().split('T')[0],
    close: Math.round((p.close ?? 0) * 100) / 100,
    volume: p.volume ?? 0,
  }));

  const currentPrice = quote.regularMarketPrice ?? 0;
  const previousClose = quote.regularMarketPreviousClose ?? 0;

  return {
    symbol,
    currentPrice,
    previousClose,
    change: Math.round((currentPrice - previousClose) * 100) / 100,
    changePercent: previousClose ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100 : 0,
    high52Week: quote.fiftyTwoWeekHigh ?? 0,
    low52Week: quote.fiftyTwoWeekLow ?? 0,
    volume: quote.regularMarketVolume ?? 0,
    avgVolume: quote.averageDailyVolume3Month ?? 0,
    history,
  };
}

// ── score (computed from real fundamentals) ─────────────────────────────
async function handleScore(symbol: string) {
  const [fundamentals, quote] = await Promise.all([
    handleFundamentals(symbol),
    yahooFinance.quote(symbol),
  ]);

  const f = fundamentals;

  // Profitability pillar
  const profitScore = clamp(
    avg([
      f.grossMargin != null ? f.grossMargin * 120 : null,
      f.operatingMargin != null ? f.operatingMargin * 200 : null,
      f.netMargin != null ? f.netMargin * 250 : null,
      f.roe != null ? Math.min(f.roe * 200, 100) : null,
    ]),
  );

  // Growth pillar
  const growthScore = clamp(
    avg([
      f.revenueGrowth != null ? 50 + f.revenueGrowth * 200 : null,
      f.earningsGrowth != null ? 50 + f.earningsGrowth * 150 : null,
    ]),
  );

  // Financial health pillar
  const healthScore = clamp(
    avg([
      f.currentRatio != null ? Math.min(f.currentRatio * 40, 100) : null,
      f.debtToEquity != null ? Math.max(100 - f.debtToEquity * 30, 0) : null,
      f.totalCash != null && f.totalDebt != null && f.totalDebt > 0
        ? Math.min((f.totalCash / f.totalDebt) * 60, 100) : null,
    ]),
  );

  // Valuation pillar
  const valScore = clamp(
    avg([
      f.peRatio != null ? Math.max(100 - (f.peRatio - 15) * 2, 0) : null,
      f.pbRatio != null ? Math.max(100 - (f.pbRatio - 3) * 8, 0) : null,
    ]),
  );

  // Momentum pillar
  const price = quote.regularMarketPrice ?? 0;
  const low52 = quote.fiftyTwoWeekLow ?? price;
  const high52 = quote.fiftyTwoWeekHigh ?? price;
  const range = high52 - low52 || 1;
  const momScore = clamp(((price - low52) / range) * 100);

  const pillars = [
    { name: 'Profitability', score: profitScore, weight: 0.25, grade: toGrade(profitScore), details: fmtProfitDetails(f) },
    { name: 'Growth', score: growthScore, weight: 0.20, grade: toGrade(growthScore), details: fmtGrowthDetails(f) },
    { name: 'Financial Health', score: healthScore, weight: 0.20, grade: toGrade(healthScore), details: fmtHealthDetails(f) },
    { name: 'Valuation', score: valScore, weight: 0.20, grade: toGrade(valScore), details: fmtValDetails(f) },
    { name: 'Momentum', score: momScore, weight: 0.15, grade: toGrade(momScore), details: `Trading at ${pct((price - low52) / range)} of 52-week range.` },
  ];

  const overall = Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0));
  const confidence = [f.peRatio, f.roe, f.revenueGrowth, f.grossMargin].filter((v) => v != null).length >= 3 ? 'high' : f.peRatio != null ? 'medium' : 'low';

  return {
    symbol,
    overallScore: overall,
    grade: toGrade(overall),
    confidence,
    pillars,
    summary: `${quote.shortName || symbol} scores ${overall}/100 (${toGrade(overall)}) based on real-time fundamental analysis.`,
    lastUpdated: new Date().toISOString(),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────
function clamp(v: number) { return Math.round(Math.max(0, Math.min(100, v))); }
function avg(vals: (number | null)[]) {
  const valid = vals.filter((v): v is number => v != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 50;
}
function pct(v: number) { return `${Math.round(v * 100)}%`; }
function fmtPct(v: number | null) { return v != null ? pct(v) : 'N/A'; }

function toGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 45) return 'D';
  return 'F';
}

function fmtProfitDetails(f: any) {
  return `Gross margin ${fmtPct(f.grossMargin)}, operating margin ${fmtPct(f.operatingMargin)}, net margin ${fmtPct(f.netMargin)}, ROE ${fmtPct(f.roe)}.`;
}
function fmtGrowthDetails(f: any) {
  return `Revenue growth ${fmtPct(f.revenueGrowth)}, earnings growth ${fmtPct(f.earningsGrowth)}.`;
}
function fmtHealthDetails(f: any) {
  return `Current ratio ${f.currentRatio?.toFixed(2) ?? 'N/A'}, D/E ${f.debtToEquity?.toFixed(2) ?? 'N/A'}.`;
}
function fmtValDetails(f: any) {
  return `P/E ${f.peRatio?.toFixed(1) ?? 'N/A'}, P/B ${f.pbRatio?.toFixed(1) ?? 'N/A'}.`;
}

// ── server ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    let result: unknown;

    switch (action) {
      case 'search':
        result = await handleSearch(params.query || '');
        break;
      case 'overview':
        result = await handleOverview(params.symbol || '');
        break;
      case 'fundamentals':
        result = await handleFundamentals(params.symbol || '');
        break;
      case 'prices':
        result = await handlePrices(params.symbol || '');
        break;
      case 'score':
        result = await handleScore(params.symbol || '');
        break;
      default:
        return json({ error: 'Unknown action' }, 400);
    }

    if (result === null) return json({ error: 'Symbol not found' }, 404);
    return json(result);
  } catch (err) {
    console.error('stock-data error:', err);
    return json({ error: err.message }, 500);
  }
});
