// server/lib/assets.mjs — canonical asset registry shared by schemas + price sources.
// Maps a zone's `assetId` to its data source (CoinGecko / Yahoo) and to the
// CoinMarketCap fallback symbol for crypto. Single source of truth so the Zod
// enum and the poller can never drift apart.

/** CoinGecko ids → short display ticker + CMC fallback symbol. */
export const CRYPTO_ASSETS = {
  bitcoin: { symbol: 'BTC', cmc: 'BTC' },
  ethereum: { symbol: 'ETH', cmc: 'ETH' },
  solana: { symbol: 'SOL', cmc: 'SOL' },
  ripple: { symbol: 'XRP', cmc: 'XRP' },
  cardano: { symbol: 'ADA', cmc: 'ADA' },
  dogecoin: { symbol: 'DOGE', cmc: 'DOGE' },
  'avalanche-2': { symbol: 'AVAX', cmc: 'AVAX' },
  chainlink: { symbol: 'LINK', cmc: 'LINK' },
  polkadot: { symbol: 'DOT', cmc: 'DOT' },
  litecoin: { symbol: 'LTC', cmc: 'LTC' },
  uniswap: { symbol: 'UNI', cmc: 'UNI' },
  stellar: { symbol: 'XLM', cmc: 'XLM' },
  cosmos: { symbol: 'ATOM', cmc: 'ATOM' },
  near: { symbol: 'NEAR', cmc: 'NEAR' },
  arbitrum: { symbol: 'ARB', cmc: 'ARB' },
};

/** Traditional asset id → { Yahoo symbol, display ticker }. */
export const TRADITIONAL_ASSETS = {
  sp500: { yahoo: '^GSPC', symbol: 'SPX' },
  djia: { yahoo: '^DJI', symbol: 'DJIA' },
  nasdaq: { yahoo: '^NDX', symbol: 'NDX' },
  ftse: { yahoo: '^FTSE', symbol: 'FTSE' },
  dax: { yahoo: '^GDAXI', symbol: 'DAX' },
  nikkei: { yahoo: '^N225', symbol: 'N225' },
  gold: { yahoo: 'GC=F', symbol: 'GOLD' },
  silver: { yahoo: 'SI=F', symbol: 'SILVER' },
  'oil-wti': { yahoo: 'CL=F', symbol: 'WTI' },
  'oil-brent': { yahoo: 'BZ=F', symbol: 'BRENT' },
  natgas: { yahoo: 'NG=F', symbol: 'NATGAS' },
  platinum: { yahoo: 'PL=F', symbol: 'PLAT' },
  palladium: { yahoo: 'PA=F', symbol: 'PALL' },
  copper: { yahoo: 'HG=F', symbol: 'COPPER' },
  wheat: { yahoo: 'ZW=F', symbol: 'WHEAT' },
  corn: { yahoo: 'ZC=F', symbol: 'CORN' },
};

/** Every assetId the engine recognises (used for the Zod enum). */
export const KNOWN_ASSET_IDS = /** @type {[string, ...string[]]} */ ([
  ...Object.keys(CRYPTO_ASSETS),
  ...Object.keys(TRADITIONAL_ASSETS),
]);

const KNOWN_SET = new Set(KNOWN_ASSET_IDS);

/** @param {string} assetId */
export function isKnownAsset(assetId) {
  return KNOWN_SET.has(assetId);
}

/** @param {string} assetId @returns {'crypto' | 'traditional' | null} */
export function assetKind(assetId) {
  if (assetId in CRYPTO_ASSETS) return 'crypto';
  if (assetId in TRADITIONAL_ASSETS) return 'traditional';
  return null;
}

/** Short ticker for headlines, e.g. 'bitcoin' → 'BTC'. @param {string} assetId */
export function displaySymbol(assetId) {
  return CRYPTO_ASSETS[assetId]?.symbol || TRADITIONAL_ASSETS[assetId]?.symbol || assetId.toUpperCase();
}
