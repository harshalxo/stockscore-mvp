import { corsHeaders } from "@supabase/supabase-js/cors";

const FEATURED_COMPANIES = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Consumer Electronics" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology", industry: "Software" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Internet Services" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "E-Commerce" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors" },
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  { symbol: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Social Media" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", sector: "Financial Services", industry: "Banks" },
  { symbol: "V", name: "Visa Inc.", exchange: "NYSE", sector: "Financial Services", industry: "Credit Services" },
  { symbol: "JNJ", name: "Johnson & Johnson", exchange: "NYSE", sector: "Healthcare", industry: "Drug Manufacturers" },
  { symbol: "WMT", name: "Walmart Inc.", exchange: "NYSE", sector: "Consumer Defensive", industry: "Discount Stores" },
  { symbol: "PG", name: "Procter & Gamble Co.", exchange: "NYSE", sector: "Consumer Defensive", industry: "Household Products" },
];

const COMPANY_DATA: Record<string, any> = {
  AAPL: {
    overview: { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Consumer Electronics", description: "Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables and accessories worldwide. The company offers iPhone, Mac, iPad, and wearables, home and accessories.", marketCap: 3420000000000, employees: 164000, website: "https://apple.com", ceo: "Tim Cook", country: "United States" },
    fundamentals: { symbol: "AAPL", peRatio: 33.2, pbRatio: 52.8, debtToEquity: 1.87, currentRatio: 0.99, roe: 1.61, revenueGrowth: 0.049, earningsGrowth: 0.102, dividendYield: 0.0044, grossMargin: 0.462, operatingMargin: 0.316, netMargin: 0.264, freeCashFlow: 111440000000, revenue: 395600000000, netIncome: 104440000000, totalDebt: 108000000000, totalCash: 62500000000, beta: 1.24 },
    prices: { symbol: "AAPL", currentPrice: 227.48, previousClose: 225.12, change: 2.36, changePercent: 1.05, high52Week: 260.10, low52Week: 164.08, volume: 54200000, avgVolume: 48500000 },
    score: { symbol: "AAPL", overallScore: 82, grade: "A-", confidence: "high", summary: "Apple demonstrates strong profitability and brand dominance with excellent margins. Valuation is stretched but justified by consistent execution.", pillars: [
      { name: "Profitability", score: 92, weight: 0.25, grade: "A+", details: "Industry-leading margins with gross margin of 46.2% and net margin of 26.4%." },
      { name: "Growth", score: 68, weight: 0.20, grade: "B", details: "Moderate revenue growth of 4.9% with stronger earnings growth at 10.2%." },
      { name: "Financial Health", score: 75, weight: 0.20, grade: "B+", details: "Manageable debt levels with strong cash flow generation of $111B." },
      { name: "Valuation", score: 55, weight: 0.20, grade: "C+", details: "P/E of 33.2x is above sector median, P/B of 52.8x reflects premium pricing." },
      { name: "Momentum", score: 85, weight: 0.15, grade: "A", details: "Trading near 52-week highs with above-average volume." },
    ], lastUpdated: new Date().toISOString() },
  },
  MSFT: {
    overview: { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology", industry: "Software—Infrastructure", description: "Microsoft develops and licenses consumer and enterprise software, cloud services and devices worldwide. Key products include Windows, Office, Azure, LinkedIn, and Xbox.", marketCap: 3180000000000, employees: 228000, website: "https://microsoft.com", ceo: "Satya Nadella", country: "United States" },
    fundamentals: { symbol: "MSFT", peRatio: 35.8, pbRatio: 12.4, debtToEquity: 0.42, currentRatio: 1.77, roe: 0.38, revenueGrowth: 0.161, earningsGrowth: 0.21, dividendYield: 0.0072, grossMargin: 0.698, operatingMargin: 0.449, netMargin: 0.359, freeCashFlow: 74070000000, revenue: 245100000000, netIncome: 88020000000, totalDebt: 59970000000, totalCash: 75530000000, beta: 0.89 },
    prices: { symbol: "MSFT", currentPrice: 428.50, previousClose: 425.80, change: 2.70, changePercent: 0.63, high52Week: 468.35, low52Week: 362.90, volume: 22100000, avgVolume: 20800000 },
    score: { symbol: "MSFT", overallScore: 88, grade: "A", confidence: "high", summary: "Microsoft excels across all pillars with exceptional margins, strong growth driven by Azure and AI, and conservative financial management.", pillars: [
      { name: "Profitability", score: 95, weight: 0.25, grade: "A+", details: "Outstanding 69.8% gross margin and 35.9% net margin, best-in-class." },
      { name: "Growth", score: 88, weight: 0.20, grade: "A", details: "Strong 16.1% revenue growth and 21% earnings growth driven by cloud and AI." },
      { name: "Financial Health", score: 92, weight: 0.20, grade: "A+", details: "Net cash position with $75.5B cash vs $60B debt and low 0.42 D/E ratio." },
      { name: "Valuation", score: 62, weight: 0.20, grade: "B-", details: "P/E of 35.8x is elevated but supported by growth and quality metrics." },
      { name: "Momentum", score: 78, weight: 0.15, grade: "B+", details: "Solid uptrend with consistent institutional buying." },
    ], lastUpdated: new Date().toISOString() },
  },
  GOOGL: {
    overview: { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Internet Content & Information", description: "Alphabet offers various products and platforms worldwide including Google Search, YouTube, Cloud, Android, Chrome, and other emerging bets in AI and autonomous vehicles.", marketCap: 2150000000000, employees: 182502, website: "https://abc.xyz", ceo: "Sundar Pichai", country: "United States" },
    fundamentals: { symbol: "GOOGL", peRatio: 22.5, pbRatio: 7.1, debtToEquity: 0.11, currentRatio: 2.12, roe: 0.32, revenueGrowth: 0.138, earningsGrowth: 0.31, dividendYield: 0.005, grossMargin: 0.577, operatingMargin: 0.322, netMargin: 0.274, freeCashFlow: 69500000000, revenue: 350000000000, netIncome: 95800000000, totalDebt: 28500000000, totalCash: 100700000000, beta: 1.06 },
    prices: { symbol: "GOOGL", currentPrice: 175.20, previousClose: 173.90, change: 1.30, changePercent: 0.75, high52Week: 201.42, low52Week: 147.22, volume: 28000000, avgVolume: 26500000 },
    score: { symbol: "GOOGL", overallScore: 85, grade: "A-", confidence: "high", summary: "Alphabet combines strong growth with reasonable valuation, massive cash reserves, and leading AI positioning.", pillars: [
      { name: "Profitability", score: 88, weight: 0.25, grade: "A", details: "Excellent margins with 57.7% gross and 27.4% net margin." },
      { name: "Growth", score: 84, weight: 0.20, grade: "A-", details: "13.8% revenue growth with strong 31% earnings acceleration." },
      { name: "Financial Health", score: 96, weight: 0.20, grade: "A+", details: "Fortress balance sheet with $100.7B cash and minimal debt." },
      { name: "Valuation", score: 78, weight: 0.20, grade: "B+", details: "P/E of 22.5x is reasonable relative to growth and quality." },
      { name: "Momentum", score: 72, weight: 0.15, grade: "B", details: "Recovering from volatility with improving trend." },
    ], lastUpdated: new Date().toISOString() },
  },
  NVDA: {
    overview: { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", description: "NVIDIA designs and sells graphics processing units and related multimedia software. The company leads in AI/ML hardware with its data center GPU platforms.", marketCap: 3280000000000, employees: 32000, website: "https://nvidia.com", ceo: "Jensen Huang", country: "United States" },
    fundamentals: { symbol: "NVDA", peRatio: 55.2, pbRatio: 48.3, debtToEquity: 0.41, currentRatio: 4.17, roe: 1.15, revenueGrowth: 1.22, earningsGrowth: 1.68, dividendYield: 0.0003, grossMargin: 0.738, operatingMargin: 0.621, netMargin: 0.558, freeCashFlow: 60940000000, revenue: 130500000000, netIncome: 72880000000, totalDebt: 9710000000, totalCash: 43170000000, beta: 1.67 },
    prices: { symbol: "NVDA", currentPrice: 134.50, previousClose: 131.20, change: 3.30, changePercent: 2.52, high52Week: 153.13, low52Week: 75.61, volume: 312000000, avgVolume: 280000000 },
    score: { symbol: "NVDA", overallScore: 79, grade: "B+", confidence: "medium", summary: "NVIDIA's explosive AI-driven growth and exceptional margins are tempered by premium valuation and cyclical semiconductor risks.", pillars: [
      { name: "Profitability", score: 97, weight: 0.25, grade: "A+", details: "73.8% gross margin and 55.8% net margin are extraordinary for semiconductors." },
      { name: "Growth", score: 98, weight: 0.20, grade: "A+", details: "122% revenue growth and 168% earnings growth from AI boom." },
      { name: "Financial Health", score: 88, weight: 0.20, grade: "A", details: "Strong balance sheet with $43.2B cash and low 0.41 D/E ratio." },
      { name: "Valuation", score: 32, weight: 0.20, grade: "D+", details: "P/E of 55.2x and P/B of 48.3x price in significant future growth." },
      { name: "Momentum", score: 90, weight: 0.15, grade: "A", details: "Strong uptrend with massive volume and institutional demand." },
    ], lastUpdated: new Date().toISOString() },
  },
  TSLA: {
    overview: { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "Auto Manufacturers", description: "Tesla designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems worldwide.", marketCap: 780000000000, employees: 140500, website: "https://tesla.com", ceo: "Elon Musk", country: "United States" },
    fundamentals: { symbol: "TSLA", peRatio: 68.5, pbRatio: 14.2, debtToEquity: 0.18, currentRatio: 1.73, roe: 0.22, revenueGrowth: 0.021, earningsGrowth: -0.23, dividendYield: 0, grossMargin: 0.182, operatingMargin: 0.079, netMargin: 0.071, freeCashFlow: 4360000000, revenue: 96800000000, netIncome: 6870000000, totalDebt: 7430000000, totalCash: 36560000000, beta: 2.31 },
    prices: { symbol: "TSLA", currentPrice: 245.20, previousClose: 240.80, change: 4.40, changePercent: 1.83, high52Week: 488.54, low52Week: 138.80, volume: 98200000, avgVolume: 92000000 },
    score: { symbol: "TSLA", overallScore: 42, grade: "C", confidence: "low", summary: "Tesla faces margin pressure and slowing growth, with elevated valuation that doesn't align with current fundamentals.", pillars: [
      { name: "Profitability", score: 35, weight: 0.25, grade: "D+", details: "Declining margins with 18.2% gross and only 7.1% net margin." },
      { name: "Growth", score: 28, weight: 0.20, grade: "D", details: "Near-flat 2.1% revenue growth with -23% earnings decline." },
      { name: "Financial Health", score: 82, weight: 0.20, grade: "A-", details: "Strong cash position of $36.6B with low debt of $7.4B." },
      { name: "Valuation", score: 18, weight: 0.20, grade: "F", details: "P/E of 68.5x is unjustified by current growth trajectory." },
      { name: "Momentum", score: 55, weight: 0.15, grade: "C+", details: "High volatility with wide 52-week range, trading mid-range." },
    ], lastUpdated: new Date().toISOString() },
  },
  AMZN: {
    overview: { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "Internet Retail", description: "Amazon engages in the retail sale of consumer products, advertising, and subscription services through online and physical stores worldwide, and operates AWS cloud computing.", marketCap: 2050000000000, employees: 1525000, website: "https://amazon.com", ceo: "Andy Jassy", country: "United States" },
    fundamentals: { symbol: "AMZN", peRatio: 42.1, pbRatio: 8.9, debtToEquity: 0.58, currentRatio: 1.05, roe: 0.22, revenueGrowth: 0.117, earningsGrowth: 0.55, dividendYield: 0, grossMargin: 0.487, operatingMargin: 0.106, netMargin: 0.076, freeCashFlow: 54200000000, revenue: 637900000000, netIncome: 48500000000, totalDebt: 67200000000, totalCash: 87300000000, beta: 1.15 },
    prices: { symbol: "AMZN", currentPrice: 198.40, previousClose: 196.20, change: 2.20, changePercent: 1.12, high52Week: 232.81, low52Week: 166.17, volume: 45600000, avgVolume: 42000000 },
    score: { symbol: "AMZN", overallScore: 74, grade: "B", confidence: "high", summary: "Amazon's AWS-driven margins expansion and strong earnings growth are encouraging, though retail margins remain thin and valuation is rich.", pillars: [
      { name: "Profitability", score: 65, weight: 0.25, grade: "B", details: "Improving margins at 48.7% gross but thin 7.6% net margin." },
      { name: "Growth", score: 82, weight: 0.20, grade: "A-", details: "11.7% revenue growth with impressive 55% earnings improvement." },
      { name: "Financial Health", score: 78, weight: 0.20, grade: "B+", details: "Net cash with $87.3B cash vs $67.2B debt." },
      { name: "Valuation", score: 48, weight: 0.20, grade: "C", details: "P/E of 42.1x is elevated, reflecting AWS growth premium." },
      { name: "Momentum", score: 75, weight: 0.15, grade: "B+", details: "Constructive trend with positive analyst revisions." },
    ], lastUpdated: new Date().toISOString() },
  },
  META: {
    overview: { symbol: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", sector: "Technology", industry: "Internet Content & Information", description: "Meta builds technologies for connecting people through social platforms including Facebook, Instagram, WhatsApp, and Messenger, and invests heavily in metaverse and AI.", marketCap: 1520000000000, employees: 67317, website: "https://about.meta.com", ceo: "Mark Zuckerberg", country: "United States" },
    fundamentals: { symbol: "META", peRatio: 26.8, pbRatio: 9.2, debtToEquity: 0.31, currentRatio: 2.68, roe: 0.35, revenueGrowth: 0.219, earningsGrowth: 0.35, dividendYield: 0.0035, grossMargin: 0.812, operatingMargin: 0.413, netMargin: 0.355, freeCashFlow: 52100000000, revenue: 164700000000, netIncome: 58470000000, totalDebt: 18390000000, totalCash: 58320000000, beta: 1.22 },
    prices: { symbol: "META", currentPrice: 598.20, previousClose: 592.80, change: 5.40, changePercent: 0.91, high52Week: 638.40, low52Week: 414.50, volume: 18200000, avgVolume: 16800000 },
    score: { symbol: "META", overallScore: 86, grade: "A", confidence: "high", summary: "Meta combines exceptional profitability, strong growth, and reasonable valuation, making it one of the most compelling large-cap tech stocks.", pillars: [
      { name: "Profitability", score: 94, weight: 0.25, grade: "A+", details: "Exceptional 81.2% gross margin and 35.5% net margin." },
      { name: "Growth", score: 90, weight: 0.20, grade: "A", details: "21.9% revenue growth and 35% earnings growth from ads and AI." },
      { name: "Financial Health", score: 90, weight: 0.20, grade: "A", details: "Net cash with $58.3B cash vs $18.4B debt." },
      { name: "Valuation", score: 72, weight: 0.20, grade: "B", details: "P/E of 26.8x is reasonable for the quality and growth profile." },
      { name: "Momentum", score: 82, weight: 0.15, grade: "A-", details: "Near 52-week highs with strong institutional positioning." },
    ], lastUpdated: new Date().toISOString() },
  },
  JPM: {
    overview: { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", sector: "Financial Services", industry: "Banks—Diversified", description: "JPMorgan Chase operates as a financial services company worldwide, offering investment banking, financial services for consumers, commercial banking, and asset management.", marketCap: 680000000000, employees: 313205, website: "https://jpmorganchase.com", ceo: "Jamie Dimon", country: "United States" },
    fundamentals: { symbol: "JPM", peRatio: 12.8, pbRatio: 2.1, debtToEquity: 1.52, currentRatio: null, roe: 0.17, revenueGrowth: 0.089, earningsGrowth: 0.12, dividendYield: 0.021, grossMargin: null, operatingMargin: 0.38, netMargin: 0.31, freeCashFlow: null, revenue: 177500000000, netIncome: 55020000000, totalDebt: 420000000000, totalCash: 890000000000, beta: 1.08 },
    prices: { symbol: "JPM", currentPrice: 238.50, previousClose: 236.80, change: 1.70, changePercent: 0.72, high52Week: 280.25, low52Week: 189.30, volume: 9800000, avgVolume: 9200000 },
    score: { symbol: "JPM", overallScore: 76, grade: "B+", confidence: "high", summary: "JPMorgan is the gold standard in banking with strong execution, but bank-specific risks and cyclical exposure temper the score.", pillars: [
      { name: "Profitability", score: 82, weight: 0.25, grade: "A-", details: "Strong 31% net margin and 17% ROE, excellent for banking." },
      { name: "Growth", score: 70, weight: 0.20, grade: "B", details: "Steady 8.9% revenue growth and 12% earnings growth." },
      { name: "Financial Health", score: 72, weight: 0.20, grade: "B", details: "Well-capitalized but inherently leveraged as a bank." },
      { name: "Valuation", score: 88, weight: 0.20, grade: "A", details: "P/E of 12.8x and P/B of 2.1x are reasonable for quality." },
      { name: "Momentum", score: 68, weight: 0.15, grade: "B", details: "Moderate uptrend with sector rotation support." },
    ], lastUpdated: new Date().toISOString() },
  },
};

// Generate price history for any company
function generatePriceHistory(basePrice: number): { date: string; close: number; volume: number }[] {
  const history = [];
  let price = basePrice * 0.85;
  const now = new Date();
  for (let i = 365; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * price * 0.025;
    price = Math.max(price * 0.5, price + change);
    history.push({
      date: date.toISOString().split("T")[0],
      close: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 50000000) + 10000000,
    });
  }
  return history;
}

function handleSearch(query: string) {
  const q = query.toLowerCase();
  return FEATURED_COMPANIES.filter(
    (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).map((c) => ({ symbol: c.symbol, name: c.name, exchange: c.exchange, type: "Equity" }));
}

function handleOverview(symbol: string) {
  const upper = symbol.toUpperCase();
  const data = COMPANY_DATA[upper];
  if (!data) {
    const featured = FEATURED_COMPANIES.find((c) => c.symbol === upper);
    if (featured) {
      return { symbol: upper, name: featured.name, exchange: featured.exchange, sector: featured.sector, industry: featured.industry, description: `${featured.name} is a publicly traded company on the ${featured.exchange}.`, marketCap: 0, employees: 0, website: "", ceo: "N/A", country: "United States" };
    }
    return null;
  }
  return data.overview;
}

function handleFundamentals(symbol: string) {
  const data = COMPANY_DATA[symbol.toUpperCase()];
  return data?.fundamentals || null;
}

function handlePrices(symbol: string) {
  const upper = symbol.toUpperCase();
  const data = COMPANY_DATA[upper];
  if (!data) return null;
  return { ...data.prices, history: generatePriceHistory(data.prices.currentPrice) };
}

function handleScore(symbol: string) {
  const data = COMPANY_DATA[symbol.toUpperCase()];
  return data?.score || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let result: any;
    switch (action) {
      case "search":
        result = handleSearch(params.query || "");
        break;
      case "overview":
        result = handleOverview(params.symbol || "");
        break;
      case "fundamentals":
        result = handleFundamentals(params.symbol || "");
        break;
      case "prices":
        result = handlePrices(params.symbol || "");
        break;
      case "score":
        result = handleScore(params.symbol || "");
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (result === null) {
      return new Response(JSON.stringify({ error: "Symbol not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
