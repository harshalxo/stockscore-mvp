import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import FeaturedCompanies from '@/components/FeaturedCompanies';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-lg font-bold text-gradient">StockScore</span>
          </div>
          <Link
            to="/academy"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Academy
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-foreground">Analyze Stocks</span>
            <br />
            <span className="text-gradient">With Confidence</span>
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-lg max-w-xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Comprehensive scoring across profitability, growth, financial health, valuation, and momentum.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SearchBar large />
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FeaturedCompanies />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-xs text-muted-foreground">
          StockScore — Phase 1 MVP • Data is for demonstration purposes only
        </div>
      </footer>
    </div>
  );
}
