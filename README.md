# StockScore — Transparent Stock Scoring & DCF Lite MVP

## Overview

StockScore is an education-first stock analysis MVP that combines company search, fundamentals, transparent scoring, Yahoo Finance data, and a simplified DCF Lite valuation module.

## Problem

Retail investors and students often see scores, ratings, and valuation labels without understanding the assumptions behind them. StockScore aims to make stock analysis more transparent by showing the formulas, data inputs, scoring logic, and limitations.

## Phase 1 Scope

- **Stock search** — search companies by symbol or name
- **Company overview** — sector, industry, market cap, CEO, description
- **3-year fundamentals** — key financial ratios and margins
- **Price chart** — price history with change and volume
- **0-100 stock score** — composite score with grade and confidence
- **Pillar score breakdown** — per-pillar grades and weights
- **Metric-level formulas** — transparent ROCE, CAGR, margin calculations
- **DCF Lite valuation** — basic fair value estimate with editable assumptions
- **Methodology and disclaimers** — full explanation of how everything works

### Out of Scope for Phase 1

- Reverse DCF
- Full institutional DCF
- Sector-specific scoring
- Peer benchmarking
- Portfolio tracking
- Authentication / user accounts

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| UI Framework | shadcn/ui |
| Charts | Recharts |
| Backend | Supabase Edge Function (Deno) / Lovable Cloud |
| Data | Yahoo Finance via `yahoo-finance2` |
| Build Tool | Vite 5 |

The frontend is generated and iterated with **Lovable**. The backend is a server-side Supabase Edge Function that proxies and transforms Yahoo Finance data so the frontend never calls Yahoo directly.

## Data Source

The MVP uses Yahoo Finance data through a server-side Edge Function. The frontend does not call Yahoo directly.

> ⚠️ Yahoo Finance access is implemented through an unofficial library, so data availability and consistency may vary. Some non-US symbols may have weaker data coverage.

## Core Features

1. **Company search** — find stocks by ticker or company name
2. **Company overview** — business description, sector, industry, market cap, employees, website, CEO
3. **Fundamentals dashboard** — P/E, P/B, ROE, margins, debt/equity, revenue growth, earnings growth, free cash flow, and more
4. **Score gauge** — animated circular score with grade and confidence badge
5. **Pillar cards** — Quality, Growth, Cash Flow, Risk, and Valuation with individual grades
6. **Metric breakdown** — every metric shows its raw value, score, formula, and explanation
7. **DCF Lite** — interactive 5-year discounted cash flow estimate with editable assumptions
8. **Methodology page** — full scoring and DCF formulas with limitations
9. **Data freshness indicators** — last fetched timestamp, coverage status, missing fields count
10. **Error and fallback states** — missing fundamentals? Score still renders. Missing price? Overview still shows. Every section degrades gracefully.

## Scoring Methodology

### Formula

```
Score = 0.30 × Quality + 0.20 × Growth + 0.20 × Cash Flow + 0.15 × Risk + 0.15 × Valuation
```

### Pillars & Metrics

| Pillar | Weight | Example Metrics |
|--------|--------|-----------------|
| **Quality** | 30% | ROCE, ROE, ROA, EBIT Margin |
| **Growth** | 20% | Revenue CAGR, Net Income CAGR |
| **Cash Flow** | 20% | FCF Margin, OCF / Net Income |
| **Risk** | 15% | Debt / Equity, Interest Coverage |
| **Valuation** | 15% | P/E, P/B |

### Handling Missing Data

Missing metrics are ignored and weights are renormalized across available pillars. If valuation data is missing, the score is computed from Quality, Growth, Cash Flow, and Risk only.

### Confidence Levels

- **MEDIUM** — 3 years of fundamentals available
- **LOW** — fewer than 3 years of fundamentals available

HIGH confidence is reserved for future phases with deeper historical data.

## DCF Lite Methodology

DCF Lite is a simplified, transparent discounted cash flow estimate — not a full institutional DCF.

### User-Controlled Assumptions

- **Forecast Years** — default 5 years
- **FCF Growth Rate** — annual free cash flow growth
- **Discount Rate** — WACC proxy
- **Terminal Growth Rate** — perpetual growth rate
- **Safety Margin** — ± range around the intrinsic value

### Simplified Formula

```
Projected FCF_t = Base FCF × (1 + FCF Growth Rate)^t
PV_t = Projected FCF_t / (1 + Discount Rate)^t

Terminal Value = Projected FCF_N × (1 + Terminal Growth) / (Discount Rate − Terminal Growth)
PV Terminal Value = Terminal Value / (1 + Discount Rate)^N

Enterprise Value = Σ PV_t + PV Terminal Value
Intrinsic Value Per Share = Enterprise Value / Shares Outstanding
Fair Value Range = Intrinsic Value × (1 ± Safety Margin)
```

Base FCF falls back to `Operating Cash Flow − |Capex|` if reported Free Cash Flow is unavailable.

### Interpretation

- "Appears below estimated fair value range"
- "Appears within estimated fair value range"
- "Appears above estimated fair value range"

> Valuation depends heavily on assumptions. This is not a buy/sell signal.

## Limitations

- Yahoo Finance data may be incomplete or inconsistent
- This is **not investment advice**
- DCF Lite is highly assumption-sensitive
- Phase 1 uses a simplified scoring system with 3-year fundamentals
- Some non-US symbols may have weaker data coverage
- No buy/sell recommendations are provided
- The tool is for educational and analytical purposes only

## Future Roadmap

- Full institutional DCF with sensitivity tables
- Reverse DCF (implied growth rate from current price)
- Sector-specific scoring models
- Peer comparison and benchmarking
- Watchlist and saved favorites
- User accounts with saved scenarios
- Exportable PDF reports
- Multi-provider data layer for redundancy

## How to Run Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The backend runs through the configured Supabase / Lovable Cloud Edge Function environment. Ensure your Edge Function (`supabase/functions/stock-data`) is deployed and the frontend environment variables point to the correct function URL.

## Project Status

**Phase 1 MVP in development.**

Core features are functional and the app is suitable for portfolio demonstration. Feedback and contributions are welcome.

## Disclaimer

This project is for educational and portfolio purposes only. It is not financial advice. Always do your own research and consult a qualified financial advisor before making investment decisions.
