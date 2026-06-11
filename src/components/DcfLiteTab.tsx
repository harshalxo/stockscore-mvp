import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, Calculator, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { useDcf } from '@/hooks/useStockData';
import { formatCurrency, getCurrencySymbol, type DcfAssumptions, type DcfLiteResult } from '@/types/stock';

const DEFAULTS: DcfAssumptions = {
  forecastYears: 5,
  fcfGrowthRate: 0.06,
  discountRate: 0.10,
  terminalGrowthRate: 0.025,
  safetyMargin: 0.15,
};

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return 'N/A';
  return `${(n * 100).toFixed(digits)}%`;
}

// Client-side recompute using backend base data, so assumption sliders react instantly.
function recompute(base: DcfLiteResult, a: DcfAssumptions): DcfLiteResult {
  const baseFcf = base.baseFcf;
  const sharesOutstanding = base.sharesOutstanding;
  const currentPrice = base.currentPrice;
  const warnings: string[] = [];

  if (a.discountRate <= a.terminalGrowthRate) {
    return {
      ...base,
      assumptions: a,
      error: 'Validation error: discount rate must be greater than terminal growth rate.',
      warnings,
    };
  }
  if (baseFcf == null) warnings.push('Free Cash Flow could not be determined from available data.');
  if (sharesOutstanding == null) warnings.push('Shares outstanding unavailable — per-share intrinsic value cannot be computed.');
  if (currentPrice == null) warnings.push('Current price unavailable — upside/downside cannot be computed.');
  if (baseFcf != null && baseFcf < 0) warnings.push('Base Free Cash Flow is negative. Treat the valuation as not meaningful.');

  const projectedFcfs: { year: number; fcf: number | null; discounted: number | null }[] = [];
  let pvSum = 0;
  let last: number | null = null;
  for (let t = 1; t <= a.forecastYears; t++) {
    const proj = baseFcf == null ? null : baseFcf * Math.pow(1 + a.fcfGrowthRate, t);
    const disc = proj == null ? null : proj / Math.pow(1 + a.discountRate, t);
    if (disc != null) pvSum += disc;
    if (proj != null) last = proj;
    projectedFcfs.push({ year: t, fcf: proj, discounted: disc });
  }
  const terminalValue = last == null ? null : (last * (1 + a.terminalGrowthRate)) / (a.discountRate - a.terminalGrowthRate);
  const pvTerminalValue = terminalValue == null ? null : terminalValue / Math.pow(1 + a.discountRate, a.forecastYears);
  const enterpriseValue = (last != null && pvTerminalValue != null) ? pvSum + pvTerminalValue : null;
  const safe = baseFcf != null && baseFcf > 0 && sharesOutstanding != null && sharesOutstanding > 0 && enterpriseValue != null;
  const ivps = safe ? (enterpriseValue as number) / (sharesOutstanding as number) : null;
  const upside = (ivps != null && currentPrice != null && currentPrice > 0) ? (ivps - currentPrice) / currentPrice : null;
  const range = ivps == null ? null : { downside: ivps * (1 - a.safetyMargin), upside: ivps * (1 + a.safetyMargin) };

  let interpretation = 'Insufficient data to estimate fair value.';
  if (ivps != null && currentPrice != null && range) {
    if (currentPrice < range.downside) interpretation = 'Appears below estimated fair value range. Valuation depends heavily on assumptions.';
    else if (currentPrice > range.upside) interpretation = 'Appears above estimated fair value range. Valuation depends heavily on assumptions.';
    else interpretation = 'Appears within the estimated fair value range. Valuation depends heavily on assumptions.';
  }

  return {
    ...base,
    assumptions: a,
    projectedFcfs,
    discountedFcfs: projectedFcfs.map((p) => ({ year: p.year, value: p.discounted })),
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    intrinsicValuePerShare: ivps,
    upsideDownsidePct: upside,
    fairValueRange: range,
    interpretation,
    warnings,
    error: undefined,
  };
}

export default function DcfLiteTab({ symbol }: { symbol: string }) {
  const [a, setA] = useState<DcfAssumptions>(DEFAULTS);
  const { data, isLoading, isError, error, refetch } = useDcf(symbol);

  const result = useMemo(() => (data ? recompute(data, a) : null), [data, a]);

  if (isLoading) {
    return (
      <Card className="glass-card"><CardContent className="p-6"><div className="h-64 shimmer rounded-lg" /></CardContent></Card>
    );
  }
  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>DCF Lite unavailable</AlertTitle>
        <AlertDescription>{(error as Error)?.message || 'Could not load DCF data.'}</AlertDescription>
      </Alert>
    );
  }

  const r = result!;
  const currency = r.currency || 'USD';
  const cSym = getCurrencySymbol(currency);
  const fmt = (n: number | null | undefined) => formatCurrency(n, currency);
  const fmtPrice = (n: number | null | undefined) =>
    n == null || !isFinite(n) ? 'N/A' : `${cSym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const upside = r.upsideDownsidePct;
  const upPositive = upside != null && upside > 0;
  const upClose = upside != null && Math.abs(upside) < 0.05;
  const UpsideIcon = upClose ? Equal : upPositive ? TrendingUp : TrendingDown;
  const upsideColor = upClose ? 'text-score-neutral' : upPositive ? 'text-score-excellent' : 'text-score-bad';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Disclaimer */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>DCF Lite — Basic Fair Value Estimate (Educational)</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          This is a simplified, transparent discounted-cash-flow estimate — <strong>not</strong> a full institutional DCF, investment advice, or a buy/sell signal.
          Output is highly sensitive to the assumptions below. Change any input to see how the fair value moves.
        </AlertDescription>
      </Alert>

      {r.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation error</AlertTitle>
          <AlertDescription>{r.error}</AlertDescription>
        </Alert>
      )}

      {/* Headline metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Intrinsic Value / Share</p>
            <p className="text-2xl font-bold font-mono text-foreground">{fmtPrice(r.intrinsicValuePerShare)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Current Price</p>
            <p className="text-2xl font-bold font-mono text-foreground">{fmtPrice(r.currentPrice)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Upside / Downside</p>
            <p className={`text-2xl font-bold font-mono flex items-center gap-2 ${upsideColor}`}>
              <UpsideIcon className="h-5 w-5" />
              {upside == null ? 'N/A' : `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Fair Value Range (±{(a.safetyMargin * 100).toFixed(0)}%)</p>
            <p className="text-base font-bold font-mono text-foreground">
              {r.fairValueRange ? `${fmtPrice(r.fairValueRange.downside)} — ${fmtPrice(r.fairValueRange.upside)}` : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <p className="text-sm text-foreground leading-relaxed">
            <Calculator className="h-4 w-4 inline mr-2 text-primary" />
            {r.interpretation}
          </p>
        </CardContent>
      </Card>

      {/* Warnings */}
      {r.warnings && r.warnings.length > 0 && (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assumptions editor */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {([
              { key: 'fcfGrowthRate', label: 'FCF Growth Rate (annual)', step: 0.005, isPct: true },
              { key: 'discountRate', label: 'Discount Rate (WACC proxy)', step: 0.005, isPct: true },
              { key: 'terminalGrowthRate', label: 'Terminal Growth Rate', step: 0.005, isPct: true },
              { key: 'safetyMargin', label: 'Safety Margin (range ± %)', step: 0.01, isPct: true },
              { key: 'forecastYears', label: 'Forecast Years', step: 1, isPct: false },
            ] as const).map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {f.label}: <span className="font-mono text-foreground">{f.isPct ? pct(a[f.key], 2) : a[f.key]}</span>
                </Label>
                <Input
                  type="number"
                  step={f.step}
                  value={f.isPct ? (a[f.key] as number) : a[f.key]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isFinite(v)) return;
                    setA((prev) => ({ ...prev, [f.key]: v }));
                  }}
                  className="h-9 font-mono text-sm"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setA(DEFAULTS)}>Reset defaults</Button>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>Refresh data</Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2">
              Recomputation runs instantly in your browser using the base FCF returned by the backend
              ({r.baseFcfSource || 'computed from latest filings'}: {fmt(r.baseFcf)}).
            </p>
          </CardContent>
        </Card>

        {/* Projected FCF table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Projected & Discounted FCF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 font-medium">Year</th>
                    <th className="text-right py-2 font-medium">Projected FCF</th>
                    <th className="text-right py-2 font-medium">PV @ {pct(a.discountRate, 1)}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.projectedFcfs.map((p) => (
                    <tr key={p.year} className="border-b border-border/20 last:border-0">
                      <td className="py-2 font-mono">+{p.year}</td>
                      <td className="py-2 text-right font-mono">{fmt(p.fcf)}</td>
                      <td className="py-2 text-right font-mono text-foreground">{fmt(p.discounted)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-xs">
                  <tr>
                    <td className="pt-3 text-muted-foreground">Terminal Value</td>
                    <td className="pt-3 text-right font-mono text-muted-foreground">{fmt(r.terminalValue)}</td>
                    <td className="pt-3 text-right font-mono text-foreground">{fmt(r.pvTerminalValue)}</td>
                  </tr>
                  <tr>
                    <td className="pt-2 font-semibold text-foreground">Enterprise Value</td>
                    <td></td>
                    <td className="pt-2 text-right font-mono font-semibold text-primary">{fmt(r.enterpriseValue)}</td>
                  </tr>
                  <tr>
                    <td className="pt-1 text-muted-foreground">Shares Outstanding</td>
                    <td></td>
                    <td className="pt-1 text-right font-mono text-muted-foreground">
                      {r.sharesOutstanding ? r.sharesOutstanding.toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formula transparency */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">How DCF Lite is computed</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <pre className="font-mono bg-secondary/50 rounded-lg p-3 whitespace-pre-wrap text-foreground/80 overflow-x-auto">
{`projectedFCF_t   = baseFCF × (1 + fcfGrowthRate)^t
presentValue_t   = projectedFCF_t / (1 + discountRate)^t
terminalValue    = projectedFCF_year_N × (1 + terminalGrowth) / (discountRate − terminalGrowth)
pvTerminalValue  = terminalValue / (1 + discountRate)^N
enterpriseValue  = Σ presentValue_t  +  pvTerminalValue
intrinsicValue   = enterpriseValue / sharesOutstanding
fairValueRange   = intrinsicValue × (1 ± safetyMargin)`}
          </pre>
          <p>
            Base FCF source: <span className="font-mono text-foreground">{r.baseFcfSource || 'unavailable'}</span>.
            If reported Free Cash Flow is missing it is computed as <span className="font-mono">Operating Cash Flow − |Capex|</span>.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
