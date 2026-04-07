import { motion } from 'framer-motion';
import { getScoreColor } from '@/types/stock';

interface ScoreGaugeProps {
  score: number;
  grade: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreGauge({ score, grade, size = 'lg' }: ScoreGaugeProps) {
  const dims = { sm: 80, md: 120, lg: 180 };
  const s = dims[size];
  const stroke = size === 'lg' ? 10 : size === 'md' ? 8 : 6;
  const r = (s - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;

  const colorClass = getScoreColor(score);
  const strokeColor = score >= 80 ? 'hsl(142, 70%, 50%)' : score >= 65 ? 'hsl(160, 65%, 48%)' : score >= 45 ? 'hsl(45, 90%, 55%)' : score >= 30 ? 'hsl(20, 85%, 55%)' : 'hsl(0, 72%, 55%)';

  return (
    <div className="relative inline-flex items-center justify-center score-ring">
      <svg width={s} height={s} className="-rotate-90">
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="hsl(220, 18%, 18%)" strokeWidth={stroke} />
        <motion.circle
          cx={s / 2} cy={s / 2} r={r} fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`font-bold font-mono ${colorClass} ${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-lg'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className={`font-semibold text-muted-foreground ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{grade}</span>
      </div>
    </div>
  );
}
