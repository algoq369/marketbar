// server/lib/retry.test.mjs — guards the money-path resilience contract (T2/T10):
// our own 8s deadline must be a RETRYABLE timeout, while a genuine caller abort
// must NOT be retried. This is the regression test for the blocker the
// adversarial review found (timeout misclassified as abort → never retried).

import { describe, it, expect } from 'vitest';
import { withRetry, withTimeout } from './retry.mjs';
import { isTimeoutError, isAbortError, isTransientError } from './errors.mjs';

/** A fetch-like fn that rejects with an undici-style AbortError when its signal fires. */
function abortableNeverResolves(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    });
  });
}

describe('withTimeout', () => {
  it('surfaces its OWN deadline as a retryable TimeoutError (not an abort)', async () => {
    let err;
    try {
      await withTimeout(abortableNeverResolves, 10);
    } catch (e) {
      err = e;
    }
    expect(isTimeoutError(err)).toBe(true);
    expect(isAbortError(err)).toBe(false);
    expect(isTransientError(err)).toBe(true); // → withRetry will retry it
  });

  it('lets a GENUINE parent abort through as a non-retryable AbortError', async () => {
    const ac = new AbortController();
    const p = withTimeout(abortableNeverResolves, 1000, ac.signal);
    ac.abort();
    let err;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(isAbortError(err)).toBe(true);
    expect(isTimeoutError(err)).toBe(false);
    expect(isTransientError(err)).toBe(false); // → withRetry will NOT retry it
  });

  it('returns the value when fn resolves before the deadline', async () => {
    const v = await withTimeout(async () => 'fast', 1000);
    expect(v).toBe('fast');
  });
});

describe('withRetry + withTimeout (the real composition used by prices/push)', () => {
  it('retries a timed-out attempt with a fresh deadline until it succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      () =>
        withTimeout((signal) => {
          calls += 1;
          if (calls < 3) return abortableNeverResolves(signal); // first 2 attempts time out
          return Promise.resolve('ok'); // 3rd attempt succeeds
        }, 10),
      { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3); // proves the timeout path actually retried
  });

  it('does NOT retry a genuine parent abort', async () => {
    const ac = new AbortController();
    let calls = 0;
    const p = withRetry(
      () =>
        withTimeout((signal) => {
          calls += 1;
          return abortableNeverResolves(signal);
        }, 1000, ac.signal),
      { maxRetries: 3, baseDelayMs: 1, signal: ac.signal },
    );
    ac.abort();
    let err;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(isAbortError(err)).toBe(true);
    expect(calls).toBe(1); // aborted once, never retried
  });

  it('does not retry a permanent (4xx) error', async () => {
    let calls = 0;
    let err;
    try {
      await withRetry(
        () => {
          calls += 1;
          return Promise.reject(Object.assign(new Error('not found'), { status: 404 }));
        },
        { maxRetries: 3, baseDelayMs: 1 },
      );
    } catch (e) {
      err = e;
    }
    expect(err?.status).toBe(404);
    expect(calls).toBe(1);
  });

  it('retries a transient (5xx) error', async () => {
    let calls = 0;
    const out = await withRetry(
      () => {
        calls += 1;
        if (calls < 2) return Promise.reject(Object.assign(new Error('bad gateway'), { status: 502 }));
        return Promise.resolve('recovered');
      },
      { maxRetries: 3, baseDelayMs: 1 },
    );
    expect(out).toBe('recovered');
    expect(calls).toBe(2);
  });
});
