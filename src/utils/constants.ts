export const TRADITIONAL_ASSETS = [
  { id: 'sp500',   symbol: 'SPX',  name: 'S&P 500',     category: 'indices' as const, base: 5960,  vol: 15 },
  { id: 'djia',    symbol: 'DJI',  name: 'Dow Jones',    category: 'indices' as const, base: 43800, vol: 120 },
  { id: 'nasdaq',  symbol: 'NDX',  name: 'Nasdaq 100',   category: 'indices' as const, base: 21200, vol: 80 },
  { id: 'ftse',    symbol: 'FTSE', name: 'FTSE 100',     category: 'indices' as const, base: 8720,  vol: 25 },
  { id: 'dax',     symbol: 'DAX',  name: 'DAX 40',       category: 'indices' as const, base: 22800, vol: 60 },
  { id: 'nikkei',  symbol: 'N225', name: 'Nikkei 225',   category: 'indices' as const, base: 37500, vol: 180 },
  { id: 'gold',      symbol: 'XAU', name: 'Gold',           category: 'commodities' as const, base: 2935,  vol: 8 },
  { id: 'silver',    symbol: 'XAG', name: 'Silver',         category: 'commodities' as const, base: 32.8,  vol: 0.15 },
  { id: 'oil-wti',   symbol: 'WTI', name: 'Crude Oil WTI',  category: 'commodities' as const, base: 67.2,  vol: 0.4 },
  { id: 'oil-brent', symbol: 'BRN', name: 'Brent Crude',    category: 'commodities' as const, base: 70.8,  vol: 0.35 },
  { id: 'natgas',    symbol: 'NG',  name: 'Natural Gas',    category: 'commodities' as const, base: 4.12,  vol: 0.03 },
  { id: 'platinum',  symbol: 'XPT', name: 'Platinum',       category: 'commodities' as const, base: 978,   vol: 4 },
  { id: 'palladium', symbol: 'XPD', name: 'Palladium',      category: 'commodities' as const, base: 960,   vol: 5 },
  { id: 'copper',    symbol: 'HG',  name: 'Copper',         category: 'commodities' as const, base: 4.68,  vol: 0.02 },
  { id: 'wheat',     symbol: 'ZW',  name: 'Wheat',          category: 'commodities' as const, base: 542,   vol: 3 },
  { id: 'corn',      symbol: 'ZC',  name: 'Corn',           category: 'commodities' as const, base: 448,   vol: 2.5 },
] as const

export const CRYPTO_IDS = [
  'bitcoin', 'ethereum', 'solana', 'ripple', 'cardano',
  'dogecoin', 'avalanche-2', 'chainlink', 'polkadot', 'litecoin',
  'uniswap', 'stellar', 'cosmos', 'near', 'arbitrum',
].join(',')

export const CATEGORY_CONFIG = {
  all:         { label: 'All Markets', icon: '◉' },
  indices:     { label: 'Indices',     icon: '📊' },
  commodities: { label: 'Commodities', icon: '🛢️' },
  crypto:      { label: 'Crypto',      icon: '₿' },
  watchlist:   { label: 'Watchlist',   icon: '★' },
} as const

export const DEFAULT_WATCHLIST = ['sp500', 'gold', 'oil-wti', 'bitcoin', 'ethereum']

export const FALLBACK_CRYPTO = [
  { id: 'bitcoin',      symbol: 'BTC',  name: 'Bitcoin',    base: 93500, vol: 400 },
  { id: 'ethereum',     symbol: 'ETH',  name: 'Ethereum',   base: 2240,  vol: 20 },
  { id: 'solana',       symbol: 'SOL',  name: 'Solana',     base: 142,   vol: 2 },
  { id: 'ripple',       symbol: 'XRP',  name: 'XRP',        base: 2.42,  vol: 0.02 },
  { id: 'cardano',      symbol: 'ADA',  name: 'Cardano',    base: 0.74,  vol: 0.008 },
  { id: 'dogecoin',     symbol: 'DOGE', name: 'Dogecoin',   base: 0.21,  vol: 0.003 },
  { id: 'avalanche-2',  symbol: 'AVAX', name: 'Avalanche',  base: 22.5,  vol: 0.3 },
  { id: 'chainlink',    symbol: 'LINK', name: 'Chainlink',  base: 15.2,  vol: 0.15 },
  { id: 'polkadot',     symbol: 'DOT',  name: 'Polkadot',   base: 4.6,   vol: 0.04 },
  { id: 'litecoin',     symbol: 'LTC',  name: 'Litecoin',   base: 92,    vol: 1 },
  { id: 'uniswap',      symbol: 'UNI',  name: 'Uniswap',    base: 7.8,   vol: 0.08 },
  { id: 'stellar',      symbol: 'XLM',  name: 'Stellar',    base: 0.31,  vol: 0.003 },
  { id: 'cosmos',        symbol: 'ATOM', name: 'Cosmos',     base: 5.2,   vol: 0.05 },
  { id: 'near',          symbol: 'NEAR', name: 'NEAR',       base: 3.1,   vol: 0.04 },
  { id: 'arbitrum',      symbol: 'ARB',  name: 'Arbitrum',   base: 0.42,  vol: 0.005 },
]
