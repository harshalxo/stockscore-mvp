import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft, ExternalLink, Users, Globe, Building2, DollarSign, TrendingUp, TrendingDown, Activity, Database, Clock, AlertCircle, BookOpen, Scale, Calculator, ShieldAlert, ListChecks, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchBar from '@/components/SearchBar';
import ScoreGauge from '@/components/ScoreGauge';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import PillarCard from '@/components/PillarCard';
import ErrorState from '@/components/ErrorState';
import { PageSkeleton } from '@/components/LoadingSkeleton';
import DcfLiteTab from '@/components/DcfLiteTab';
import ValuationLabTab from '@/components/ValuationLabTab';
import FinancialStatementsTab from '@/components/FinancialStatementsTab';
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
              {sc.dataHealth && (() => {
                const q = sc.dataHealth.qualityLabel;
                const cls =
                  q === 'High' ? 'bg-score-excellent/10 text-score-excellent border-score-excellent/30'
                  : q === 'Medium' ? 'bg-score-neutral/10 text-score-neutral border-score-neutral/30'
                  : 'bg-score-bad/10 text-score-bad border-score-bad/30';
                return (
                  <span className={`text-[11px] font-mono px-2 py-1 rounded border ${cls}`}>
                    Data Quality: {q}
                  </span>
                );
              })()}
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
            <TabsTrigger value="financials" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Financials</TabsTrigger>
            <TabsTrigger value="price" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Price</TabsTrigger>
            <TabsTrigger value="breakdown" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Score Breakdown</TabsTrigger>
            <TabsTrigger value="dcf" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">DCF Lite</TabsTrigger>
            <TabsTrigger value="lab" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Valuation Lab</TabsTrigger>
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

          {/* Financial Statements Tab */}
          <TabsContent value="financials">
            <FinancialStatementsTab annual={fund?.annual} currency={currency} />
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
            {sc ? (
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
            ) : (
              <ErrorState message="Score breakdown not available for this symbol." />
            )}
          </TabsContent>

          {/* DCF Lite Tab */}
          <TabsContent value="dcf">
            <DcfLiteTab symbol={ticker} />
          </TabsContent>

          {/* Valuation Lab Tab */}
          <TabsContent value="lab">
            <ValuationLabTab symbol={ticker} />
          </TabsContent>

          {/* Methodology Tab */}
          <TabsContent value="methodology">
            <div className="space-y-6">
              {/* 1. What StockScore does */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    What StockScore Does
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
                  <p>
                    StockScore is an education-first stock analysis MVP. It combines fundamentals, transparent scoring, and basic valuation to help you learn how companies are evaluated — not to tell you what to buy or sell.
                  </p>
                  <p>
                    All data is fetched server-side from Yahoo Finance through a single Edge Function. The frontend never calls external APIs directly, so your analysis stays private and rate limits are managed safely.
                  </p>
                </CardContent>
              </Card>

              {/* 2. Scoring formula */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    Scoring Formula
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The overall score is a weighted average of five pillar scores. Each pillar is scored from 0 to 100, then combined using the weights below:
                  </p>
                  <div className="p-4 rounded-lg bg-secondary/50 font-mono text-sm text-foreground/90 overflow-x-auto">
                    Score = 0.30 × Quality + 0.20 × Growth + 0.20 × Cash Flow + 0.15 × Risk + 0.15 × Valuation
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    If a pillar cannot be scored because data is missing, it is excluded and the remaining weights are renormalized so the total still equals 1.0.
                  </p>
                </CardContent>
              </Card>

              {/* 3. Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title: 'Quality',
                    weight: '30%',
                    icon: <ListChecks className="h-4 w-4 text-primary" />,
                    desc: 'Profitability and capital efficiency.',
                    metrics: ['ROCE — EBIT ÷ (Equity + Debt − Cash)', 'ROE — Net Income ÷ Total Equity', 'ROA — Net Income ÷ Total Assets', 'EBIT Margin — EBIT ÷ Revenue'],
                    note: 'Higher margins and returns on capital mean the business turns investment into profit efficiently.',
                  },
                  {
                    title: 'Growth',
                    weight: '20%',
                    icon: <TrendingUp className="h-4 w-4 text-primary" />,
                    desc: 'Revenue and net income growth over time.',
                    metrics: ['Revenue CAGR — compound annual growth', 'Net Income CAGR — compound annual growth'],
                    note: 'Sustained growth across both top-line revenue and bottom-line earnings is preferred over one-off spikes.',
                  },
                  {
                    title: 'Cash Flow',
                    weight: '20%',
                    icon: <DollarSign className="h-4 w-4 text-primary" />,
                    desc: 'Free cash flow generation and earnings quality.',
                    metrics: ['FCF / Revenue — free cash flow per dollar of sales', 'OCF / Net Income — operating cash flow vs reported profit'],
                    note: 'A company that converts most of its profit into real cash is generally healthier than one that does not.',
                  },
                  {
                    title: 'Risk',
                    weight: '15%',
                    icon: <ShieldAlert className="h-4 w-4 text-primary" />,
                    desc: 'Leverage and debt-servicing capacity.',
                    metrics: ['Debt / Equity — total debt ÷ shareholders equity', 'Interest Coverage — EBIT ÷ interest expense'],
                    note: 'Lower leverage and strong interest coverage mean the company can weather downturns without distress.',
                  },
                  {
                    title: 'Valuation',
                    weight: '15%',
                    icon: <PieChart className="h-4 w-4 text-primary" />,
                    desc: 'Simple market multiples relative to peers and history.',
                    metrics: ['P/E Ratio — price ÷ earnings per share', 'P/B Ratio — price ÷ book value per share'],
                    note: 'Lower multiples can suggest cheaper prices, but they must be read alongside quality and growth.',
                  },
                ].map((p) => (
                  <Card key={p.title} className="glass-card">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.icon}
                          <h4 className="font-semibold text-foreground">{p.title}</h4>
                        </div>
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{p.weight}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.desc}</p>
                      <div>
                        <p className="text-xs text-muted-foreground/60 mb-1">Key metrics</p>
                        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                          {p.metrics.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-xs text-muted-foreground/70">{p.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 4. DCF Lite */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    DCF Lite — Basic Fair Value Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    DCF Lite estimates intrinsic value using a simplified discounted-cash-flow model. It is <strong>not</strong> a full institutional DCF — it uses a single starting free cash flow, a constant growth assumption, and a standard discount rate to produce a rough fair-value range.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/60 font-semibold">Inputs</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                        <li>Latest Free Cash Flow (reported, or Operating Cash Flow − Capex)</li>
                        <li>5-year forecast horizon</li>
                        <li>FCF growth rate assumption</li>
                        <li>Discount rate (WACC proxy)</li>
                        <li>Terminal growth rate</li>
                        <li>Shares outstanding</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/60 font-semibold">Steps in plain English</p>
                      <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-1">
                        <li>Forecast future free cash flows for each year.</li>
                        <li>Discount each year’s cash flow back to today.</li>
                        <li>Estimate a terminal value beyond year 5.</li>
                        <li>Discount the terminal value back to today.</li>
                        <li>Add all discounted values to get enterprise value.</li>
                        <li>Divide by shares outstanding for intrinsic value per share.</li>
                      </ol>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 font-mono text-xs text-foreground/80 overflow-x-auto">
                    projectedFCF_t = baseFCF × (1 + growthRate)^t<br />
                    presentValue_t = projectedFCF_t ÷ (1 + discountRate)^t<br />
                    terminalValue = projectedFCF_year5 × (1 + terminalGrowth) ÷ (discountRate − terminalGrowth)<br />
                    pvTerminalValue = terminalValue ÷ (1 + discountRate)^5<br />
                    enterpriseValue = Σ presentValue_t + pvTerminalValue<br />
                    intrinsicValue = enterpriseValue ÷ sharesOutstanding
                  </div>
                  <p>
                    A safety margin (±15% by default) is applied around the intrinsic value to create a fair-value range. If the current price sits inside that range, the stock is described as “within estimated fair value.” If it sits outside, it is described as “above” or “below.”
                  </p>
                </CardContent>
              </Card>

              {/* 5. Limitations */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Limitations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2 leading-relaxed">
                    <li>This is <strong>not</strong> a full institutional DCF. It uses a single starting FCF and constant growth, which is a simplification.</li>
                    <li>Assumptions strongly affect the result. Small changes in growth or discount rate can move the fair value by large amounts.</li>
                    <li>Yahoo Finance data may be incomplete, delayed, or missing for some symbols. Missing fields are excluded, but that reduces confidence.</li>
                    <li>Some symbols may not have enough data to score or value at all.</li>
                    <li>Phase 1 uses 3-year fundamentals where available, not a full 10-year history. This limits trend reliability.</li>
                    <li>Scores and valuations are backward-looking based on reported financials. They do not capture future product launches, regulatory changes, or market sentiment shifts.</li>
                  </ul>
                </CardContent>
              </Card>

              {/* 6. Disclaimer */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border/30 bg-secondary/30">
                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground mb-1">Disclaimer</p>
                  <p>
                    This application is for educational and analytical purposes only. It does not provide investment advice, buy/sell recommendations, or financial planning guidance. Always do your own research and consult a qualified financial adviser before making investment decisions.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Data Trust & Metadata Panel */}
        <motion.div
          className="mt-10 border-t border-border/30 pt-6 pb-4 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {(() => {
            // Compute coverage status + missing field count
            const missingFields: string[] = [];
            if (!fund) missingFields.push('fundamentals');
            else {
              if (fund.peRatio == null) missingFields.push('P/E');
              if (fund.pbRatio == null) missingFields.push('P/B');
              if (fund.roe == null) missingFields.push('ROE');
              if (fund.grossMargin == null) missingFields.push('gross margin');
              if (fund.operatingMargin == null) missingFields.push('operating margin');
              if (fund.netMargin == null) missingFields.push('net margin');
              if (fund.revenueGrowth == null) missingFields.push('revenue growth');
              if (fund.earningsGrowth == null) missingFields.push('earnings growth');
              if (fund.debtToEquity == null) missingFields.push('debt/equity');
              if (fund.currentRatio == null) missingFields.push('current ratio');
              if (fund.freeCashFlow == null) missingFields.push('free cash flow');
            }
            if (!pr) missingFields.push('price');
            else if (!pr.history || pr.history.length === 0) missingFields.push('price history');
            if (!sc) missingFields.push('score');

            const sectionsAvailable = [!!co, !!fund, !!pr, !!sc].filter(Boolean).length;
            const dh = sc?.dataHealth;
            let status: 'Complete' | 'Partial' | 'Limited' =
              dh?.coverageLevel ??
              (sectionsAvailable <= 2 || missingFields.length >= 6
                ? 'Limited'
                : missingFields.length > 0
                ? 'Partial'
                : 'Complete');

            const statusStyle =
              status === 'Complete'
                ? 'bg-score-excellent/10 text-score-excellent border-score-excellent/30'
                : status === 'Partial'
                ? 'bg-score-neutral/10 text-score-neutral border-score-neutral/30'
                : 'bg-score-bad/10 text-score-bad border-score-bad/30';

            const qualityLabel = dh?.qualityLabel ?? (status === 'Complete' ? 'High' : status === 'Partial' ? 'Medium' : 'Low');
            const qualityStyle =
              qualityLabel === 'High'
                ? 'bg-score-excellent/10 text-score-excellent border-score-excellent/30'
                : qualityLabel === 'Medium'
                ? 'bg-score-neutral/10 text-score-neutral border-score-neutral/30'
                : 'bg-score-bad/10 text-score-bad border-score-bad/30';

            const yearsUsed = sc?.yearsUsed && sc.yearsUsed.length > 0 ? sc.yearsUsed : null;
            const lastFetched = Math.max(
              overview.dataUpdatedAt || 0,
              prices.dataUpdatedAt || 0,
              fundamentals.dataUpdatedAt || 0,
              score.dataUpdatedAt || 0,
            );

            return (
              <>
                <Card className="glass-card">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">Data source</span>
                        <span className="font-mono text-foreground">Yahoo Finance · server Edge Function</span>
                      </div>
                      {lastFetched > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span className="text-muted-foreground">Last fetched</span>
                          <span className="font-mono text-foreground">
                            {new Date(lastFetched).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Coverage</span>
                        <span className={`font-mono px-2 py-0.5 rounded border ${statusStyle}`}>{status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Data Quality</span>
                        <span className={`font-mono px-2 py-0.5 rounded border ${qualityStyle}`}>{qualityLabel}</span>
                      </div>
                      {dh && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Completeness</span>
                          <span className="font-mono text-foreground">{dh.completenessScore}%</span>
                        </div>
                      )}
                      {yearsUsed && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Fundamentals years</span>
                          <span className="font-mono text-foreground">
                            {yearsUsed.length} ({yearsUsed.join(', ')})
                          </span>
                        </div>
                      )}
                      {(dh?.missingFields.length ?? missingFields.length) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Missing fields</span>
                          <span className="font-mono text-foreground">{dh?.missingFields.length ?? missingFields.length}</span>
                        </div>
                      )}
                    </div>

                    {(dh?.missingFields.length ?? missingFields.length) > 0 && (
                      <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
                        Not available: <span className="font-mono">{(dh?.missingFields ?? missingFields).slice(0, 10).join(', ')}</span>
                        {((dh?.missingFields.length ?? missingFields.length) > 10) ? `, +${(dh?.missingFields.length ?? missingFields.length) - 10} more` : ''}.
                        {' '}Missing pillars are excluded and the overall score is renormalized across available pillars.
                      </p>
                    )}

                    {dh && dh.warnings.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] font-semibold text-score-neutral flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3" /> Data validation warnings
                        </p>
                        <ul className="list-disc pl-5 text-[11px] text-muted-foreground/80 space-y-1 leading-relaxed">
                          {dh.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-start gap-2 text-[11px] text-muted-foreground/70 px-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p>This tool is for educational analysis only and is not investment advice.</p>
                </div>
              </>
            );
          })()}
        </motion.div>

      </main>
    </div>
  );
}
