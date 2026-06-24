// server/lib/retry.mjs — retry with exponential backoff + abort/timeout.
// Vendored from ~/webna/packages/stdlib/src/retry/index.ts (T2 withRetry).
// Ported TS → JSDoc-typed .mjs. Do NOT import across repos — this is the local copy.
//
// T2: EVERY external API call (CoinGecko / CMC / Yahoo / Expo) is wrapped here.
// One failed fetch must NEVER crash the poller. T10: callers also pass an
// AbortSignal so a hung call can't freeze the 45s cycle.

import { randomInt } from 'node:crypto';
import { AbortError, TimeoutError, isAbortError, isTransientError } from './errors.mjs';

/**
 * @typedef {Object} RetryOptions
 * @property {number}  [maxRetries=3]    Max retries (total attempts = maxRetries + 1).
 * @property {number}  [baseDelayMs=400] Base delay; doubles each attempt.
 * @property {number}  [maxDelayMs=8000] Delay cap.
 * @property {AbortSignal} [signal]      Cancels pending retries / sleeps.
 * @property {(error: unknown) => boolean} [isRetryable] Override retry predicate.
 * @property {(error: unknown, attempt: number, delayMs: number) => void} [onRetry]
 */

/** Exponential backoff with crypto jitter (never Math.random — T4 hygiene). */
function calculateDelay(attempt, baseDelayMs, maxDelayMs) {
  const capped = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
  const jitter = randomInt(0, Math.max(1, Math.floor(capped * 0.25)));
  return capped + jitter;
}

/** Sleep that rejects promptly if the signal aborts. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AbortError());
      },
      { once: true },
    );
  });
}

/**
 * Execute `fn` with retry + exponential backoff. Retries only transient
 * errors (network / 5xx / timeout); permanent errors and aborts throw at once.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {RetryOptions} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 400,
    maxDelayMs = 8000,
    signal,
    isRetryable = isTransientError,
    onRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (signal?.aborted) throw new AbortError();
      return await fn(attempt);
    } catch (error) {
      if (isAbortError(error)) throw error;     // never retry an abort
      if (attempt >= maxRetries) throw error;   // out of attempts
      if (!isRetryable(error)) throw error;      // permanent → bail

      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs, signal);
    }
  }

  // Unreachable — the loop either returns or throws.
  throw new Error('withRetry: unexpected end of retry loop');
}

/**
 * Run `fn` against a fresh AbortController that aborts after `timeoutMs`
 * (T10). The handler is passed the signal so it can wire it into fetch().
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {number} timeoutMs
 * @param {AbortSignal} [parentSignal] Optional outer signal to also honour.
 * @returns {Promise<T>}
 */
export async function withTimeout(fn, timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    // CRITICAL: undici's fetch() rejects an aborted request with a DOMException
    // named 'AbortError'. If we let that propagate, withRetry treats our own 8s
    // deadline as a user abort and NEVER retries. Convert *our* deadline into a
    // (retryable) TimeoutError; a genuine parent-signal abort stays an
    // AbortError and is correctly NOT retried.
    if (timedOut && isAbortError(err)) throw new TimeoutError(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}
