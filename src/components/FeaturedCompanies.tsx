import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ArrowRight } from 'lucide-react';

const FEATURED = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', score: 82, grade: 'A-' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', score: 88, grade: 'A' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', score: 85, grade: 'A-' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors', score: 79, grade: 'B+' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Social Media', score: 86, grade: 'A' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'E-Commerce', score: 74, grade: 'B' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Auto Manufacturers', score: 42, grade: 'C' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Banking', score: 76, grade: 'B+' },
];

function getScoreAccent(score: number) {
  if (score >= 80) return 'border-score-excellent/30 hover:border-score-excellent/60';
  if (score >= 65) return 'border-score-good/30 hover:border-score-good/60';
  if (score >= 45) return 'border-score-neutral/30 hover:border-score-neutral/60';
  return 'border-score-poor/30 hover:border-score-poor/60';
}

function getScoreTextColor(score: number) {
  if (score >= 80) return 'text-score-excellent';
  if (score >= 65) return 'text-score-good';
  if (score >= 45) return 'text-score-neutral';
  return 'text-score-poor';
}

export default function FeaturedCompanies() {
  const navigate = useNavigate();

  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Featured Companies</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FEATURED.map((company, i) => (
          <motion.div
            key={company.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
          >
            <Card
              className={`glass-card cursor-pointer transition-all duration-300 group ${getScoreAccent(company.score)}`}
              onClick={() => navigate(`/company/${company.symbol}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-mono font-bold text-primary text-sm">{company.symbol}</span>
                    <p className="text-sm text-foreground/80 mt-0.5">{company.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-bold font-mono ${getScoreTextColor(company.score)}`}>{company.score}</span>
                    <p className={`text-xs font-semibold ${getScoreTextColor(company.score)}`}>{company.grade}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{company.sector}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
