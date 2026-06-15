import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Info, FlaskConical, TrendingDown, TrendingUp, Equal, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDcf, useFundamentals } from '@/hooks/useStockData';
import { formatCurrency, getCurrencySymbol, type DcfAssumptions, type DcfLiteResult } from '@/types/stock';

interface LabAssumptions {
  revenueGrowth: number;
  fcfGrowth: number;
  discountRate: number;
  terminalGrowth: number;
}

const DEFAULTS: LabAssumptions = {
  revenueGrowth: 0.07,
  fcfGrowth: 0.06,
  discountRate: 0.10,
  terminalGrowth: 0.025,
};

const FORECAST_YEARS = 5;
const SAFETY_MARGIN = 0.15;

function pct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

interface ScenarioResult {
  projectedFcfs: number[];
  pvFcfs: number[];
  pvFcfSum: number;
  terminalValue: number | null;
  pvTerminalValue: number | null;
  enterpriseValue: number | null;
  netDebt: number | null;
  equityValue: number | null;
  intrinsicValuePerShare: number | null;
  upsideDownsidePct: number | null;
  interpretation: string;
  fairValueRange: { low: number; high: number } | null;
  warnings: string[];
}

function computeScenario(
  base: DcfLiteResult,
  netDebt: number | null,
  a: LabAssumptions,
): ScenarioResult {
  const warnings: string[] = [];
  const baseFcf = base.baseFcf;
  const shares = base.sharesOutstanding;
  const price = base.currentPrice;

  // Effective growth blends revenue growth with FCF growth (pedagogical link
  // between top-line and cash-flow trajectory).
  const effectiveGrowth = (a.revenueGrowth + a.fcfGrowth) / 2;

  const projectedFcfs: number[] = [];
  const pvFcfs: number[] = [];
  let pvSum = 0;
  let last = 0;

  if (baseFcf == null || baseFcf <= 0) {
    warnings.push('Base FCF is missing or non-positive — valuation is not meaningful.');
  }
  if (a.discountRate <= a.terminalGrowth) {
    warnings.push('Discount rate must exceed terminal growth for the model to converge.');
  }

  for (let t = 1; t <= FORECAST_YEARS; t++) {
    const fcf = (baseFcf ?? 0) * Math.pow(1 + effectiveGrowth, t);
    const pv = fcf / Math.pow(1 + a.discountRate, t);
    projectedFcfs.push(fcf);
    pvFcfs.push(pv);
    pvSum += pv;
    last = fcf;
  }

  const tvOk = a.discountRate > a.terminalGrowth && baseFcf != null && baseFcf > 0;
  const terminalValue = tvOk ? (last * (1 + a.terminalGrowth)) / (a.discountRate - a.terminalGrowth) : null;
  const pvTerminalValue = terminalValue == null ? null : terminalValue / Math.pow(1 + a.discountRate, FORECAST_YEARS);
  const enterpriseValue = pvTerminalValue == null ? null : pvSum + pvTerminalValue;
  const equityValue = enterpriseValue == null ? null : enterpriseValue - (netDebt ?? 0);
  const intrinsicValuePerShare =
    equityValue != null && shares != null && shares > 0 ? equityValue / shares : null;
  const upsideDownsidePct =
    intrinsicValuePerShare != null && price != null && price > 0
      ? (intrinsicValuePerShare - price) / price
      : null;

  const fairValueRange =
    intrinsicValuePerShare != null
      ? { low: intrinsicValuePerShare * (1 - SAFETY_MARGIN), high: intrinsicValuePerShare * (1 + SAFETY_MARGIN) }
      : null;

  let interpretation = 'Insufficient data to estimate fair value.';
  if (intrinsicValuePerShare != null && price != null && fairValueRange) {
    if (price < fairValueRange.low) interpretation = 'Appears below estimated fair value.';
    else if (price > fairValueRange.high) interpretation = 'Appears above estimated fair value.';
    else interpretation = 'Appears near estimated fair value.';
  }

  return {
    projectedFcfs,
    pvFcfs,
    pvFcfSum: pvSum,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    netDebt,
    equityValue,
    intrinsicValuePerShare,
    upsideDownsidePct,
    interpretation,
    fairValueRange,
    warnings,
  };
}

export default function ValuationLabTab({ symbol }: { symbol: string }) {
  const [a, setA] = useState<LabAssumptions>(DEFAULTS);
  const { data: base, isLoading, isError, error } = useDcf(symbol);
  const { data: fundamentals } = useFundamentals(symbol);

  const netDebt = useMemo(() => {
    if (!fundamentals) return null;
    const d = fundamentals.totalDebt;
    const c = fundamentals.totalCash;
    if (d == null && c == null) return null;
    return (d ?? 0) - (c ?? 0);
  }, [fundamentals]);

  const baseScenario = useMemo(() => (base ? computeScenario(base, netDebt, a) : null), [base, netDebt, a]);
  const bearScenario = useMemo(
    () =>
      base
        ? computeScenario(base, netDebt, {
            ...a,
            revenueGrowth: a.revenueGrowth - 0.02,
            fcfGrowth: a.fcfGrowth - 0.02,
            discountRate: a.discountRate + 0.02,
          })
        : null,
    [base, netDebt, a],
  );
  const bullScenario = useMemo(
    () =>
      base
        ? computeScenario(base, netDebt, {
            ...a,
            revenueGrowth: a.revenueGrowth + 0.02,
            fcfGrowth: a.fcfGrowth + 0.02,
            discountRate: a.discountRate - 0.02,
          })
        : null,
    [base, netDebt, a],
  );

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6"><div className="h-64 shimmer rounded-lg" /></CardContent>
      </Card>
    );
  }
  if (isError || !base) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Valuation Lab unavailable</AlertTitle>
        <AlertDescription>{(error as Error)?.message || 'Could not load valuation data.'}</AlertDescription>
      </Alert>
    );
  }

  const r = baseScenario!;
  const currency = base.currency || 'USD';
  const cSym = getCurrencySymbol(currency);
  const fmt = (n: number | null | undefined) => formatCurrency(n, currency);
  const fmtPrice = (n: number | null | undefined) =>
    n == null || !isFinite(n) ? 'N/A' : `${cSym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const upside = r.upsideDownsidePct;
  const upPositive = upside != null && upside > 0;
  const upClose = upside != null && Math.abs(upside) < 0.05;
  const UpsideIcon = upClose ? Equal : upPositive ? TrendingUp : TrendingDown;
  const upsideColor = upClose ? 'text-score-neutral' : upPositive ? 'text-score-excellent' : 'text-score-bad';

  // Waterfall: pv-fcf, pv-terminal, enterprise total, -net debt, equity total
  const pvFcfTotal = r.pvFcfSum;
  const pvTv = r.pvTerminalValue ?? 0;
  const ev = r.enterpriseValue ?? 0;
  const nd = r.netDebt ?? 0;
  const eq = r.equityValue ?? 0;

  // Build floating-bar waterfall: [base, value] per step; positives go up, negatives go down.
  const waterfall = [
    { name: 'PV of Forecast FCF', base: 0, value: pvFcfTotal, kind: 'add' as const, total: pvFcfTotal },
    { name: 'PV of Terminal Value', base: pvFcfTotal, value: pvTv, kind: 'add' as const, total: pvFcfTotal + pvTv },
    { name: 'Enterprise Value', base: 0, value: ev, kind: 'total' as const, total: ev },
    { name: '− Net Debt', base: ev - Math.max(nd, 0), value: -nd, kind: nd >= 0 ? 'sub' as const : 'add' as const, total: ev - nd },
    { name: 'Equity Value', base: 0, value: eq, kind: 'total' as const, total: eq },
  ].map((d) => ({
    ...d,
    // Recharts stacks: lower (invisible) + bar
    lower: d.value >= 0 ? d.base : d.base + d.value,
    bar: Math.abs(d.value),
  }));

  const colorFor = (kind: 'add' | 'sub' | 'total') =>
    kind === 'total' ? 'hsl(var(--primary))' : kind === 'add' ? 'hsl(var(--score-excellent))' : 'hsl(var(--score-bad))';

  // Range chart
  const rangeData = [
    { name: 'Bear', value: bearScenario?.intrinsicValuePerShare ?? 0, color: 'hsl(var(--score-bad))' },
    { name: 'Base', value: r.intrinsicValuePerShare ?? 0, color: 'hsl(var(--primary))' },
    { name: 'Bull', value: bullScenario?.intrinsicValuePerShare ?? 0, color: 'hsl(var(--score-excellent))' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header / disclaimer */}
      <Alert>
        <FlaskConical className="h-4 w-4" />
        <AlertTitle>Valuation Lab — experiment with assumptions (Educational)</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          Move the sliders to see how a few key assumptions change the estimated fair value.
          This is the same simplified DCF Lite model — <strong>not</strong> a full institutional DCF and <strong>not</strong> investment advice.
        </AlertDescription>
      </Alert>

      {/* Sliders */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Assumptions</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setA(DEFAULTS)}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          <SliderRow
            label="Revenue Growth"
            value={a.revenueGrowth}
            min={-0.05} max={0.30} step={0.005}
            onChange={(v) => setA((p) => ({ ...p, revenueGrowth: v }))}
          />
          <SliderRow
            label="FCF Growth"
            value={a.fcfGrowth}
            min={-0.05} max={0.30} step={0.005}
            onChange={(v) => setA((p) => ({ ...p, fcfGrowth: v }))}
          />
          <SliderRow
            label="Discount Rate (WACC proxy)"
            value={a.discountRate}
            min={0.04} max={0.20} step={0.0025}
            onChange={(v) => setA((p) => ({ ...p, discountRate: v }))}
          />
          <SliderRow
            label="Terminal Growth"
            value={a.terminalGrowth}
            min={0} max={0.05} step={0.0025}
            onChange={(v) => setA((p) => ({ ...p, terminalGrowth: v }))}
          />
          <p className="md:col-span-2 text-[11px] text-muted-foreground/80 leading-relaxed">
            Forecast horizon is fixed at {FORECAST_YEARS} years. Effective growth applied to base FCF is the
            average of revenue and FCF growth — a simplification that ties top-line and cash-flow trajectories together.
          </p>
        </CardContent>
      </Card>

      {/* Intrinsic value card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Intrinsic Value / Share</p>
            <p className="text-2xl font-bold font-mono text-foreground">{fmtPrice(r.intrinsicValuePerShare)}</p>
            {r.fairValueRange && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Range ±{(SAFETY_MARGIN * 100).toFixed(0)}%: {fmtPrice(r.fairValueRange.low)} — {fmtPrice(r.fairValueRange.high)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Current Price</p>
            <p className="text-2xl font-bold font-mono text-foreground">{fmtPrice(base.currentPrice)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Upside / Downside</p>
            <p className={`text-2xl font-bold font-mono flex items-center gap-2 ${upsideColor}`}>
              <UpsideIcon className="h-5 w-5" />
              {upside == null ? 'N/A' : `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%`}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{r.interpretation}</p>
          </CardContent>
        </Card>
      </div>

      {/* Waterfall */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">DCF Waterfall — from Cash Flows to Equity Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall} margin={{ top: 10, right: 16, left: 8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(_v, _n, item: { payload?: { value?: number } }) => [fmt(item.payload?.value ?? 0), 'Value']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="lower" stackId="w" fill="transparent" />
                <Bar dataKey="bar" stackId="w" radius={[4, 4, 0, 0]}>
                  {waterfall.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.kind)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-xs">
            <Stat label="PV of Forecast FCF" value={fmt(pvFcfTotal)} />
            <Stat label="PV of Terminal Value" value={fmt(pvTv)} />
            <Stat label="Enterprise Value" value={fmt(ev)} accent />
            <Stat label="Net Debt" value={netDebt == null ? 'N/A' : fmt(nd)} />
            <Stat label="Equity Value" value={fmt(eq)} accent />
          </div>
        </CardContent>
      </Card>

      {/* Valuation range */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Scenario Range — Bear / Base / Bull</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeData} margin={{ top: 10, right: 16, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => fmtPrice(v)} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [fmtPrice(v), 'Intrinsic Value / Share']}
                />
                {base.currentPrice != null && (
                  <ReferenceLine
                    y={base.currentPrice}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    label={{ value: `Current ${fmtPrice(base.currentPrice)}`, position: 'right', fill: 'hsl(var(--primary))', fontSize: 11 }}
                  />
                )}
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {rangeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
            <ScenarioCard title="Bear" tone="bad" iv={bearScenario?.intrinsicValuePerShare} interpretation={bearScenario?.interpretation} fmt={fmtPrice} note="Growth −2pp · Discount +2pp" />
            <ScenarioCard title="Base" tone="primary" iv={r.intrinsicValuePerShare} interpretation={r.interpretation} fmt={fmtPrice} note="Current assumptions" />
            <ScenarioCard title="Bull" tone="good" iv={bullScenario?.intrinsicValuePerShare} interpretation={bullScenario?.interpretation} fmt={fmtPrice} note="Growth +2pp · Discount −2pp" />
          </div>
        </CardContent>
      </Card>

      {/* Limitations */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Limitations of this lab</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5 text-xs space-y-1 mt-1 leading-relaxed">
            <li>This is DCF Lite — a simplified, transparent model, not a full institutional DCF.</li>
            <li>Output is extremely sensitive to small changes in growth and discount rate.</li>
            <li>Base FCF is taken from the most recent fundamentals available ({base.baseFcfSource || 'unknown source'}) and may be distorted by one-off items.</li>
            <li>Net debt uses total debt minus total cash from the latest filing; off-balance-sheet items are ignored.</li>
            <li>Bear/Base/Bull use a fixed ±2pp shift — real scenario analysis requires industry context.</li>
            <li>No tax, working capital, or share-dilution adjustments are modelled.</li>
            <li>This tool is for educational analysis only and is not investment advice.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {(r.warnings.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data caveats</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 text-xs space-y-1 mt-1">
              {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </motion.div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{pct(value, 2)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/70 font-mono">
        <span>{pct(min, 0)}</span>
        <span>{pct(max, 0)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm ${accent ? 'text-primary font-semibold' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function ScenarioCard({
  title, tone, iv, interpretation, fmt, note,
}: {
  title: string;
  tone: 'bad' | 'primary' | 'good';
  iv: number | null | undefined;
  interpretation?: string;
  fmt: (n: number | null | undefined) => string;
  note: string;
}) {
  const toneClass =
    tone === 'good' ? 'border-score-excellent/40 text-score-excellent'
    : tone === 'bad' ? 'border-score-bad/40 text-score-bad'
    : 'border-primary/40 text-primary';
  return (
    <div className={`rounded-lg border ${toneClass} bg-secondary/20 p-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-muted-foreground">{note}</span>
      </div>
      <div className="font-mono text-lg text-foreground">{fmt(iv ?? null)}</div>
      {interpretation && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{interpretation}</div>}
    </div>
  );
}
