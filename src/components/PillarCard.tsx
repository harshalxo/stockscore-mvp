import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getScoreColor, getScoreBgColor } from '@/types/stock';
import type { ScorePillar } from '@/types/stock';

interface PillarCardProps {
  pillar: ScorePillar;
  index: number;
}

const PILLAR_TO_CATEGORY: Record<string, string> = {
  quality: 'quality',
  growth: 'growth',
  'cash flow': 'cash-flow',
  cashflow: 'cash-flow',
  risk: 'risk',
  valuation: 'valuation',
};

export default function PillarCard({ pillar, index }: PillarCardProps) {
  const colorClass = getScoreColor(pillar.score);
  const bgClass = getScoreBgColor(pillar.score);
  const { symbol } = useParams<{ symbol: string }>();
  const catSlug = PILLAR_TO_CATEGORY[pillar.name.toLowerCase()] || '';
  const academyHref = `/academy${symbol ? `?symbol=${symbol}` : ''}${catSlug ? `#cat-${catSlug}` : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="glass-card hover:glow-border transition-all duration-300 group">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-foreground/80">{pillar.name}</h4>
            <span className={`text-lg font-bold font-mono ${colorClass}`}>{pillar.grade}</span>
          </div>
          <div className="mb-3">
            <div className="flex items-end gap-2 mb-1.5">
              <span className={`text-2xl font-bold font-mono ${colorClass}`}>{pillar.score}</span>
              <span className="text-xs text-muted-foreground mb-1">/100</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${bgClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${pillar.score}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{pillar.details}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">Weight: {(pillar.weight * 100).toFixed(0)}%</span>
            <Link
              to={academyHref}
              className="inline-flex items-center gap-1 text-primary/80 hover:text-primary transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              Learn
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
