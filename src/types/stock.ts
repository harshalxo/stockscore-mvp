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
  lastUpdated: string;
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
