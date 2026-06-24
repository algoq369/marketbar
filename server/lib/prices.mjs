// server/lib/prices.mjs — live price fetch for the poller, hardened per the
// money-path standards: every external call is wrapped in withRetry (T2) +
// an 8s AbortController timeout (T10) + a per-source circuit breaker (T11),
// and errors are classified (T9) so transient failures retry while permanent
// ones log + skip without killing the loop.
//
// Crypto: CoinGecko /simple/price (batch). Fallback: CoinMarketCap if
// CMC_API_KEY is set (otherwise silently skipped — never crash). Traditional:
// Yahoo Finance chart endpoint, one call per symbol.

import { withRetry, withTimeout } from './retry.mjs';
import { HttpError, classifyError, isTransientError } from './errors.mjs';
import { CRYPTO_ASSETS, TRADITIONAL_ASSETS, assetKind } from './assets.mjs';

const COINGECKO = 'https://api.coingecko.com/api/v3';
const CMC = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT_MS = 8000;

/**
 * fetch JSON with an abort signal; throws HttpError (carrying status) on non-2xx
 * so isTransientError can decide retryability.
 * @param {string} url @param {{signal: AbortSignal, headers?: Record<string,string>}} opts
 */
async function fetchJson(url, { signal, headers }) {
  const resp = await fetch(url, { signal, headers });
  if (!resp.ok) throw new HttpError(resp.status, `${resp.status} for ${new URL(url).host}`);
  return resp.json();
}

/**
 * Run a source fetch through retry + timeout + breaker. Returns the parsed
 * payload, or null if the source is circuit-open or fails after retries.
 *
 * @template T
 * @param {string} source breaker key ('coingecko' | 'cmc' | 'yahoo:<sym>')
 * @param {(signal: AbortSignal) => Promise<T>} doFetch
 * @param {{ breaker: any, logger: any, signal?: AbortSignal }} ctx
 * @returns {Promise<T | null>}
 */
async function guardedFetch(source, doFetch, ctx) {
  const { breaker, logger, signal } = ctx;
  if (!breaker.canRequest(source)) {
    logger.warn('source circuit open, skipping', { source, state: breaker.stateOf(source) });
    return null;
  }
  try {
    const data = await withRetry(
      () => withTimeout((s) => doFetch(s), FETCH_TIMEOUT_MS, signal),
      {
        maxRetries: 2,
        onRetry: (err, attempt, delayMs) =>
          logger.warn('retrying source', { source, attempt, delayMs, err: classifyError(err) }),
      },
    );
    breaker.recordSuccess(source);
    return data;
  } catch (err) {
    breaker.recordFailure(source);
    logger.error('source fetch failed', {
      source,
      err: classifyError(err),
      transient: isTransientError(err),
      breaker: breaker.stateOf(source),
    });
    return null;
  }
}

/**
 * @typedef {Object} PriceResult
 * @property {Map<string, number>} prices   assetId → USD price (only successes)
 * @property {Record<string, string>} sources status per source for logging/health
 */

/**
 * Fetch current USD prices for the given asset ids.
 * @param {string[]} assetIds
 * @param {{ breaker: any, logger: any, signal?: AbortSignal }} ctx
 * @returns {Promise<PriceResult>}
 */
export async function getPrices(assetIds, ctx) {
  const { logger } = ctx;
  /** @type {Map<string, number>} */
  const prices = new Map();
  /** @type {Record<string, string>} */
  const sources = {};

  const cryptoIds = assetIds.filter((id) => assetKind(id) === 'crypto');
  const tradIds = assetIds.filter((id) => assetKind(id) === 'traditional');

  // ── Crypto via CoinGecko (one batched call) ──
  if (cryptoIds.length > 0) {
    const url = `${COINGECKO}/simple/price?ids=${encodeURIComponent(cryptoIds.join(','))}&vs_currencies=usd`;
    const data = await guardedFetch('coingecko', (signal) => fetchJson(url, { signal }), ctx);
    if (data) {
      for (const id of cryptoIds) {
        const px = data?.[id]?.usd;
        if (typeof px === 'number' && Number.isFinite(px)) prices.set(id, px);
      }
      sources.coingecko = `ok(${cryptoIds.filter((id) => prices.has(id)).length}/${cryptoIds.length})`;
    } else {
      sources.coingecko = 'fail';
    }

    // ── CMC fallback for any crypto id CoinGecko didn't return ──
    const missing = cryptoIds.filter((id) => !prices.has(id));
    if (missing.length > 0) {
      const filled = await fillFromCmc(missing, prices, ctx);
      sources.cmc = process.env.CMC_API_KEY ? (filled === null ? 'fail' : `ok(${filled}/${missing.length})`) : 'skipped(no key)';
    }
  }

  // ── Traditional via Yahoo (per symbol, in parallel, independently guarded) ──
  if (tradIds.length > 0) {
    let ok = 0;
    await Promise.all(
      tradIds.map(async (id) => {
        const sym = TRADITIONAL_ASSETS[id]?.yahoo;
        if (!sym) return;
        const url = `${YAHOO}/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const data = await guardedFetch(
          `yahoo:${sym}`,
          (signal) =>
            fetchJson(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }),
          ctx,
        );
        const px = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof px === 'number' && Number.isFinite(px)) {
          prices.set(id, px);
          ok += 1;
        }
      }),
    );
    sources.yahoo = `ok(${ok}/${tradIds.length})`;
  }

  logger.debug('price fetch complete', { requested: assetIds.length, resolved: prices.size, sources });
  return { prices, sources };
}

/**
 * Fallback path: fill missing crypto prices from CoinMarketCap.
 * @param {string[]} missing  CoinGecko ids still missing
 * @param {Map<string, number>} prices  mutated in place
 * @param {{ breaker: any, logger: any, signal?: AbortSignal }} ctx
 * @returns {Promise<number | null>} count filled, or null if skipped/failed
 */
async function fillFromCmc(missing, prices, ctx) {
  const key = process.env.CMC_API_KEY;
  if (!key) {
    ctx.logger.debug('CMC fallback skipped (no CMC_API_KEY)', { missing: missing.length });
    return null;
  }
  // CoinGecko id → CMC symbol; skip any without a mapping.
  const pairs = missing.map((id) => [id, CRYPTO_ASSETS[id]?.cmc]).filter(([, sym]) => sym);
  if (pairs.length === 0) return null;

  const symbols = pairs.map(([, sym]) => sym).join(',');
  const url = `${CMC}?symbol=${encodeURIComponent(symbols)}&convert=USD`;
  const data = await guardedFetch(
    'cmc',
    (signal) => fetchJson(url, { signal, headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' } }),
    ctx,
  );
  if (!data) return null;

  let filled = 0;
  for (const [id, sym] of pairs) {
    // CMC may return an array per symbol; take the first quoted entry.
    const node = Array.isArray(data?.data?.[sym]) ? data.data[sym][0] : data?.data?.[sym];
    const px = node?.quote?.USD?.price;
    if (typeof px === 'number' && Number.isFinite(px)) {
      prices.set(id, px);
      filled += 1;
    }
  }
  return filled;
}
