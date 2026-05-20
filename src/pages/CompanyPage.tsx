import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft, ExternalLink, Users, Globe, Building2, DollarSign, TrendingUp, TrendingDown, Activity, Database, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchBar from '@/components/SearchBar';
import ScoreGauge from '@/components/ScoreGauge';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import PillarCard from '@/components/PillarCard';
import ErrorState from '@/components/ErrorState';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import { useOverview, useFundamentals, usePrices, useScore } from '@/hooks/useStockData';
import { getScoreColor, getCurrencySymbol, formatCurrency } from '@/types/stock';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function formatPercent(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function CompanyPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const ticker = symbol?.toUpperCase() || '';

  const overview = useOverview(ticker);
  const fundamentals = useFundamentals(ticker);
  const prices = usePrices(ticker);
  const score = useScore(ticker);

  const isLoading = overview.isLoading && score.isLoading && prices.isLoading;
  // Only treat as fatal if every signal failed
  const hasFatalError =
    overview.isError && score.isError && fundamentals.isError && prices.isError;

  if (isLoading) return <PageSkeleton />;

  if (hasFatalError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ErrorState
          message={`Could not load data for ${ticker}. The symbol may be unsupported or Yahoo Finance is temporarily unavailable.`}
          onRetry={() => { overview.refetch(); score.refetch(); fundamentals.refetch(); prices.refetch(); }}
        />
      </div>
    );
  }

  const co = overview.data;
  const sc = score.data;
  const fund = fundamentals.data;
  const pr = prices.data;

  if (!co) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ErrorState message={`No data available for ${ticker}`} onRetry={() => navigate('/')} />
      </div>
    );
  }

  // Resolve currency from whichever source has it (priority: price > overview > fundamentals > score)
  const currency = pr?.currency || co?.currency || fund?.currency || sc?.currency || 'USD';
  const cSym = getCurrencySymbol(currency);
  const fmtMoney = (n: number | null | undefined) => formatCurrency(n, currency);


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-lg font-bold text-gradient hidden sm:block">StockScore</span>
          </button>
          <div className="flex-1 max-w-md">
            <SearchBar />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-6 gap-2 text-muted-foreground" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>

        {/* Company Header + Score */}
        <motion.div
          className="flex flex-col lg:flex-row gap-8 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Left - Company Info */}
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{co.name}</h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-primary font-semibold">{ticker}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{co.exchange}</span>
                  <span className="text-xs text-muted-foreground">{co.sector} • {co.industry}</span>
                </div>
              </div>
            </div>

            {/* Price */}
            {pr && (
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold font-mono text-foreground">{cSym}{pr.currentPrice.toFixed(2)}</span>
                <span className={`text-sm font-mono font-semibold flex items-center gap-1 ${pr.change >= 0 ? 'text-score-excellent' : 'text-score-bad'}`}>
                  {pr.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {pr.change >= 0 ? '+' : ''}{pr.change.toFixed(2)} ({pr.changePercent.toFixed(2)}%)
                </span>
                <span className="text-xs text-muted-foreground">{currency}</span>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl line-clamp-3">{co.description}</p>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
              {co.marketCap > 0 && (
                <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> {fmtMoney(co.marketCap)}</span>
              )}
              {co.employees > 0 && (
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {co.employees.toLocaleString()} employees</span>
              )}
              {co.website && (
                <a href={co.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Right - Score */}
          {sc ? (
            <div className="flex flex-col items-center gap-3">
              <ScoreGauge score={sc.overallScore} grade={sc.grade} />
              <ConfidenceBadge confidence={sc.confidence} />
            </div>
          ) : score.isLoading ? (
            <div className="h-40 w-40 shimmer rounded-full" />
          ) : (
            <div className="text-xs text-muted-foreground max-w-[180px] text-center">Score unavailable for this symbol.</div>
          )}
        </motion.div>

        {/* Pillar Cards */}
        {sc && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
            {sc.pillars.map((p, i) => (
              <PillarCard key={p.name} pillar={p} index={i} />
            ))}
          </div>
        )}


        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border/30 p-1 h-auto flex-wrap">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Overview</TabsTrigger>
            <TabsTrigger value="fundamentals" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Fundamentals</TabsTrigger>
            <TabsTrigger value="price" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Price</TabsTrigger>
            <TabsTrigger value="breakdown" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Score Breakdown</TabsTrigger>
            <TabsTrigger value="methodology" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Methodology</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Company Profile</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{co.description}</p>
                  <MetricRow label="CEO" value={co.ceo} />
                  <MetricRow label="Country" value={co.country} />
                  <MetricRow label="Sector" value={co.sector} />
                  <MetricRow label="Industry" value={co.industry} />
                  <MetricRow label="Employees" value={co.employees > 0 ? co.employees.toLocaleString() : 'N/A'} />
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Score Summary</CardTitle></CardHeader>
                <CardContent>
                  {sc ? (
                    <>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{sc.summary}</p>
                      <div className="space-y-3">
                        {sc.pillars.map((p) => (
                          <div key={p.name} className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-32">{p.name}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getScoreColor(p.score).replace('text-', 'bg-')}`} style={{ width: `${p.score}%` }} />
                            </div>
                            <span className={`text-sm font-mono font-semibold w-8 text-right ${getScoreColor(p.score)}`}>{p.score}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Score not available for this symbol.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fundamentals Tab */}
          <TabsContent value="fundamentals">
            {fundamentals.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="glass-card"><CardContent className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map(j => <div key={j} className="h-4 shimmer rounded" />)}
                  </CardContent></Card>
                ))}
              </div>
            ) : fund ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Valuation</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="P/E Ratio" value={fund.peRatio?.toFixed(1) || 'N/A'} />
                    <MetricRow label="P/B Ratio" value={fund.pbRatio?.toFixed(1) || 'N/A'} />
                    <MetricRow label="Market Cap" value={fmtMoney(co.marketCap)} />
                    <MetricRow label="Beta" value={fund.beta?.toFixed(2) || 'N/A'} />
                    <MetricRow label="Dividend Yield" value={formatPercent(fund.dividendYield)} />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Profitability</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="Gross Margin" value={formatPercent(fund.grossMargin)} />
                    <MetricRow label="Operating Margin" value={formatPercent(fund.operatingMargin)} />
                    <MetricRow label="Net Margin" value={formatPercent(fund.netMargin)} />
                    <MetricRow label="ROE" value={formatPercent(fund.roe)} />
                    <MetricRow label="Revenue" value={fmtMoney(fund.revenue)} />
                    <MetricRow label="Net Income" value={fmtMoney(fund.netIncome)} />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Financial Health</CardTitle></CardHeader>
                  <CardContent>
                    <MetricRow label="Debt/Equity" value={fund.debtToEquity?.toFixed(2) || 'N/A'} />
                    <MetricRow label="Current Ratio" value={fund.currentRatio?.toFixed(2) || 'N/A'} />
                    <MetricRow label="Total Debt" value={fmtMoney(fund.totalDebt)} />
                    <MetricRow label="Total Cash" value={fmtMoney(fund.totalCash)} />
                    <MetricRow label="Free Cash Flow" value={fmtMoney(fund.freeCashFlow)} />
                    <MetricRow label="Revenue Growth" value={formatPercent(fund.revenueGrowth)} />
                    <MetricRow label="Earnings Growth" value={formatPercent(fund.earningsGrowth)} />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <ErrorState message="Fundamentals data not available" />
            )}
          </TabsContent>

          {/* Price Tab */}
          <TabsContent value="price">
            {prices.isLoading ? (
              <Card className="glass-card"><CardContent className="p-6"><div className="h-64 shimmer rounded-lg" /></CardContent></Card>
            ) : pr ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Current', value: `${cSym}${pr.currentPrice.toFixed(2)}` },
                    { label: '52W High', value: `${cSym}${pr.high52Week.toFixed(2)}` },
                    { label: '52W Low', value: `${cSym}${pr.low52Week.toFixed(2)}` },
                    { label: 'Volume', value: `${(pr.volume / 1e6).toFixed(1)}M` },
                  ].map((m) => (
                    <Card key={m.label} className="glass-card">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <p className="text-lg font-bold font-mono text-foreground">{m.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {pr.history && pr.history.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-base">Price History (1Y)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={pr.history}>
                            <defs>
                              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(190, 95%, 55%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(190, 95%, 55%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} interval={Math.floor(pr.history.length / 6)} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${cSym}${v}`} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(220, 22%, 10%)', border: '1px solid hsl(220, 18%, 18%)', borderRadius: '8px', fontSize: '12px' }}
                              labelStyle={{ color: 'hsl(210, 20%, 92%)' }}
                              itemStyle={{ color: 'hsl(190, 95%, 55%)' }}
                            />
                            <Area type="monotone" dataKey="close" stroke="hsl(190, 95%, 55%)" fill="url(#priceGradient)" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <ErrorState message="Price data not available" />
            )}
          </TabsContent>

          {/* Score Breakdown Tab */}
          <TabsContent value="breakdown">
            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Overall Analysis</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{sc.summary}</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sc.pillars.map((p, i) => (
                  <Card key={p.name} className="glass-card">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-foreground">{p.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold font-mono ${getScoreColor(p.score)}`}>{p.score}</span>
                          <span className={`text-sm font-semibold ${getScoreColor(p.score)}`}>{p.grade}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
                        <motion.div
                          className={`h-full rounded-full ${getScoreColor(p.score).replace('text-', 'bg-')}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${p.score}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{p.details}</p>
                      <p className="text-xs text-muted-foreground/60 mt-2">Weight: {(p.weight * 100).toFixed(0)}% of overall score</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Methodology Tab */}
          <TabsContent value="methodology">
            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Scoring Methodology</CardTitle></CardHeader>
                <CardContent className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">How StockScore Works</h4>
                    <p>StockScore evaluates companies across five fundamental pillars using real-time data from Yahoo Finance. Each pillar produces a sub-score from 0–100, then the overall score is calculated as a weighted sum:</p>
                    <div className="mt-3 p-3 rounded-lg bg-secondary/50 font-mono text-xs">
                      Overall = Σ (pillar_score × weight), clamped 0–100
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exact formulas per pillar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Profitability',
                    weight: '25%',
                    inputs: ['Gross Margin', 'Operating Margin', 'Net Margin', 'Return on Equity (ROE)'],
                    formula: 'avg(\n  grossMargin × 120,\n  opMargin × 200,\n  netMargin × 250,\n  min(ROE × 200, 100)\n)',
                    note: 'Higher margins and ROE yield higher scores. Each metric is scaled so that strong performers score 70–100.',
                  },
                  {
                    title: 'Growth',
                    weight: '20%',
                    inputs: ['Revenue Growth (YoY)', 'Earnings Growth (YoY)'],
                    formula: 'avg(\n  50 + revenueGrowth × 200,\n  50 + earningsGrowth × 150\n)',
                    note: 'Baseline of 50 = flat growth. 25% revenue growth → score of 100. Negative growth penalizes below 50.',
                  },
                  {
                    title: 'Financial Health',
                    weight: '20%',
                    inputs: ['Current Ratio', 'Debt-to-Equity', 'Cash / Debt Ratio'],
                    formula: 'avg(\n  min(currentRatio × 40, 100),\n  max(100 − D/E × 30, 0),\n  min(cash/debt × 60, 100)\n)',
                    note: 'Rewards liquidity and low leverage. A current ratio of 2.5+ and D/E below 1.0 score well.',
                  },
                  {
                    title: 'Valuation',
                    weight: '20%',
                    inputs: ['P/E Ratio', 'P/B Ratio'],
                    formula: 'avg(\n  max(100 − (PE − 15) × 2, 0),\n  max(100 − (PB − 3) × 8, 0)\n)',
                    note: 'Anchored to P/E of 15 and P/B of 3 as "fair value". Lower multiples score higher; very high multiples approach 0.',
                  },
                  {
                    title: 'Momentum',
                    weight: '15%',
                    inputs: ['Current Price', '52-Week High', '52-Week Low'],
                    formula: '(price − 52wLow)\n  ÷ (52wHigh − 52wLow)\n  × 100',
                    note: 'Measures where the stock trades within its 52-week range. Near highs → strong momentum.',
                  },
                ].map((p) => (
                  <Card key={p.title} className="glass-card">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">{p.title}</h4>
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {p.weight}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60 mb-1">Inputs</p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.inputs.map((inp) => (
                            <span key={inp} className="text-xs bg-secondary/70 text-muted-foreground px-2 py-0.5 rounded">
                              {inp}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60 mb-1">Formula</p>
                        <pre className="text-xs font-mono bg-secondary/50 rounded-lg p-3 whitespace-pre-wrap text-foreground/80 overflow-x-auto">
                          {p.formula}
                        </pre>
                      </div>
                      <p className="text-xs text-muted-foreground/70">{p.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Aggregation, Grading, Confidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-5 space-y-4">
                    <h4 className="font-semibold text-foreground text-sm">Grading Scale</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { range: '≥ 95', grade: 'A+', color: 'text-score-excellent' },
                        { range: '≥ 90', grade: 'A', color: 'text-score-excellent' },
                        { range: '≥ 85', grade: 'A-', color: 'text-score-good' },
                        { range: '≥ 80', grade: 'B+', color: 'text-score-good' },
                        { range: '≥ 75', grade: 'B', color: 'text-score-good' },
                        { range: '≥ 70', grade: 'B-', color: 'text-score-good' },
                        { range: '≥ 65', grade: 'C+', color: 'text-score-neutral' },
                        { range: '≥ 60', grade: 'C', color: 'text-score-neutral' },
                        { range: '≥ 55', grade: 'C-', color: 'text-score-neutral' },
                        { range: '≥ 45', grade: 'D', color: 'text-score-poor' },
                        { range: '< 45', grade: 'F', color: 'text-score-bad' },
                      ].map((g) => (
                        <div key={g.grade} className="flex items-center justify-between p-2 rounded bg-secondary/40">
                          <span className={`font-bold font-mono text-sm ${g.color}`}>{g.grade}</span>
                          <span className="text-xs text-muted-foreground font-mono">{g.range}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-5 space-y-4">
                    <h4 className="font-semibold text-foreground text-sm">Confidence Levels</h4>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs text-muted-foreground/60 mb-1">Determination formula</p>
                        <pre className="text-xs font-mono bg-secondary/50 rounded-lg p-3 whitespace-pre-wrap text-foreground/80">
{`metrics = [PE, ROE, revGrowth, grossMargin]
available = count(non-null metrics)

if available ≥ 3 → "high"
else if PE exists → "medium"
else → "low"`}
                        </pre>
                      </div>
                      <div className="space-y-2 text-xs">
                        <p><span className="text-score-excellent font-semibold">High:</span> ≥3 key metrics present — reliable composite score.</p>
                        <p><span className="text-score-neutral font-semibold">Medium:</span> P/E available but other data gaps — directional score.</p>
                        <p><span className="text-score-bad font-semibold">Low:</span> Minimal data — score should be treated with caution.</p>
                      </div>
                    </div>

                    <h4 className="font-semibold text-foreground text-sm pt-2">Missing Data Handling</h4>
                    <p className="text-xs text-muted-foreground">
                      When a metric is <code className="bg-secondary/50 px-1 rounded">null</code>, it is excluded from its pillar's average. If <em>all</em> inputs for a pillar are null, a default score of 50 is used. This prevents missing data from artificially inflating or deflating scores.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Data Attribution Footer */}
        <motion.div
          className="mt-10 border-t border-border/30 pt-6 pb-4 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Data provided by Yahoo Finance
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Score updated {sc.lastUpdated ? new Date(sc.lastUpdated).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
            </span>
            {overview.dataUpdatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Profile fetched {new Date(overview.dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
            {prices.dataUpdatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Prices fetched {new Date(prices.dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </div>

          {/* Data coverage notes */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground/60 bg-secondary/30 rounded-lg px-3 py-2.5 max-w-3xl">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              {(() => {
                const missing: string[] = [];
                if (!fund) missing.push('fundamentals');
                else {
                  if (fund.peRatio == null && fund.pbRatio == null) missing.push('valuation ratios');
                  if (fund.grossMargin == null && fund.netMargin == null) missing.push('margin data');
                  if (fund.revenueGrowth == null && fund.earningsGrowth == null) missing.push('growth metrics');
                  if (fund.currentRatio == null && fund.debtToEquity == null) missing.push('balance sheet ratios');
                }
                if (!pr) missing.push('price data');
                else if (!pr.history || pr.history.length === 0) missing.push('price history');

                if (missing.length === 0) {
                  return 'Full data coverage — all key metrics available for this analysis. Scores are based on trailing twelve-month financials and real-time market data.';
                }
                return `Partial data coverage — missing ${missing.join(', ')}. Score confidence may be affected. Scores are based on available trailing twelve-month financials.`;
              })()}
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
