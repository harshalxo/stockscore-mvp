export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  description: string;
  marketCap: number;
  employees: number;
  website: string;
  ceo: string;
  country: string;
  currency?: string;
  logo?: string;
}

export interface Fundamentals {
  symbol: string;
  peRatio: number | null;
  pbRatio: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  roe: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  dividendYield: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  freeCashFlow: number | null;
  revenue: number | null;
  netIncome: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  beta: number | null;
  currency?: string;
}

export interface PriceData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high52Week: number;
  low52Week: number;
  volume: number;
  avgVolume: number;
  currency?: string;
  history: PricePoint[];
}

export interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

export interface ScorePillar {
  name: string;
  score: number;
  weight: number;
  grade: string;
  details: string;
}

export interface StockScore {
  symbol: string;
  overallScore: number;
  grade: string;
  confidence: 'high' | 'medium' | 'low';
  pillars: ScorePillar[];
  summary: string;
  currency?: string;
  lastUpdated: string;
}

export interface DcfAssumptions {
  forecastYears: number;
  fcfGrowthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  safetyMargin: number;
}

export interface DcfLiteResult {
  symbol: string;
  currency?: string;
  baseFcf: number | null;
  baseFcfSource?: string | null;
  assumptions: DcfAssumptions;
  projectedFcfs: { year: number; fcf: number | null; discounted: number | null }[];
  discountedFcfs: { year: number; value: number | null }[];
  terminalValue: number | null;
  pvTerminalValue: number | null;
  enterpriseValue: number | null;
  sharesOutstanding: number | null;
  intrinsicValuePerShare: number | null;
  currentPrice: number | null;
  upsideDownsidePct: number | null;
  fairValueRange: { downside: number; upside: number } | null;
  interpretation: string;
  warnings: string[];
  error?: string;
  fetchedAt: string;
}

export function getCurrencySymbol(code?: string): string {
  switch ((code || 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'INR': return '₹';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'GBp': return 'p';
    case 'JPY': return '¥';
    case 'CNY': case 'CNH': return '¥';
    case 'HKD': return 'HK$';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'CHF': return 'CHF ';
    case 'KRW': return '₩';
    case 'SGD': return 'S$';
    case 'BRL': return 'R$';
    default: return `${code} `;
  }
}

export function formatCurrency(n: number | null | undefined, code?: string): string {
  if (n == null || !isFinite(n)) return 'N/A';
  const sym = getCurrencySymbol(code);
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export type ScoreGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-score-excellent';
  if (score >= 65) return 'text-score-good';
  if (score >= 45) return 'text-score-neutral';
  if (score >= 30) return 'text-score-poor';
  return 'text-score-bad';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-score-excellent';
  if (score >= 65) return 'bg-score-good';
  if (score >= 45) return 'bg-score-neutral';
  if (score >= 30) return 'bg-score-poor';
  return 'bg-score-bad';
}
