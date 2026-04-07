import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { getScoreColor, getScoreBgColor } from '@/types/stock';
import type { ScorePillar } from '@/types/stock';

interface PillarCardProps {
  pillar: ScorePillar;
  index: number;
}

export default function PillarCard({ pillar, index }: PillarCardProps) {
  const colorClass = getScoreColor(pillar.score);
  const bgClass = getScoreBgColor(pillar.score);

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
          <div className="mt-2 text-xs text-muted-foreground/60">
            Weight: {(pillar.weight * 100).toFixed(0)}%
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
