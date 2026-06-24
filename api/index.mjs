import express from 'express';
import cors from 'cors';
import { registerZoneRoutes } from '../server/lib/zoneRoutes.mjs';

const app = express();
// Vercel sits one proxy hop in front of the function; trusting it makes req.ip
// resolve to the real client (from the platform's X-Forwarded-For) for the rate
// limiter, instead of the proxy address. Exactly one hop — do not trust beyond.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// ─── In-memory cache (resets per cold start, ~5min Vercel lifespan) ─
const cache = {};
function cached(key, ttlMs, fn) {
  return async (req, res) => {
    const now = Date.now();
    if (cache[key] && now - cache[key].t < ttlMs) {
      return res.json({ source: 'cache', data: cache[key].d });
    }
    try {
      const data = await fn(req);
      cache[key] = { d: data, t: now };
      res.json({ source: 'api', data });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  };
}

// ─── Yahoo Finance ──────────────────────────────────────────────────
const YAHOO_SYMBOLS = {
  sp500: '^GSPC', djia: '^DJI', nasdaq: '^NDX', ftse: '^FTSE',
  dax: '^GDAXI', nikkei: '^N225',
  gold: 'GC=F', silver: 'SI=F', 'oil-wti': 'CL=F', 'oil-brent': 'BZ=F',
  natgas: 'NG=F', platinum: 'PL=F', palladium: 'PA=F', copper: 'HG=F',
  wheat: 'ZW=F', corn: 'ZC=F',
};

async function fetchYahoo(symbol) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&range=7d`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const m = j.chart?.result?.[0]?.meta;
  const closes = j.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
  if (!m) throw new Error('No data');
  return {
    price: m.regularMarketPrice,
    previousClose: m.chartPreviousClose || m.previousClose,
    changePercent: m.chartPreviousClose ? ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose) * 100 : null,
    high: m.regularMarketDayHigh, low: m.regularMarketDayLow,
    volume: m.regularMarketVolume,
    sparkline: closes.slice(-48),
    marketState: m.marketState,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/crypto/markets', cached('crypto', 60000, async () => {
  const ids = 'bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,chainlink,polkadot,litecoin,uniswap,stellar,cosmos,near,arbitrum';
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  return r.json();
}));

app.get('/api/traditional/all', cached('trad_all', 60000, async () => {
  const results = {};
  await Promise.allSettled(
    Object.entries(YAHOO_SYMBOLS).map(async ([id, sym]) => {
      try { results[id] = await fetchYahoo(sym); } catch {}
    })
  );
  return results;
}));

app.get('/api/traditional/:id', async (req, res) => {
  const sym = YAHOO_SYMBOLS[req.params.id];
  if (!sym) return res.status(404).json({ error: 'Unknown asset' });
  const key = `trad_${req.params.id}`;
  const now = Date.now();
  if (cache[key] && now - cache[key].t < 60000) {
    return res.json({ source: 'cache', data: cache[key].d });
  }
  try {
    const data = await fetchYahoo(sym);
    cache[key] = { d: data, t: now };
    res.json({ source: 'api', data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/markets/all', async (_, res) => {
  try {
    const [c, t] = await Promise.allSettled([
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,chainlink,polkadot,litecoin,uniswap,stellar,cosmos,near,arbitrum&order=market_cap_desc&sparkline=true&price_change_percentage=24h').then(r=>r.json()),
      (async () => { const r = {}; await Promise.allSettled(Object.entries(YAHOO_SYMBOLS).map(async([id,sym])=>{try{r[id]=await fetchYahoo(sym)}catch{}})); return r; })(),
    ]);
    res.json({
      crypto: c.status==='fulfilled' ? c.value : [],
      traditional: t.status==='fulfilled' ? t.value : {},
      timestamp: new Date().toISOString(),
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Alerts (in-memory)
let alerts = [];
app.get('/api/alerts', (_, res) => res.json({ alerts }));
app.post('/api/alerts', (req, res) => {
  const { assetId, condition, price, label } = req.body;
  if (!assetId || !condition || !price) return res.status(400).json({ error: 'Missing fields' });
  const alert = { id: Date.now().toString(36), assetId, condition, price, label: label||assetId, createdAt: new Date().toISOString(), triggered: false };
  alerts.push(alert);
  res.json({ ok: true, alert });
});
app.delete('/api/alerts/:id', (req, res) => {
  alerts = alerts.filter(a => a.id !== req.params.id);
  res.json({ ok: true });
});

// ─── Zone-Alert Engine (mirrored from server/index.mjs) ─────────────
// IMPORTANT: Vercel serverless functions are stateless and CANNOT run a
// setInterval poller — the process is frozen between requests. So instead of a
// 45s loop, the deployed engine exposes GET /api/zones/evaluate, which runs ONE
// evaluation pass per hit. Trigger it on a schedule with Vercel Cron (e.g. add a
// crons entry to vercel.json) or any uptime pinger (cron-job.org, UptimeRobot).
// Protect it by setting EVALUATE_TOKEN in the Vercel env (then pass it as the
// x-evaluate-token header or ?token=).
//
// NOTE on persistence: zones.json / push-tokens.json live on the read-only
// serverless FS, so writes there are best-effort and reset on cold start. For
// durable multi-instance state, point ZONES_PATH / PUSH_TOKENS_PATH at a
// writable store or migrate to a DB in a later phase. Each zone carries its
// own lastState so a single evaluate hit still detects transitions correctly
// for as long as the instance stays warm.
registerZoneRoutes(app);

export default app;
