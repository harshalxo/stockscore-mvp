import { useQuery } from '@tanstack/react-query';
import { stockApi } from '@/lib/api';
import type { DcfAssumptions } from '@/types/stock';


export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => stockApi.search(query),
    enabled: query.length >= 1,
    staleTime: 60_000,
  });
}

export function useOverview(symbol: string) {
  return useQuery({
    queryKey: ['overview', symbol],
    queryFn: () => stockApi.overview(symbol),
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

export function useFundamentals(symbol: string) {
  return useQuery({
    queryKey: ['fundamentals', symbol],
    queryFn: () => stockApi.fundamentals(symbol),
    enabled: !!symbol,
    staleTime: 5 * 60_000,
  });
}

export function usePrices(symbol: string) {
  return useQuery({
    queryKey: ['prices', symbol],
    queryFn: () => stockApi.prices(symbol),
    enabled: !!symbol,
    staleTime: 60_000,
  });
}

export function useScore(symbol: string) {
  return useQuery({
    queryKey: ['score', symbol],
    queryFn: () => stockApi.score(symbol),
    enabled: !!symbol,
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: 1,
  });
}
