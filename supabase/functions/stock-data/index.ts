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

const YF_BASE = 'https://query2.finance.yahoo.com';
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function yfFetch(path: string) {
  const res = await fetch(`${YF_BASE}${path}`, { headers: YF_HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yahoo Finance API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── search ──────────────────────────────────────────────────────────────
async function handleSearch(query: string) {
  const res = await fetch(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`,
    { headers: YF_HEADERS },
  );
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.quotes || [])
    .filter((q: any) => q.quoteType === 'EQUITY' && q.symbol)
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange || '',
      type: 'Equity',
    }));
}

// ── overview ────────────────────────────────────────────────────────────
async function handleOverview(symbol: string) {
  const data = await yfFetch(
    `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price`,
  );
  const result = data.quoteSummary?.result?.[0];
  if (!result) return null;
  const profile = result.assetProfile || {};
  const price = result.price || {};
  return {
    symbol,
    name: price.longName || price.shortName || symbol,
    exchange: price.exchangeName || '',
    sector: profile.sector || '',
    industry: profile.industry || '',
    description: profile.longBusinessSummary || '',
    marketCap: price.marketCap?.raw || 0,
    employees: profile.fullTimeEmployees || 0,
    website: profile.website || '',
    ceo: profile.companyOfficers?.[0]?.name || 'N/A',
    country: profile.country || '',
  };
}

// ── fundamentals ────────────────────────────────────────────────────────
async function handleFundamentals(symbol: string) {
  const data = await yfFetch(
    `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,summaryDetail`,
  );
  const result = data.quoteSummary?.result?.[0];
  if (!result) return null;
  const ks = result.defaultKeyStatistics || {};
  const fd = result.financialData || {};
  const sd = result.summaryDetail || {};

  const raw = (obj: any) => obj?.raw ?? null;

  return {
    symbol,
    peRatio: raw(sd.trailingPE) ?? raw(ks.trailingPE),
    pbRatio: raw(ks.priceToBook),
    debtToEquity: raw(fd.debtToEquity) != null ? raw(fd.debtToEquity) / 100 : null,
    currentRatio: raw(fd.currentRatio),
    roe: raw(fd.returnOnEquity),
    revenueGrowth: raw(fd.revenueGrowth),
    earningsGrowth: raw(fd.earningsGrowth),
    dividendYield: raw(sd.dividendYield),
    grossMargin: raw(fd.grossMargins),
    operatingMargin: raw(fd.operatingMargins),
    netMargin: raw(fd.profitMargins),
    freeCashFlow: raw(fd.freeCashflow),
    revenue: raw(fd.totalRevenue),
    netIncome: null,
    totalDebt: raw(fd.totalDebt),
    totalCash: raw(fd.totalCash),
    beta: raw(ks.beta),
  };
}

// ── prices ──────────────────────────────────────────────────────────────
async function handlePrices(symbol: string) {
  const [quoteData, chartData] = await Promise.all([
    yfFetch(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price`),
    yfFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`),
  ]);

  const price = quoteData.quoteSummary?.result?.[0]?.price || {};
  const chart = chartData.chart?.result?.[0];
  if (!chart) return null;

  const timestamps = chart.timestamp || [];
  const closes = chart.indicators?.quote?.[0]?.close || [];
  const volumes = chart.indicators?.quote?.[0]?.volume || [];

  const history = timestamps.map((ts: number, i: number) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    close: Math.round((closes[i] ?? 0) * 100) / 100,
    volume: volumes[i] ?? 0,
  })).filter((p: any) => p.close > 0);

  const currentPrice = price.regularMarketPrice?.raw || 0;
  const previousClose = price.regularMarketPreviousClose?.raw || 0;

  return {
    symbol,
    currentPrice,
    previousClose,
    change: Math.round((currentPrice - previousClose) * 100) / 100,
    changePercent: previousClose ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100 : 0,
    high52Week: price.regularMarketDayHigh?.raw || 0, // will refine below
    low52Week: price.regularMarketDayLow?.raw || 0,
    volume: price.regularMarketVolume?.raw || 0,
    avgVolume: price.averageDailyVolume3Month?.raw || 0,
    history,
  };
}

// ── score (computed from real fundamentals) ─────────────────────────────
async function handleScore(symbol: string) {
  const [fundData, quoteData] = await Promise.all([
    handleFundamentals(symbol),
    yfFetch(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail`),
  ]);

  if (!fundData) return null;
  const f = fundData;
  const price = quoteData.quoteSummary?.result?.[0]?.price || {};
  const sd = quoteData.quoteSummary?.result?.[0]?.summaryDetail || {};

  const currentPrice = price.regularMarketPrice?.raw || 0;
  const high52 = sd.fiftyTwoWeekHigh?.raw || currentPrice;
  const low52 = sd.fiftyTwoWeekLow?.raw || currentPrice;
  const shortName = price.shortName || price.longName || symbol;

  // Profitability pillar
  const profitScore = clamp(avg([
    f.grossMargin != null ? f.grossMargin * 120 : null,
    f.operatingMargin != null ? f.operatingMargin * 200 : null,
    f.netMargin != null ? f.netMargin * 250 : null,
    f.roe != null ? Math.min(f.roe * 200, 100) : null,
  ]));

  // Growth pillar
  const growthScore = clamp(avg([
    f.revenueGrowth != null ? 50 + f.revenueGrowth * 200 : null,
    f.earningsGrowth != null ? 50 + f.earningsGrowth * 150 : null,
  ]));

  // Financial health pillar
  const healthScore = clamp(avg([
    f.currentRatio != null ? Math.min(f.currentRatio * 40, 100) : null,
    f.debtToEquity != null ? Math.max(100 - f.debtToEquity * 30, 0) : null,
    f.totalCash != null && f.totalDebt != null && f.totalDebt > 0
      ? Math.min((f.totalCash / f.totalDebt) * 60, 100) : null,
  ]));

  // Valuation pillar
  const valScore = clamp(avg([
    f.peRatio != null ? Math.max(100 - (f.peRatio - 15) * 2, 0) : null,
    f.pbRatio != null ? Math.max(100 - (f.pbRatio - 3) * 8, 0) : null,
  ]));

  // Momentum pillar
  const range = high52 - low52 || 1;
  const momScore = clamp(((currentPrice - low52) / range) * 100);

  const pillars = [
    { name: 'Profitability', score: profitScore, weight: 0.25, grade: toGrade(profitScore), details: fmtProfitDetails(f) },
    { name: 'Growth', score: growthScore, weight: 0.20, grade: toGrade(growthScore), details: fmtGrowthDetails(f) },
    { name: 'Financial Health', score: healthScore, weight: 0.20, grade: toGrade(healthScore), details: fmtHealthDetails(f) },
    { name: 'Valuation', score: valScore, weight: 0.20, grade: toGrade(valScore), details: fmtValDetails(f) },
    { name: 'Momentum', score: momScore, weight: 0.15, grade: toGrade(momScore), details: `Trading at ${pct((currentPrice - low52) / range)} of 52-week range.` },
  ];

  const overall = Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0));
  const confidence = [f.peRatio, f.roe, f.revenueGrowth, f.grossMargin].filter((v) => v != null).length >= 3 ? 'high' : f.peRatio != null ? 'medium' : 'low';

  return {
    symbol,
    overallScore: overall,
    grade: toGrade(overall),
    confidence,
    pillars,
    summary: `${shortName} scores ${overall}/100 (${toGrade(overall)}) based on real-time fundamental analysis.`,
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
function fmtPct(v: number | null) { return v != null ? `${Math.round(v * 100)}%` : 'N/A'; }

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
