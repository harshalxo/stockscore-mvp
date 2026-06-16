import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Activity, Banknote, ListChecks, Rocket, Gauge, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import type { AnnualFinancials } from '@/types/stock';
import { formatCurrency, getScoreColor } from '@/types/stock';
import { getExecutionConfig, type CommitmentStatus } from '@/lib/executionConfig';

interface Props {
  symbol: string;
  annual?: AnnualFinancials[];
  currency?: string;
}

type Dir = 'up' | 'down' | 'flat' | 'na';

function trendOf(vals: (number | null | undefined)[]): Dir {
  const clean = vals.filter((v): v is number => v != null && isFinite(v));
  if (clean.length < 2) return 'na';
  let ups = 0, downs = 0;
  for (let i = 1; i < clean.length; i++) {
    const diff = clean[i] - clean[i - 1];
    const base = Math.abs(clean[i - 1]) || 1;
    const pct = diff / base;
    if (pct > 0.03) ups++; else if (pct < -0.03) downs++;
  }
  if (ups > downs) return 'up';
  if (downs > ups) return 'down';
  return 'flat';
}

function consecutiveIncreases(vals: (number | null | undefined)[]): number {
  const clean = vals.filter((v): v is number => v != null && isFinite(v));
  let streak = 0;
  for (let i = clean.length - 1; i > 0; i--) {
    if (clean[i] > clean[i - 1]) streak++;
    else break;
  }
  return streak;
}

function TrendChip({ label, dir, invert = false }: { label: string; dir: Dir; invert?: boolean }) {
  const good = invert ? dir === 'down' : dir === 'up';
  const bad = invert ? dir === 'up' : dir === 'down';
  const cls = good
    ? 'bg-score-excellent/10 text-score-excellent border-score-excellent/30'
    : bad
    ? 'bg-score-bad/10 text-score-bad border-score-bad/30'
    : dir === 'flat'
    ? 'bg-score-neutral/10 text-score-neutral border-score-neutral/30'
    : 'bg-muted/40 text-muted-foreground border-border/40';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const text =
    dir === 'na' ? 'N/A' : dir === 'flat' ? 'Stable' : invert
      ? dir === 'down' ? 'Improving' : 'Rising'
      : dir === 'up' ? 'Rising' : 'Declining';
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 ${cls}`}>
      <Icon className="h-3 w-3" /> {label}: {text}
    </span>
  );
}

function statusStyle(s: CommitmentStatus | 'Announced' | 'Cancelled') {
  switch (s) {
    case 'Delivered':
      return { cls: 'bg-score-excellent/10 text-score-excellent border-score-excellent/30', Icon: CheckCircle2 };
    case 'In Progress':
    case 'Announced':
      return { cls: 'bg-primary/10 text-primary border-primary/30', Icon: Clock };
    case 'Slipped':
      return { cls: 'bg-score-neutral/10 text-score-neutral border-score-neutral/30', Icon: AlertTriangle };
    case 'Missed':
    case 'Cancelled':
      return { cls: 'bg-score-bad/10 text-score-bad border-score-bad/30', Icon: XCircle };
    default:
      return { cls: 'bg-muted/40 text-muted-foreground border-border/40', Icon: Minus };
  }
}

export default function ExecutionTab({ symbol, annual, currency }: Props) {
  const cfg = getExecutionConfig(symbol);
  const rows = (annual || []).slice().sort((a, b) => a.year - b.year);
  const fmt = (n: number | null | undefined) => formatCurrency(n, currency);

  // Panel 1 — Operating Performance
  const revs = rows.map(r => r.revenue);
  const margins = rows.map(r => (r.netIncome != null && r.revenue && r.revenue !== 0 ? r.netIncome / r.revenue : null));
  const fcfs = rows.map(r => r.freeCf);

  const revDir = trendOf(revs);
  const margDir = trendOf(margins);
  const fcfDir = trendOf(fcfs);
  const revStreak = consecutiveIncreases(revs);

  const opSummary: string[] = [];
  if (revStreak >= 2) opSummary.push(`Revenue increased in ${revStreak} consecutive years.`);
  else if (revDir === 'up') opSummary.push('Revenue has trended higher over the period.');
  else if (revDir === 'down') opSummary.push('Revenue has trended lower over the period.');
  if (margDir === 'up') opSummary.push('Net margins are expanding.');
  else if (margDir === 'down') opSummary.push('Net margins are compressing.');
  else if (margDir === 'flat') opSummary.push('Net margins are stable.');
  if (fcfDir === 'down') opSummary.push('Free cash flow has weakened recently.');
  else if (fcfDir === 'up') opSummary.push('Free cash flow is strengthening.');

  // Panel 2 — Capital Discipline
  const debts = rows.map(r => r.totalDebt);
  const capexAbs = rows.map(r => (r.capex != null ? Math.abs(r.capex) : null));
  const ocfs = rows.map(r => r.operatingCf);
  const debtDir = trendOf(debts);
  const capexDir = trendOf(capexAbs);

  const lastOcf = ocfs[ocfs.length - 1];
  const lastCapex = capexAbs[capexAbs.length - 1];
  const selfFund =
    lastOcf != null && lastCapex != null && lastCapex > 0 ? lastOcf / lastCapex : null;
  let fundLabel: 'Self-funded' | 'Partially self-funded' | 'Externally funded' | 'N/A' = 'N/A';
  let fundCls = 'bg-muted/40 text-muted-foreground border-border/40';
  if (selfFund != null) {
    if (selfFund >= 1.5) { fundLabel = 'Self-funded'; fundCls = 'bg-score-excellent/10 text-score-excellent border-score-excellent/30'; }
    else if (selfFund >= 1.0) { fundLabel = 'Partially self-funded'; fundCls = 'bg-score-neutral/10 text-score-neutral border-score-neutral/30'; }
    else { fundLabel = 'Externally funded'; fundCls = 'bg-score-bad/10 text-score-bad border-score-bad/30'; }
  }

  // Panel 3 — Management Commitments + execution score
  const commitments = cfg?.commitments || [];
  const delivered = commitments.filter(c => c.status === 'Delivered').length;
  const slipped = commitments.filter(c => c.status === 'Slipped').length;
  const missed = commitments.filter(c => c.status === 'Missed').length;
  const inProgress = commitments.filter(c => c.status === 'In Progress').length;
  const decided = delivered + slipped + missed;
  const execScore = decided > 0 ? Math.round((delivered / decided) * 100) : null;
  const deliveryPct = commitments.length > 0 ? Math.round((delivered / commitments.length) * 100) : null;

  const expansion = cfg?.expansion || [];

  return (
    <div className="space-y-6">
      {/* Management Execution Score */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Management Execution Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {execScore == null ? (
            <p className="text-sm text-muted-foreground">
              No tracked commitments configured for {symbol}. Add entries in <code className="font-mono text-xs">src/lib/executionConfig.ts</code> to enable this panel.
            </p>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold font-mono ${getScoreColor(execScore)}`}>{execScore}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="flex-1 space-y-2">
                <Progress value={execScore} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Management has delivered {deliveryPct}% of tracked commitments
                  {inProgress > 0 ? ` (${inProgress} still in progress).` : '.'}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded border border-score-excellent/30 text-score-excellent bg-score-excellent/10">Delivered {delivered}</span>
                  <span className="px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">In Progress {inProgress}</span>
                  <span className="px-2 py-0.5 rounded border border-score-neutral/30 text-score-neutral bg-score-neutral/10">Slipped {slipped}</span>
                  <span className="px-2 py-0.5 rounded border border-score-bad/30 text-score-bad bg-score-bad/10">Missed {missed}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1 — Operating Performance */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Operating Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TrendChip label="Revenue" dir={revDir} />
              <TrendChip label="Net Margin" dir={margDir} />
              <TrendChip label="FCF" dir={fcfDir} />
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No annual data available.</p>
            ) : (
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                {opSummary.length === 0 ? <li>Not enough history to summarize execution.</li> : opSummary.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Panel 2 — Capital Discipline */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" /> Capital Discipline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TrendChip label="Debt" dir={debtDir} invert />
              <TrendChip label="Capex" dir={capexDir} />
            </div>
            <div className="rounded-md border border-border/40 bg-secondary/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Self Funding Ratio (OCF ÷ Capex)</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {selfFund == null ? 'N/A' : `${selfFund.toFixed(2)}×`}
                </span>
              </div>
              <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border ${fundCls}`}>{fundLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-border/40 p-2">
                <div className="text-muted-foreground">Latest OCF</div>
                <div className="font-mono font-semibold text-foreground">{fmt(lastOcf)}</div>
              </div>
              <div className="rounded border border-border/40 p-2">
                <div className="text-muted-foreground">Latest Capex</div>
                <div className="font-mono font-semibold text-foreground">{fmt(lastCapex)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3 — Management Commitments */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Management Commitments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commitments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No commitments configured for {symbol}.
              </p>
            ) : (
              <div className="divide-y divide-border/30">
                {commitments.map((c, i) => {
                  const { cls, Icon } = statusStyle(c.status);
                  return (
                    <div key={i} className="py-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">{c.initiative}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">Promised: {c.promisedDate}</div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 shrink-0 ${cls}`}>
                        <Icon className="h-3 w-3" /> {c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel 4 — Future Growth Initiatives */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Future Growth Initiatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expansion.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expansion plans configured for {symbol}.
              </p>
            ) : (
              <div className="divide-y divide-border/30">
                {expansion.map((e, i) => {
                  const { cls, Icon } = statusStyle(e.status);
                  return (
                    <div key={i} className="py-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">{e.initiative}</div>
                        <div className="text-[11px] text-muted-foreground font-mono flex flex-wrap gap-x-3">
                          {e.investment && <span>Investment: {e.investment}</span>}
                          {e.targetQuarter && <span>Target: {e.targetQuarter}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 shrink-0 ${cls}`}>
                        <Icon className="h-3 w-3" /> {e.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground/70 italic">
        Commitments and expansion entries are curated config. Add or edit them in <code className="font-mono">src/lib/executionConfig.ts</code>.
      </p>
    </div>
  );
}
