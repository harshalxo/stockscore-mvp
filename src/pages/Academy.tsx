import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ACADEMY_METRICS, type AcademyMetric, type MetricCategory, searchMetrics } from '@/lib/academyMetrics';
import { useFundamentals, useOverview } from '@/hooks/useStockData';

const CATEGORIES: MetricCategory[] = ['Quality', 'Growth', 'Cash Flow', 'Risk', 'Valuation'];

const categoryColor: Record<MetricCategory, string> = {
  Quality: 'bg-score-excellent/15 text-score-excellent border-score-excellent/30',
  Growth: 'bg-primary/15 text-primary border-primary/30',
  'Cash Flow': 'bg-score-good/15 text-score-good border-score-good/30',
  Risk: 'bg-score-poor/15 text-score-poor border-score-poor/30',
  Valuation: 'bg-score-neutral/15 text-score-neutral border-score-neutral/30',
};

export default function Academy() {
  const [params] = useSearchParams();
  const symbol = params.get('symbol') || '';
  const initialMetric = params.get('metric') || '';
  const [query, setQuery] = useState(initialMetric);

  const { data: fundamentals } = useFundamentals(symbol);
  const { data: overview } = useOverview(symbol);

  const filtered = useMemo(() => searchMetrics(query), [query]);

  // Scroll to anchor if metric param is set
  useEffect(() => {
    if (!initialMetric) return;
    const id = initialMetric.toLowerCase();
    const el = document.getElementById(id);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [initialMetric]);

  const grouped = useMemo(() => {
    const map: Record<MetricCategory, AcademyMetric[]> = {
      Quality: [], Growth: [], 'Cash Flow': [], Risk: [], Valuation: [],
    };
    filtered.forEach((m) => map[m.category].push(m));
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-bold text-gradient">StockScore</span>
          </Link>
          {symbol ? (
            <Link
              to={`/company/${symbol}`}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {symbol}
            </Link>
          ) : (
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                <span className="text-gradient">Academy</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Plain-English explanations of every metric we score.
              </p>
            </div>
          </motion.div>

          {symbol && overview && (
            <div className="mb-4 text-xs text-muted-foreground">
              Examples below use live values from{' '}
              <span className="text-primary font-mono">{overview.symbol}</span>
              {' — '}
              {overview.name}
            </div>
          )}

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search metrics: ROCE, Debt, Margin, CAGR…"
              className="pl-12 h-12 bg-secondary border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl"
            />
          </div>

          {/* Category jump nav */}
          <div className="flex flex-wrap gap-2 mt-4">
            {CATEGORIES.map((c) => (
              <a
                key={c}
                href={`#cat-${c.toLowerCase().replace(/\s+/g, '-')}`}
                className={`text-xs px-3 py-1.5 rounded-full border ${categoryColor[c]} hover:opacity-80 transition`}
              >
                {c} · {grouped[c].length}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Metric sections */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          {CATEGORIES.map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            return (
              <div key={cat} id={`cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className={categoryColor[cat]}>{cat}</Badge>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="grid gap-4">
                  {items.map((m) => (
                    <MetricCard key={m.id} metric={m} fundamentals={fundamentals} />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No metrics match "{query}". Try ROCE, CAGR, Debt, or Margin.
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border/30 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-xs text-muted-foreground">
          StockScore Academy — educational content only. Not investment advice.
        </div>
      </footer>
    </div>
  );
}

function MetricCard({
  metric,
  fundamentals,
}: {
  metric: AcademyMetric;
  fundamentals: ReturnType<typeof useFundamentals>['data'];
}) {
  const example = fundamentals && metric.example ? metric.example(fundamentals) : null;

  return (
    <Card id={metric.id} className="glass-card scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-xl">{metric.name}</CardTitle>
          {example && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Live example
              </div>
              <div className="font-mono text-lg text-primary">{example.value}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Block label="A. Formula">
          <code className="block bg-secondary/60 border border-border/40 rounded-md px-3 py-2 font-mono text-foreground/90">
            {metric.formula}
          </code>
        </Block>
        <Block label="B. What it measures">
          <p className="text-foreground/85">{metric.measures}</p>
        </Block>
        <Block label="C. Why it matters">
          <p className="text-foreground/85">{metric.whyMatters}</p>
        </Block>
        <div className="grid md:grid-cols-3 gap-4">
          <Block label="D. Strengths">
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              {metric.strengths.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </Block>
          <Block label="E. Weaknesses">
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              {metric.weaknesses.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </Block>
          <Block label="F. Common mistakes">
            <ul className="list-disc pl-5 space-y-1 text-foreground/80">
              {metric.commonMistakes.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </Block>
        </div>
        {example?.note && (
          <p className="text-xs text-muted-foreground italic">{example.note}</p>
        )}
        {!example && fundamentals && (
          <p className="text-xs text-muted-foreground italic">
            Live example not available for this company.
          </p>
        )}
        {!fundamentals && (
          <p className="text-xs text-muted-foreground italic">
            Open Academy from a company page (e.g. <code>/academy?symbol=AAPL</code>) to see live example values.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
