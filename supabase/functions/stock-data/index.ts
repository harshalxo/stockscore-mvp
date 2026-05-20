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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cachedCrumb: { crumb: string; cookie: string; ts: number } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && Date.now() - cachedCrumb.ts < 5 * 60 * 1000) {
    return cachedCrumb;
  }
  const consentRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });
  await consentRes.text();
  const setCookies = consentRes.headers.get('set-cookie') || '';
  const cookies = setCookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookies },
  });
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('Unauthorized')) {
    throw new Error('Failed to obtain Yahoo Finance crumb');
  }
  cachedCrumb = { crumb, cookie: cookies, ts: Date.now() };
  return cachedCrumb;
}

async function yfFetch(path: string) {
  const { crumb, cookie } = await getCrumb();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${YF_BASE}${path}${separator}crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Cookie': cookie },
  });
  if (!res.ok) {
    if (res.status === 401 && cachedCrumb) {
      await res.text();
      cachedCrumb = null;
      const fresh = await getCrumb();
      const retryUrl = `${YF_BASE}${path}${separator}crumb=${encodeURIComponent(fresh.crumb)}`;
      const retry = await fetch(retryUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Cookie': fresh.cookie },
      });
      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`Yahoo Finance API error ${retry.status}: ${text.slice(0, 200)}`);
      }
      return retry.json();
    }
    const text = await res.text();
    throw new Error(`Yahoo Finance API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Try to fetch quoteSummary; on failure, fall back to fetching modules one-by-one and skip the ones that fail.
async function quoteSummarySafe(symbol: string, modules: string[]): Promise<Record<string, any>> {
  try {
    const data = await yfFetch(
      `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules.join(',')}`,
    );
    const result = data.quoteSummary?.result?.[0];
    if (result) return result;
  } catch (e) {
    console.warn(`quoteSummary bulk failed for ${symbol}: ${(e as Error).message}`);
  }
  // Fallback: per-module fetches
  const out: Record<string, any> = {};
  for (const m of modules) {
    try {
      const d = await yfFetch(
        `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${m}`,
      );
      const r = d.quoteSummary?.result?.[0];
      if (r?.[m]) out[m] = r[m];
    } catch (e) {
      console.warn(`module ${m} failed for ${symbol}: ${(e as Error).message}`);
    }
  }
  return out;
}

const raw = (obj: any) => obj?.raw ?? null;

// ── search ──────────────────────────────────────────────────────────────
async function handleSearch(query: string) {
  const { crumb, cookie } = await getCrumb();
  const res = await fetch(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&enableFuzzyQuery=false&crumb=${encodeURIComponent(crumb)}`,
    { headers: { 'User-Agent': UA, 'Cookie': cookie } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Search failed: ${t.slice(0, 200)}`);
  }
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
  const result = await quoteSummarySafe(symbol, ['assetProfile', 'price']);
  const profile = result.assetProfile || {};
  const price = result.price || {};
  if (!profile && !price.longName && !price.shortName) return null;
  return {
    symbol,
    name: price.longName || price.shortName || symbol,
    exchange: price.exchangeName || '',
    sector: profile.sector || '',
    industry: profile.industry || '',
    description: profile.longBusinessSummary || '',
    marketCap: raw(price.marketCap) || 0,
    employees: profile.fullTimeEmployees || 0,
    website: profile.website || '',
    ceo: profile.companyOfficers?.[0]?.name || 'N/A',
    country: profile.country || '',
    currency: price.currency || 'USD',
  };
}

// ── fundamentals ────────────────────────────────────────────────────────
async function handleFundamentals(symbol: string) {
  const result = await quoteSummarySafe(symbol, ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price']);
  const ks = result.defaultKeyStatistics || {};
  const fd = result.financialData || {};
  const sd = result.summaryDetail || {};
  const price = result.price || {};
  // If literally nothing came back, return null so UI shows empty state
  if (!Object.keys(ks).length && !Object.keys(fd).length && !Object.keys(sd).length) {
    return null;
  }

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
    currency: price.currency || raw(sd.currency) || 'USD',
  };
}

// ── prices ──────────────────────────────────────────────────────────────
async function handlePrices(symbol: string) {
  const summaryPromise = quoteSummarySafe(symbol, ['price', 'summaryDetail']);

  let chartData: any = null;
  try {
    chartData = await yfFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`);
  } catch (e) {
    console.warn(`chart fetch failed for ${symbol}: ${(e as Error).message}`);
  }

  const summary = await summaryPromise;
  const price = summary.price || {};
  const sd = summary.summaryDetail || {};
  const chart = chartData?.chart?.result?.[0];

  let history: any[] = [];
  if (chart) {
    const timestamps = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];
    const volumes = chart.indicators?.quote?.[0]?.volume || [];
    history = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: Math.round((closes[i] ?? 0) * 100) / 100,
      volume: volumes[i] ?? 0,
    })).filter((p: any) => p.close > 0);
  }

  const currentPrice = raw(price.regularMarketPrice) ?? chart?.meta?.regularMarketPrice ?? 0;
  const previousClose = raw(price.regularMarketPreviousClose) ?? chart?.meta?.chartPreviousClose ?? 0;
  // If we have absolutely nothing, signal not found
  if (!currentPrice && !previousClose && history.length === 0) return null;

  return {
    symbol,
    currentPrice,
    previousClose,
    change: Math.round((currentPrice - previousClose) * 100) / 100,
    changePercent: previousClose ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100 : 0,
    high52Week: raw(sd.fiftyTwoWeekHigh) ?? chart?.meta?.fiftyTwoWeekHigh ?? 0,
    low52Week: raw(sd.fiftyTwoWeekLow) ?? chart?.meta?.fiftyTwoWeekLow ?? 0,
    volume: raw(price.regularMarketVolume) ?? 0,
    avgVolume: raw(sd.averageDailyVolume10Day) ?? raw(price.averageDailyVolume3Month) ?? 0,
    currency: price.currency || chart?.meta?.currency || 'USD',
    history,
  };
}

// ── score (computed from real fundamentals) ─────────────────────────────
async function handleScore(symbol: string) {
  const fundData = await handleFundamentals(symbol).catch((e) => {
    console.warn(`fundamentals failed in score for ${symbol}: ${e.message}`);
    return null;
  });
  const quoteResult = await quoteSummarySafe(symbol, ['price', 'summaryDetail']);

  const price = quoteResult.price || {};
  const sd = quoteResult.summaryDetail || {};

  const f = fundData || {
    grossMargin: null, operatingMargin: null, netMargin: null, roe: null,
    revenueGrowth: null, earningsGrowth: null, currentRatio: null,
    debtToEquity: null, totalCash: null, totalDebt: null, peRatio: null, pbRatio: null,
  } as any;

  const currentPrice = raw(price.regularMarketPrice) ?? 0;
  const high52 = raw(sd.fiftyTwoWeekHigh) ?? currentPrice;
  const low52 = raw(sd.fiftyTwoWeekLow) ?? currentPrice;
  const shortName = price.shortName || price.longName || symbol;
  const currency = price.currency || (fundData as any)?.currency || 'USD';

  const profitScore = clamp(avg([
    f.grossMargin != null ? f.grossMargin * 120 : null,
    f.operatingMargin != null ? f.operatingMargin * 200 : null,
    f.netMargin != null ? f.netMargin * 250 : null,
    f.roe != null ? Math.min(f.roe * 200, 100) : null,
  ]));
  const growthScore = clamp(avg([
    f.revenueGrowth != null ? 50 + f.revenueGrowth * 200 : null,
    f.earningsGrowth != null ? 50 + f.earningsGrowth * 150 : null,
  ]));
  const healthScore = clamp(avg([
    f.currentRatio != null ? Math.min(f.currentRatio * 40, 100) : null,
    f.debtToEquity != null ? Math.max(100 - f.debtToEquity * 30, 0) : null,
    f.totalCash != null && f.totalDebt != null && f.totalDebt > 0
      ? Math.min((f.totalCash / f.totalDebt) * 60, 100) : null,
  ]));
  const valScore = clamp(avg([
    f.peRatio != null ? Math.max(100 - (f.peRatio - 15) * 2, 0) : null,
    f.pbRatio != null ? Math.max(100 - (f.pbRatio - 3) * 8, 0) : null,
  ]));
  const range = (high52 - low52) || 1;
  const momScore = currentPrice > 0 ? clamp(((currentPrice - low52) / range) * 100) : 50;

  const pillars = [
    { name: 'Profitability', score: profitScore, weight: 0.25, grade: toGrade(profitScore), details: fmtProfitDetails(f) },
    { name: 'Growth', score: growthScore, weight: 0.20, grade: toGrade(growthScore), details: fmtGrowthDetails(f) },
    { name: 'Financial Health', score: healthScore, weight: 0.20, grade: toGrade(healthScore), details: fmtHealthDetails(f) },
    { name: 'Valuation', score: valScore, weight: 0.20, grade: toGrade(valScore), details: fmtValDetails(f) },
    { name: 'Momentum', score: momScore, weight: 0.15, grade: toGrade(momScore), details: currentPrice > 0 ? `Trading at ${pct((currentPrice - low52) / range)} of 52-week range.` : 'Insufficient price data.' },
  ];

  const overall = Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0));
  const availableCount = [f.peRatio, f.roe, f.revenueGrowth, f.grossMargin].filter((v) => v != null).length;
  const confidence = availableCount >= 3 ? 'high' : f.peRatio != null ? 'medium' : 'low';

  return {
    symbol,
    overallScore: overall,
    grade: toGrade(overall),
    confidence,
    pillars,
    currency,
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

// ── server ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { action, ...params } = await req.json();
    let result: unknown;
    switch (action) {
      case 'search': result = await handleSearch(params.query || ''); break;
      case 'overview': result = await handleOverview(params.symbol || ''); break;
      case 'fundamentals': result = await handleFundamentals(params.symbol || ''); break;
      case 'prices': result = await handlePrices(params.symbol || ''); break;
      case 'score': result = await handleScore(params.symbol || ''); break;
      default: return json({ error: 'Unknown action' }, 400);
    }
    if (result === null) return json({ error: 'Symbol not found' }, 404);
    return json(result);
  } catch (err) {
    console.error('stock-data error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
