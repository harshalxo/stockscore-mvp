import type { Fundamentals } from '@/types/stock';

export type MetricCategory = 'Quality' | 'Growth' | 'Cash Flow' | 'Risk' | 'Valuation';

export interface AcademyMetric {
  id: string; // slug used for anchors
  name: string;
  aliases: string[];
  category: MetricCategory;
  formula: string;
  measures: string;
  whyMatters: string;
  strengths: string[];
  weaknesses: string[];
  commonMistakes: string[];
  /** Compute an example value from current fundamentals. Return null if not computable. */
  example?: (f: Fundamentals) => { value: string; note?: string } | null;
}

const pct = (n: number | null | undefined, digits = 2) =>
  n == null || !isFinite(n) ? null : `${(n * 100).toFixed(digits)}%`;
const num = (n: number | null | undefined, digits = 2) =>
  n == null || !isFinite(n) ? null : n.toFixed(digits);

function latest<T extends keyof NonNullable<Fundamentals['annual']>[number]>(
  f: Fundamentals,
  key: T,
): number | null {
  const arr = f.annual || [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i][key] as number | null | undefined;
    if (v != null && isFinite(v as number)) return v as number;
  }
  return null;
}

function cagr(series: (number | null)[], years: number): number | null {
  const clean = series.filter((v): v is number => v != null && isFinite(v) && v > 0);
  if (clean.length < 2) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  const n = Math.min(years, clean.length - 1);
  if (n <= 0) return null;
  return Math.pow(last / first, 1 / n) - 1;
}

export const ACADEMY_METRICS: AcademyMetric[] = [
  // QUALITY
  {
    id: 'roce',
    name: 'ROCE — Return on Capital Employed',
    aliases: ['roce', 'return on capital employed', 'capital employed'],
    category: 'Quality',
    formula: 'ROCE = EBIT / (Total Assets − Current Liabilities)',
    measures: 'How efficiently a company turns all the capital it uses (debt + equity) into operating profit.',
    whyMatters:
      'ROCE is a cleaner profitability metric than ROE because it includes debt. Sustained ROCE above the cost of capital is a hallmark of high-quality compounders.',
    strengths: [
      'Comparable across capital structures (debt vs equity heavy)',
      'Reflects management efficiency at deploying capital',
      'Hard to fake long-term',
    ],
    weaknesses: [
      'Sensitive to one-off EBIT items',
      'Asset-light businesses can show artificially high ROCE',
      'Goodwill from acquisitions distorts the denominator',
    ],
    commonMistakes: [
      'Using net income instead of EBIT',
      'Forgetting to subtract current liabilities',
      'Comparing ROCE across very different industries',
    ],
    example: (f) => {
      const ebit = latest(f, 'ebit');
      const assets = latest(f, 'totalAssets');
      if (ebit == null || assets == null || assets <= 0) return null;
      // Approximate capital employed with total assets (current liabilities unavailable)
      return { value: pct(ebit / assets)!, note: 'Approximation: EBIT / Total Assets (current liabilities not in dataset).' };
    },
  },
  {
    id: 'roe',
    name: 'ROE — Return on Equity',
    aliases: ['roe', 'return on equity'],
    category: 'Quality',
    formula: 'ROE = Net Income / Shareholders\' Equity',
    measures: 'How much profit a company generates per dollar of shareholder equity.',
    whyMatters:
      'A consistently high ROE (>15%) without excessive leverage signals a durable competitive advantage.',
    strengths: ['Direct shareholder perspective', 'Easy to compute and compare', 'Widely reported'],
    weaknesses: [
      'Inflated by leverage (high debt shrinks equity)',
      'Buybacks artificially boost ROE',
      'Negative equity makes it meaningless',
    ],
    commonMistakes: [
      'Celebrating high ROE driven entirely by debt',
      'Ignoring volatile or one-time net income',
      'Comparing across capital structures without adjusting',
    ],
    example: (f) => (f.roe == null ? null : { value: pct(f.roe)! }),
  },
  {
    id: 'roa',
    name: 'ROA — Return on Assets',
    aliases: ['roa', 'return on assets'],
    category: 'Quality',
    formula: 'ROA = Net Income / Total Assets',
    measures: 'How efficiently a company uses its total asset base to generate profit.',
    whyMatters:
      'ROA strips out leverage effects, giving a cleaner read on operational efficiency than ROE.',
    strengths: ['Leverage-neutral', 'Useful for capital-intensive industries', 'Cross-company comparable'],
    weaknesses: [
      'Asset values can be stale (book vs market)',
      'Penalises asset-heavy but efficient businesses',
      'Off-balance-sheet items distort it',
    ],
    commonMistakes: [
      'Comparing ROA of a bank to a software company',
      'Ignoring depreciation policy differences',
    ],
    example: (f) => {
      const ni = latest(f, 'netIncome');
      const a = latest(f, 'totalAssets');
      if (ni == null || a == null || a <= 0) return null;
      return { value: pct(ni / a)! };
    },
  },
  {
    id: 'ebit-margin',
    name: 'EBIT Margin',
    aliases: ['ebit margin', 'operating margin', 'operating profit margin'],
    category: 'Quality',
    formula: 'EBIT Margin = EBIT / Revenue',
    measures: 'The percentage of every dollar of sales that becomes operating profit before interest and tax.',
    whyMatters:
      'EBIT margin reveals pricing power and operating leverage. Expanding margins are a strong quality signal.',
    strengths: ['Comparable across tax jurisdictions', 'Captures pricing power', 'Trend is highly informative'],
    weaknesses: [
      'Varies widely by industry',
      'Affected by accounting choices (D&A, capitalisation)',
      'One-offs distort single-year values',
    ],
    commonMistakes: [
      'Comparing a software EBIT margin to a retailer\'s',
      'Reading a single year instead of a 3–5 year trend',
    ],
    example: (f) => {
      const ebit = latest(f, 'ebit');
      const rev = latest(f, 'revenue');
      if (ebit == null || rev == null || rev <= 0) return f.operatingMargin != null ? { value: pct(f.operatingMargin)! } : null;
      return { value: pct(ebit / rev)! };
    },
  },

  // GROWTH
  {
    id: 'revenue-cagr',
    name: 'Revenue CAGR',
    aliases: ['revenue cagr', 'sales cagr', 'revenue growth', 'cagr'],
    category: 'Growth',
    formula: 'CAGR = (End Revenue / Start Revenue)^(1/n) − 1',
    measures: 'The compound annual growth rate of revenue over n years.',
    whyMatters:
      'Revenue is the foundation of long-term value creation. Sustained double-digit CAGR is rare and valuable.',
    strengths: ['Smooths year-to-year noise', 'Easy to communicate', 'Industry-comparable'],
    weaknesses: [
      'Hides acceleration or deceleration inside the period',
      'Distorted by acquisitions vs organic growth',
      'Currency fluctuations affect multinationals',
    ],
    commonMistakes: [
      'Mistaking acquisition-driven growth for organic',
      'Using too short a window (1–2 years)',
    ],
    example: (f) => {
      const series = (f.annual || []).map((y) => y.revenue);
      const c = cagr(series, (f.annual?.length || 1) - 1);
      return c == null ? (f.revenueGrowth != null ? { value: pct(f.revenueGrowth)!, note: 'Latest YoY (CAGR unavailable).' } : null) : { value: pct(c)! };
    },
  },
  {
    id: 'net-income-cagr',
    name: 'Net Income CAGR',
    aliases: ['net income cagr', 'earnings cagr', 'profit growth', 'earnings growth'],
    category: 'Growth',
    formula: 'CAGR = (End Net Income / Start Net Income)^(1/n) − 1',
    measures: 'The compound annual growth rate of bottom-line profit.',
    whyMatters:
      'Earnings growth ultimately drives share-price appreciation. Outpacing revenue growth signals operating leverage.',
    strengths: ['Tied directly to EPS growth', 'Captures margin expansion', 'Long-horizon comparable'],
    weaknesses: [
      'Very sensitive to start/end year choice',
      'Negative or near-zero starting value breaks the math',
      'One-time gains/losses distort it',
    ],
    commonMistakes: [
      'Computing CAGR from a depressed base year (overstates growth)',
      'Ignoring share-count dilution — use EPS CAGR instead when possible',
    ],
    example: (f) => {
      const series = (f.annual || []).map((y) => y.netIncome);
      const c = cagr(series, (f.annual?.length || 1) - 1);
      return c == null ? (f.earningsGrowth != null ? { value: pct(f.earningsGrowth)!, note: 'Latest YoY (CAGR unavailable).' } : null) : { value: pct(c)! };
    },
  },

  // CASH FLOW
  {
    id: 'fcf-margin',
    name: 'FCF Margin',
    aliases: ['fcf margin', 'free cash flow margin'],
    category: 'Cash Flow',
    formula: 'FCF Margin = Free Cash Flow / Revenue',
    measures: 'How much of every revenue dollar converts into free cash flow after capex.',
    whyMatters:
      'Cash is harder to fake than earnings. A high, stable FCF margin signals a real, durable business.',
    strengths: ['Cash-based — less subject to accounting choices', 'Captures capex intensity', 'Excellent quality signal'],
    weaknesses: [
      'Negative in heavy investment phases (not always bad)',
      'Working-capital swings cause volatility',
      'M&A spending is often excluded',
    ],
    commonMistakes: [
      'Confusing FCF with operating cash flow (forgetting capex)',
      'Penalising a growth company for reinvesting',
    ],
    example: (f) => {
      const fcf = latest(f, 'freeCf') ?? f.freeCashFlow;
      const rev = latest(f, 'revenue') ?? f.revenue;
      if (fcf == null || rev == null || rev <= 0) return null;
      return { value: pct(fcf / rev)! };
    },
  },
  {
    id: 'ocf-to-net-income',
    name: 'OCF / Net Income',
    aliases: ['ocf', 'ocf / net income', 'cash conversion', 'operating cash flow ratio'],
    category: 'Cash Flow',
    formula: 'Cash Conversion = Operating Cash Flow / Net Income',
    measures: 'How well reported earnings translate into actual cash from operations.',
    whyMatters:
      'A ratio consistently near or above 1.0 confirms earnings quality. Persistently below 1.0 is a red flag for aggressive accounting.',
    strengths: ['Powerful earnings-quality check', 'Detects accrual manipulation', 'Simple to compute'],
    weaknesses: [
      'Working-capital build-ups can depress it temporarily',
      'Non-cash charges (D&A) inflate it mechanically',
      'Less meaningful for loss-makers',
    ],
    commonMistakes: [
      'Ignoring it because earnings "look good"',
      'Reading a single year rather than 3-year average',
    ],
    example: (f) => {
      const ocf = latest(f, 'operatingCf');
      const ni = latest(f, 'netIncome');
      if (ocf == null || ni == null || ni === 0) return null;
      return { value: (ocf / ni).toFixed(2) + 'x' };
    },
  },

  // RISK
  {
    id: 'debt-to-equity',
    name: 'Debt / Equity',
    aliases: ['debt', 'debt to equity', 'd/e', 'leverage'],
    category: 'Risk',
    formula: 'D/E = Total Debt / Shareholders\' Equity',
    measures: 'How much debt a company carries relative to the equity cushion absorbing losses.',
    whyMatters:
      'High leverage amplifies returns in good times and losses in bad times. It is the single biggest driver of bankruptcy risk.',
    strengths: ['Easy to compute', 'Standardised across companies', 'Strong stress-test signal'],
    weaknesses: [
      'Book equity can be distorted by buybacks or write-downs',
      'Off-balance-sheet debt (leases) often excluded',
      'Optimal level varies by industry',
    ],
    commonMistakes: [
      'Comparing a bank\'s D/E to an industrial company\'s',
      'Ignoring lease obligations',
      'Assuming low D/E always means low risk (operating risk still exists)',
    ],
    example: (f) => (f.debtToEquity == null ? null : { value: f.debtToEquity.toFixed(2) + 'x' }),
  },
  {
    id: 'interest-coverage',
    name: 'Interest Coverage',
    aliases: ['interest coverage', 'interest cover', 'times interest earned'],
    category: 'Risk',
    formula: 'Interest Coverage = EBIT / Interest Expense',
    measures: 'How many times over a company can pay its interest bill from operating profit.',
    whyMatters:
      'A coverage ratio below 2x is fragile; above 5x is generally safe. It is one of the best short-term solvency indicators.',
    strengths: ['Direct measure of debt-service capacity', 'Used by lenders and rating agencies', 'Industry-comparable'],
    weaknesses: [
      'EBIT volatility makes single-year reads misleading',
      'Capitalised interest can hide the true bill',
      'Ignores principal repayments',
    ],
    commonMistakes: [
      'Using net income instead of EBIT',
      'Forgetting to check the trend over multiple years',
    ],
    example: (f) => {
      const ebit = latest(f, 'ebit');
      const ie = latest(f, 'interestExpense');
      if (ebit == null || ie == null || ie === 0) return null;
      return { value: (ebit / Math.abs(ie)).toFixed(2) + 'x' };
    },
  },

  // VALUATION
  {
    id: 'pe',
    name: 'P/E — Price to Earnings',
    aliases: ['pe', 'p/e', 'price to earnings', 'price/earnings'],
    category: 'Valuation',
    formula: 'P/E = Share Price / Earnings Per Share',
    measures: 'How many dollars investors pay today for one dollar of current earnings.',
    whyMatters:
      'The most widely used valuation shortcut. Useful when compared to history, peers, and growth rate — never in isolation.',
    strengths: ['Universally understood', 'Easy to compute', 'Good starting point for screening'],
    weaknesses: [
      'Meaningless for loss-makers',
      'Distorted by one-off earnings items',
      'Ignores balance-sheet quality',
    ],
    commonMistakes: [
      'Treating a low P/E as automatically "cheap" (value traps)',
      'Comparing P/Es across very different growth rates',
      'Ignoring cyclical earnings peaks',
    ],
    example: (f) => (f.peRatio == null ? null : { value: f.peRatio.toFixed(2) + 'x' }),
  },
  {
    id: 'pb',
    name: 'P/B — Price to Book',
    aliases: ['pb', 'p/b', 'price to book', 'price/book'],
    category: 'Valuation',
    formula: 'P/B = Share Price / Book Value Per Share',
    measures: 'How much investors pay relative to the accounting value of shareholders\' equity.',
    whyMatters:
      'Particularly relevant for banks, insurers, and asset-heavy businesses where book value approximates economic value.',
    strengths: [
      'Works for loss-making companies',
      'Stable denominator vs earnings',
      'Useful for financials and cyclicals',
    ],
    weaknesses: [
      'Book value ignores intangibles (brand, IP, software)',
      'Largely meaningless for asset-light businesses',
      'Distorted by goodwill and write-downs',
    ],
    commonMistakes: [
      'Using P/B on software or services companies',
      'Assuming P/B < 1 always means undervalued',
    ],
    example: (f) => (f.pbRatio == null ? null : { value: f.pbRatio.toFixed(2) + 'x' }),
  },
];

export function findMetric(idOrAlias: string): AcademyMetric | undefined {
  const q = idOrAlias.toLowerCase().trim();
  return ACADEMY_METRICS.find(
    (m) => m.id === q || m.aliases.some((a) => a === q),
  );
}

export function searchMetrics(query: string): AcademyMetric[] {
  const q = query.toLowerCase().trim();
  if (!q) return ACADEMY_METRICS;
  return ACADEMY_METRICS.filter((m) => {
    const hay = [m.id, m.name, m.category, ...m.aliases, m.formula, m.measures].join(' ').toLowerCase();
    return hay.includes(q);
  });
}
