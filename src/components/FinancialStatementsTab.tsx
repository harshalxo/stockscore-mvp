import { Card, CardContent } from '@/components/ui/card';
import ChartCard, { ChartPoint } from './ChartCard';
import type { AnnualFinancials } from '@/types/stock';

interface Props {
  annual?: AnnualFinancials[];
  currency?: string;
}

function series(annual: AnnualFinancials[] | undefined, key: keyof AnnualFinancials): ChartPoint[] {
  if (!annual?.length) return [];
  // annual comes latest-first; charts want chronological order (oldest → latest)
  return [...annual].reverse().map(a => ({ year: a.year, value: (a[key] as number | null) ?? null }));
}

// Capex is typically reported negative on Yahoo; show absolute spend so the chart reads naturally.
function capexSeries(annual: AnnualFinancials[] | undefined): ChartPoint[] {
  if (!annual?.length) return [];
  return [...annual].reverse().map(a => ({ year: a.year, value: a.capex == null ? null : Math.abs(a.capex) }));
}

export default function FinancialStatementsTab({ annual, currency }: Props) {
  if (!annual || annual.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Annual financial statements are not available for this symbol.
        </CardContent>
      </Card>
    );
  }

  const cyan = 'hsl(190, 95%, 55%)';
  const violet = 'hsl(265, 85%, 65%)';
  const amber = 'hsl(38, 92%, 55%)';

  return (
    <div className="space-y-8">
      {/* Income Statement */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Income Statement</h3>
          <span className="text-[11px] text-muted-foreground font-mono">{annual.length}Y · {currency || 'USD'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Revenue"    data={series(annual, 'revenue')}    currency={currency} color={cyan} />
          <ChartCard title="EBIT"       data={series(annual, 'ebit')}       currency={currency} color={violet} />
          <ChartCard title="Net Income" data={series(annual, 'netIncome')}  currency={currency} color={amber} />
        </div>
      </section>

      {/* Balance Sheet */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Balance Sheet</h3>
          <span className="text-[11px] text-muted-foreground font-mono">{annual.length}Y · {currency || 'USD'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ChartCard title="Total Assets" data={series(annual, 'totalAssets')}  currency={currency} color={cyan} />
          <ChartCard title="Equity"       data={series(annual, 'totalEquity')}  currency={currency} color={violet} />
          <ChartCard title="Debt"         data={series(annual, 'totalDebt')}    currency={currency} color="hsl(0, 75%, 60%)" invertTrend />
          <ChartCard title="Cash"         data={series(annual, 'cashAndEquiv')} currency={currency} color={amber} />
        </div>
      </section>

      {/* Cash Flow */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Cash Flow</h3>
          <span className="text-[11px] text-muted-foreground font-mono">{annual.length}Y · {currency || 'USD'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Operating Cash Flow" data={series(annual, 'operatingCf')} currency={currency} color={cyan} />
          <ChartCard title="Capex (absolute)"    data={capexSeries(annual)}           currency={currency} color="hsl(0, 75%, 60%)" invertTrend />
          <ChartCard title="Free Cash Flow"      data={series(annual, 'freeCf')}      currency={currency} color={amber} />
        </div>
      </section>
    </div>
  );
}
