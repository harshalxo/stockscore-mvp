import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/useStockData';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  large?: boolean;
}

export default function SearchBar({ large = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { data: results, isLoading } = useSearch(query);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (symbol: string) => {
    setQuery('');
    setOpen(false);
    navigate(`/company/${symbol}`);
  };

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <div className={`relative ${large ? 'group' : ''}`}>
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${large ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search companies by name or ticker..."
          className={`pl-12 bg-secondary border-border/50 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-primary/20 transition-all ${large ? 'h-14 text-base rounded-xl glow-border' : 'h-10 text-sm'}`}
        />
      </div>

      <AnimatePresence>
        {open && query.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 mt-2 w-full rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-16 shimmer rounded" />
                    <div className="h-4 w-40 shimmer rounded" />
                  </div>
                ))}
              </div>
            ) : results && results.length > 0 ? (
              <ul className="py-2">
                {results.map((r) => (
                  <li key={r.symbol}>
                    <button
                      onClick={() => handleSelect(r.symbol)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/80 transition-colors text-left"
                    >
                      <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-mono font-semibold text-primary text-sm">{r.symbol}</span>
                      <span className="text-sm text-foreground/80 truncate">{r.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{r.exchange}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No results found for "{query}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
