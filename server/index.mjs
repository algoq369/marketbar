import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import { registerZoneRoutes, engineContext } from './lib/zoneRoutes.mjs';
import { runEvaluationPass } from './lib/evaluate.mjs';
import { createLogger } from './lib/log.mjs';
import { classifyError } from './lib/errors.mjs';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const pollLog = createLogger('poller');

// Cache: 60s for prices, 300s for metadata
const priceCache = new NodeCache({ stdTTL: 60 });
const metaCache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cacheStats: {
      prices: priceCache.getStats(),
      meta: metaCache.getStats(),
    },
  });
});

// ─── Crypto: CoinGecko (cached proxy) ───────────────────────────────
const COINGECKO = 'https://api.coingecko.com/api/v3';

const CRYPTO_IDS = [
  'bitcoin', 'ethereum', 'solana', 'ripple', 'cardano',
  'dogecoin', 'avalanche-2', 'chainlink', 'polkadot', 'litecoin',
  'uniswap', 'stellar', 'cosmos', 'near', 'arbitrum',
].join(',');

app.get('/api/crypto/markets', async (_req, res) => {
  const cacheKey = 'crypto_markets';
  const cached = priceCache.get(cacheKey);
  if (cached) return res.json({ source: 'cache', data: cached });

  try {
    const url = `${COINGECKO}/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
    const data = await resp.json();
    priceCache.set(cacheKey, data);
    res.json({ source: 'api', data });
  } catch (err) {
    console.error('CoinGecko error:', err.message);
    res.status(502).json({ error: 'Failed to fetch crypto data', message: err.message });
  }
});

app.get('/api/crypto/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `crypto_${id}`;
  const cached = metaCache.get(cacheKey);
  if (cached) return res.json({ source: 'cache', data: cached });

  try {
    const url = `${COINGECKO}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
    const data = await resp.json();
    metaCache.set(cacheKey, data);
    res.json({ source: 'api', data });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch coin data', message: err.message });
  }
});

// ─── Traditional: Yahoo Finance (free, no key) ─────────────────────
const YAHOO_SYMBOLS = {
  // Indices
  sp500: '^GSPC',
  djia: '^DJI',
  nasdaq: '^NDX',
  ftse: '^FTSE',
  dax: '^GDAXI',
  nikkei: '^N225',
  // Commodities
  gold: 'GC=F',
  silver: 'SI=F',
  'oil-wti': 'CL=F',
  'oil-brent': 'BZ=F',
  natgas: 'NG=F',
  platinum: 'PL=F',
  palladium: 'PA=F',
  copper: 'HG=F',
  wheat: 'ZW=F',
  corn: 'ZC=F',
};

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

async function fetchYahooQuote(yahooSymbol) {
  const url = `${YAHOO_BASE}/${yahooSymbol}?interval=1h&range=7d`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  });
  if (!resp.ok) throw new Error(`Yahoo ${resp.status} for ${yahooSymbol}`);
  const json = await resp.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${yahooSymbol}`);

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
  const current = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose || meta.previousClose;
  const changePct = prevClose ? ((current - prevClose) / prevClose) * 100 : null;

  return {
    price: current,
    previousClose: prevClose,
    changePercent: changePct,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    sparkline: closes.slice(-48), // last 48 hourly data points
    currency: meta.currency,
    exchange: meta.exchangeName,
    marketState: meta.marketState,
  };
}

app.get('/api/traditional/all', async (_req, res) => {
  const cacheKey = 'traditional_all';
  const cached = priceCache.get(cacheKey);
  if (cached) return res.json({ source: 'cache', data: cached });

  const results = {};
  const errors = [];

  // Fetch all in parallel with individual error handling
  await Promise.allSettled(
    Object.entries(YAHOO_SYMBOLS).map(async ([id, symbol]) => {
      try {
        results[id] = await fetchYahooQuote(symbol);
      } catch (err) {
        errors.push({ id, symbol, error: err.message });
      }
    })
  );

  if (Object.keys(results).length > 0) {
    priceCache.set(cacheKey, results);
  }

  res.json({ source: 'api', data: results, errors: errors.length > 0 ? errors : undefined });
});

app.get('/api/traditional/:id', async (req, res) => {
  const { id } = req.params;
  const symbol = YAHOO_SYMBOLS[id];
  if (!symbol) return res.status(404).json({ error: `Unknown asset: ${id}` });

  const cacheKey = `trad_${id}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return res.json({ source: 'cache', data: cached });

  try {
    const data = await fetchYahooQuote(symbol);
    priceCache.set(cacheKey, data);
    res.json({ source: 'api', data });
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch ${id}`, message: err.message });
  }
});

// ─── Watchlist CRUD (in-memory, persists per session) ───────────────
let watchlists = {};

app.get('/api/watchlist/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ watchlist: watchlists[userId] || ['sp500', 'gold', 'oil-wti', 'bitcoin', 'ethereum'] });
});

app.post('/api/watchlist/:userId', (req, res) => {
  const { userId } = req.params;
  const { watchlist } = req.body;
  if (!Array.isArray(watchlist)) return res.status(400).json({ error: 'watchlist must be an array' });
  watchlists[userId] = watchlist;
  res.json({ ok: true, watchlist });
});

// ─── Price Alerts (in-memory) ───────────────────────────────────────
let alerts = [];

app.get('/api/alerts', (_req, res) => {
  res.json({ alerts });
});

app.post('/api/alerts', (req, res) => {
  const { assetId, condition, price, label } = req.body;
  if (!assetId || !condition || !price) {
    return res.status(400).json({ error: 'assetId, condition (above/below), and price required' });
  }
  const alert = {
    id: Date.now().toString(36),
    assetId,
    condition,
    price,
    label: label || assetId,
    createdAt: new Date().toISOString(),
    triggered: false,
  };
  alerts.push(alert);
  res.json({ ok: true, alert });
});

app.delete('/api/alerts/:id', (req, res) => {
  alerts = alerts.filter(a => a.id !== req.params.id);
  res.json({ ok: true });
});

// ─── All Markets (combined endpoint) ────────────────────────────────
app.get('/api/markets/all', async (_req, res) => {
  try {
    const [cryptoRes, tradRes] = await Promise.allSettled([
      fetch(`http://localhost:${PORT}/api/crypto/markets`).then(r => r.json()),
      fetch(`http://localhost:${PORT}/api/traditional/all`).then(r => r.json()),
    ]);

    const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value.data : [];
    const traditional = tradRes.status === 'fulfilled' ? tradRes.value.data : {};

    res.json({
      crypto: Array.isArray(crypto) ? crypto : [],
      traditional,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to aggregate market data' });
  }
});

// ─── Zone-Alert Engine (CRUD + status + evaluate + push register) ───
registerZoneRoutes(app);

// ─── Price Poller — evaluate enabled zones every 45s ────────────────
// Local only: Vercel serverless can't run setInterval (see api/index.mjs,
// which exposes GET /api/zones/evaluate for a cron/pinger instead).
const POLL_INTERVAL_MS = 45_000;
let polling = false;

async function pollCycle() {
  if (polling) {
    // Previous cycle still running (slow upstream) — skip to avoid overlap.
    pollLog.warn('previous poll cycle still running, skipping this tick');
    return;
  }
  polling = true;
  try {
    await runEvaluationPass(engineContext());
  } catch (err) {
    // A pass should never throw (it catches internally), but belt-and-braces:
    pollLog.error('poll cycle threw', { err: classifyError(err) });
  } finally {
    polling = false;
  }
}

const pollTimer = setInterval(pollCycle, POLL_INTERVAL_MS);
// Don't keep the event loop alive solely for the poller.
if (typeof pollTimer.unref === 'function') pollTimer.unref();
// Kick one cycle shortly after boot so status is populated quickly.
setTimeout(pollCycle, 3000).unref?.();

// ─── Start Server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ◈ MarketBar API Server');
  console.log('  ──────────────────────');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Health:      /api/health`);
  console.log(`  → Crypto:      /api/crypto/markets`);
  console.log(`  → Traditional: /api/traditional/all`);
  console.log(`  → Combined:    /api/markets/all`);
  console.log(`  → Alerts:      /api/alerts`);
  console.log(`  → Zones:       /api/zones  (CRUD, /status, /evaluate)`);
  console.log(`  → Push reg:    /api/push/register`);
  console.log(`  → Poller:      every ${POLL_INTERVAL_MS / 1000}s`);
  console.log('');
});
