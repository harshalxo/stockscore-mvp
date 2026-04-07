import { supabase } from '@/integrations/supabase/client';
import type { SearchResult, CompanyOverview, Fundamentals, PriceData, StockScore } from '@/types/stock';

async function callStockData<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action, ...params },
  });

  if (error) throw new Error(error.message || 'Failed to fetch stock data');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const stockApi = {
  search: (query: string) => callStockData<SearchResult[]>('search', { query }),
  overview: (symbol: string) => callStockData<CompanyOverview>('overview', { symbol }),
  fundamentals: (symbol: string) => callStockData<Fundamentals>('fundamentals', { symbol }),
  prices: (symbol: string) => callStockData<PriceData>('prices', { symbol }),
  score: (symbol: string) => callStockData<StockScore>('score', { symbol }),
};
