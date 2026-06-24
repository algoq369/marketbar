// server/lib/rateLimit.mjs — basic in-memory fixed-window rate limiter (T12).
// Public, internet-facing endpoints (zone CRUD, push register) are limited per
// client IP. Good enough for a personal tool; no external store needed.

/**
 * @typedef {Object} LimiterOptions
 * @property {number} [windowMs=60000]   Window length.
 * @property {number} [max=60]           Max requests per window per key.
 * @property {number} [maxBuckets=20000] Hard cap on tracked keys (memory bound).
 * @property {(req: any) => string} [keyOf] Bucket key (default: client IP).
 */

/**
 * Returns an Express middleware enforcing `max` requests per `windowMs` per key.
 * Sets standard RateLimit headers and replies 429 with Retry-After on overflow.
 *
 * Keying: uses Express's `req.ip`, which is the raw socket address UNLESS the
 * app sets `trust proxy` (api/index.mjs does, so on Vercel req.ip is the real
 * client from the platform's X-Forwarded-For). We deliberately do NOT parse the
 * raw X-Forwarded-For header ourselves — it is client-spoofable and would let an
 * attacker mint a fresh bucket per request and bypass the limit.
 *
 * @param {LimiterOptions} [opts]
 */
export function createRateLimiter(opts = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;
  const maxBuckets = opts.maxBuckets ?? 20_000;
  const keyOf = opts.keyOf ?? ((req) => req.ip || req.socket?.remoteAddress || 'unknown');

  /** @type {Map<string, {count: number, resetAt: number}>} */
  const buckets = new Map();

  // Keep the map bounded even when keys are adversarially varied. First drop
  // expired windows; if still over the hard cap, evict oldest (Map preserves
  // insertion order) so memory can never grow without limit.
  function sweep(nowTs) {
    if (buckets.size < 5000) return;
    for (const [k, b] of buckets) if (b.resetAt <= nowTs) buckets.delete(k);
    while (buckets.size >= maxBuckets) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return function rateLimit(req, res, next) {
    const nowTs = Date.now();
    sweep(nowTs);
    const key = keyOf(req);
    let b = buckets.get(key);
    if (!b || b.resetAt <= nowTs) {
      b = { count: 0, resetAt: nowTs + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;

    const remaining = Math.max(0, max - b.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((b.resetAt - nowTs) / 1000)));

    if (b.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((b.resetAt - nowTs) / 1000)));
      return res.status(429).json({ error: 'Too many requests', retryAfterMs: b.resetAt - nowTs });
    }
    next();
  };
}
