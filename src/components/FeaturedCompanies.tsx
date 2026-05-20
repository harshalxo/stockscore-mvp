import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { useScore } from '@/hooks/useStockData';
import { Skeleton } from '@/components/ui/skeleton';

const FEATURED = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Social Media' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'E-Commerce' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Auto Manufacturers' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Banking' },
];

function getScoreAccent(score: number) {
  if (score >= 80) return 'border-score-excellent/30 hover:border-score-excellent/60';
  if (score >= 65) return 'border-score-good/30 hover:border-score-good/60';
  if (score >= 45) return 'border-score-neutral/30 hover:border-score-neutral/60';
  return 'border-score-poor/30 hover:border-score-poor/60';
}

function getScoreTextColor(score: number) {
  if (score >= 80) return 'text-score-excellent';
  if (score >= 65) return 'text-score-good';
  if (score >= 45) return 'text-score-neutral';
  return 'text-score-poor';
}

function FeaturedCard({
  symbol,
  name,
  sector,
  index,
}: {
  symbol: string;
  name: string;
  sector: string;
  index: number;
}) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useScore(symbol);

  const score = data?.overallScore ?? null;
  const grade = data?.grade ?? '—';
  const accent = score != null ? getScoreAccent(score) : 'border-border/40';
  const color = score != null ? getScoreTextColor(score) : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Card
        className={`glass-card cursor-pointer transition-all duration-300 group ${accent}`}
        onClick={() => navigate(`/company/${symbol}`)}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="font-mono font-bold text-primary text-sm">{symbol}</span>
              <p className="text-sm text-foreground/80 mt-0.5">{name}</p>
            </div>
            <div className="text-right min-w-[44px]">
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-10 mb-1 ml-auto" />
                  <Skeleton className="h-3 w-6 ml-auto" />
                </>
              ) : isError || score == null ? (
                <>
                  <span className="text-2xl font-bold font-mono text-muted-foreground">—</span>
                  <p className="text-xs text-muted-foreground">N/A</p>
                </>
              ) : (
                <>
                  <span className={`text-2xl font-bold font-mono ${color}`}>{score}</span>
                  <p className={`text-xs font-semibold ${color}`}>{grade}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{sector}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function FeaturedCompanies() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Featured Companies</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FEATURED.map((c, i) => (
          <FeaturedCard key={c.symbol} {...c} index={i} />
        ))}
      </div>
    </section>
  );
}
