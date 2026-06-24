// server/lib/circuitBreaker.mjs — per-source in-memory circuit breaker (T11).
// If a price source returns errors `threshold` times in a row, the breaker
// "opens" and short-circuits further calls for `cooldownMs` instead of
// hammering the failing API every cycle. After cooldown it goes "half-open" —
// one probe is allowed; success closes it, failure re-opens it.

import { CircuitBreakerError } from './errors.mjs';

/**
 * @typedef {Object} BreakerOptions
 * @property {number} [threshold=4]      Consecutive failures before opening.
 * @property {number} [cooldownMs=120000] How long to stay open before a probe.
 * @property {() => number} [now]        Injectable clock (tests).
 */

/**
 * @param {BreakerOptions} [opts]
 */
export function createCircuitBreaker(opts = {}) {
  const threshold = opts.threshold ?? 4;
  const cooldownMs = opts.cooldownMs ?? 120_000;
  const now = opts.now ?? (() => Date.now());

  /** @type {Map<string, {fails: number, openedAt: number, state: 'closed'|'open'|'half'}>} */
  const sources = new Map();

  /** @param {string} source */
  function entry(source) {
    let e = sources.get(source);
    if (!e) {
      e = { fails: 0, openedAt: 0, state: 'closed' };
      sources.set(source, e);
    }
    return e;
  }

  return {
    /**
     * True if a request to `source` may proceed. Transitions open → half-open
     * once the cooldown has elapsed.
     * @param {string} source
     */
    canRequest(source) {
      const e = entry(source);
      if (e.state === 'open') {
        if (now() - e.openedAt >= cooldownMs) {
          e.state = 'half';
          return true; // allow a single probe
        }
        return false;
      }
      return true;
    },

    /** Throw if the breaker is open (use to guard a call site). @param {string} source */
    assert(source) {
      if (!this.canRequest(source)) {
        const e = entry(source);
        throw new CircuitBreakerError(source, e.fails);
      }
    },

    /** @param {string} source */
    recordSuccess(source) {
      const e = entry(source);
      e.fails = 0;
      e.state = 'closed';
      e.openedAt = 0;
    },

    /** @param {string} source */
    recordFailure(source) {
      const e = entry(source);
      e.fails += 1;
      if (e.state === 'half' || e.fails >= threshold) {
        e.state = 'open';
        e.openedAt = now();
      }
    },

    /** @param {string} source @returns {'closed'|'open'|'half'} */
    stateOf(source) {
      return entry(source).state;
    },

    /** Snapshot for /api/health and structured logs. */
    snapshot() {
      /** @type {Record<string, {state: string, fails: number}>} */
      const out = {};
      for (const [src, e] of sources) out[src] = { state: e.state, fails: e.fails };
      return out;
    },
  };
}
