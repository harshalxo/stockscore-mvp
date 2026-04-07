import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low';
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = {
    high: { icon: ShieldCheck, label: 'High Confidence', className: 'bg-score-excellent/15 text-score-excellent border-score-excellent/30' },
    medium: { icon: Shield, label: 'Medium Confidence', className: 'bg-score-neutral/15 text-score-neutral border-score-neutral/30' },
    low: { icon: ShieldAlert, label: 'Low Confidence', className: 'bg-score-poor/15 text-score-poor border-score-poor/30' },
  };
  const { icon: Icon, label, className } = config[confidence];

  return (
    <Badge variant="outline" className={`gap-1.5 px-3 py-1 ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
