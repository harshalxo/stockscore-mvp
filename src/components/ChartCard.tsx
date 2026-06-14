import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/types/stock';

export type ChartPoint = { year: number; value: number | null };

export type TrendDirection = 'Improving' | 'Stable' | 'Deteriorating' | 'N/A';

interface ChartCardProps {
  title: string;
  data: ChartPoint[]; // chronological order (oldest → latest)
  currency?: string;
  color?: string; // hsl color
  invertTrend?: boolean; // true when higher = worse (e.g. Debt, Capex)
}

function yoy(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || !isFinite(curr) || !isFinite(prev) || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

function computeTrend(data: ChartPoint[], invert = false): TrendDirection {
  const vals = data.filter(d => d.value != null).map(d => d.value as number);
  if (vals.length < 2) return 'N/A';
  let ups = 0, downs = 0;
  for (let i = 1; i < vals.length; i++) {
    const diff = vals[i] - vals[i - 1];
    const base = Math.abs(vals[i - 1]) || 1;
    const pct = diff / base;
    if (pct > 0.03) ups++; else if (pct < -0.03) downs++;
  }
  const net = ups - downs;
  if (net === 0) return 'Stable';
  const improving = invert ? net < 0 : net > 0;
  return improving ? 'Improving' : 'Deteriorating';
}

function trendStyle(t: TrendDirection) {
  switch (t) {
    case 'Improving': return { cls: 'bg-score-excellent/10 text-score-excellent border-score-excellent/30', Icon: TrendingUp };
    case 'Deteriorating': return { cls: 'bg-score-bad/10 text-score-bad border-score-bad/30', Icon: TrendingDown };
    case 'Stable': return { cls: 'bg-score-neutral/10 text-score-neutral border-score-neutral/30', Icon: Minus };
    default: return { cls: 'bg-muted/40 text-muted-foreground border-border/40', Icon: Minus };
  }
}

function summarize(title: string, data: ChartPoint[], invert = false): string {
  const valid = data.filter(d => d.value != null);
  if (valid.length < 2) return `Not enough history to summarize ${title}.`;
  let increases = 0;
  for (let i = 1; i < valid.length; i++) {
    if ((valid[i].value as number) > (valid[i - 1].value as number)) increases++;
  }
  const transitions = valid.length - 1;
  const direction = invert ? 'decreased' : 'increased';
  const count = invert ? transitions - increases : increases;
  const latest = valid[valid.length - 1];
  const first = valid[0];
  const totalPct = yoy(latest.value, first.value);
  const totalTxt = totalPct == null ? '' : ` Net change over the period: ${(totalPct * 100).toFixed(1)}%.`;
  return `${title} ${direction} in ${count} of the last ${transitions} year${transitions === 1 ? '' : 's'}.${totalTxt}`;
}

function CustomTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint & { yoyPct: number | null };
  const yoyPct = p.yoyPct;
  const dir = yoyPct == null ? '—' : yoyPct > 0 ? '▲' : yoyPct < 0 ? '▼' : '–';
  const dirCls = yoyPct == null ? 'text-muted-foreground' : yoyPct > 0 ? 'text-score-excellent' : yoyPct < 0 ? 'text-score-bad' : 'text-muted-foreground';
  return (
    <div className="rounded-md border border-border/40 bg-card/95 backdrop-blur-md px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-muted-foreground mb-1">FY {p.year}</div>
      <div className="font-mono font-semibold text-foreground">{formatCurrency(p.value, currency)}</div>
      <div className={`font-mono mt-0.5 ${dirCls}`}>
        {dir} YoY {yoyPct == null ? 'N/A' : `${(yoyPct * 100).toFixed(1)}%`}
      </div>
    </div>
  );
}

export default function ChartCard({ title, data, currency, color = 'hsl(190, 95%, 55%)', invertTrend = false }: ChartCardProps) {
  const enriched = data.map((d, i) => ({
    ...d,
    yoyPct: i === 0 ? null : yoy(d.value, data[i - 1].value),
  }));
  const trend = computeTrend(data, invertTrend);
  const { cls, Icon } = trendStyle(trend);
  const summary = summarize(title, data, invertTrend);
  const allNull = data.every(d => d.value == null);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 ${cls}`}>
            <Icon className="h-3 w-3" /> {trend}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {allNull ? (
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">Not available</div>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enriched} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="hsl(220, 18%, 18%)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => {
                    const a = Math.abs(v);
                    if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
                    if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                    if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                    return `${v}`;
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(220, 18%, 30%)" />
                <Tooltip cursor={{ fill: 'hsl(220, 18%, 18%, 0.4)' }} content={<CustomTooltip currency={currency} />} />
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed">{summary}</p>
      </CardContent>
    </Card>
  );
}
