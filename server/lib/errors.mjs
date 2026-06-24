// server/lib/errors.mjs — error taxonomy + telemetry-safe classification.
// Vendored from ~/webna/packages/stdlib/src/errors/index.ts (T9 classifyError).
// Ported TS → JSDoc-typed .mjs. Do NOT import across repos — this is the local copy.
//
// Key principles:
// - Distinguish transient (retry) vs permanent (log + skip) so one bad fetch
//   never kills the poll loop.
// - .name set explicitly so it survives bundling (constructor.name gets mangled).
// - Fail-closed: unknown errors classify as permanent/generic.

// ─── Base error classes ─────────────────────────────────────────────

/** Base error for all engine errors. */
export class EngineError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'EngineError';
  }
}

/** Operation was aborted via AbortController. */
export class AbortError extends EngineError {
  /** @param {string} [message] */
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/** Operation timed out (hard deadline via AbortController). */
export class TimeoutError extends EngineError {
  /** @param {number} timeoutMs @param {string} [message] */
  constructor(timeoutMs, message) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    /** @type {number} */
    this.timeoutMs = timeoutMs;
  }
}

/** Input validation failed (Zod boundary). */
export class ValidationError extends EngineError {
  /** @param {string} message @param {unknown} [details] */
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    /** @type {unknown} */
    this.details = details;
  }
}

/** HTTP response error carrying a status code (used to decide retryability). */
export class HttpError extends EngineError {
  /** @param {number} status @param {string} [message] */
  constructor(status, message) {
    super(message ?? `HTTP ${status}`);
    this.name = 'HttpError';
    /** @type {number} */
    this.status = status;
  }
}

/** Circuit breaker tripped — too many consecutive failures for a source. */
export class CircuitBreakerError extends EngineError {
  /** @param {string} source @param {number} consecutiveFailures @param {string} [message] */
  constructor(source, consecutiveFailures, message) {
    super(message ?? `Circuit open for "${source}" after ${consecutiveFailures} consecutive failures`);
    this.name = 'CircuitBreakerError';
    /** @type {string} */
    this.source = source;
    /** @type {number} */
    this.consecutiveFailures = consecutiveFailures;
  }
}

// ─── Predicates ─────────────────────────────────────────────────────

/**
 * True if the error is any abort-shaped error.
 * @param {unknown} e
 * @returns {boolean}
 */
export function isAbortError(e) {
  return (
    e instanceof AbortError ||
    (e instanceof Error && e.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError')
  );
}

/**
 * True if the error is a timeout.
 * @param {unknown} e
 * @returns {boolean}
 */
export function isTimeoutError(e) {
  return (
    e instanceof TimeoutError ||
    (e instanceof Error && e.name === 'TimeoutError') ||
    (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'TimeoutError')
  );
}

/** @param {unknown} e @returns {Error} */
export function toError(e) {
  return e instanceof Error ? e : new Error(String(e));
}

/** @param {unknown} e @returns {string} */
export function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Extract errno code (ECONNRESET, ETIMEDOUT, …) from a caught error.
 * @param {unknown} e
 * @returns {string | undefined}
 */
export function getErrnoCode(e) {
  if (e && typeof e === 'object' && 'code' in e && typeof (/** @type {any} */ (e).code) === 'string') {
    return /** @type {any} */ (e).code;
  }
  return undefined;
}

// ─── Classification ─────────────────────────────────────────────────

/** HTTP status codes that are safe to retry. */
export const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524, 529]);

/** Network error codes that indicate a transient failure. */
const RETRYABLE_ERRNO = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN',
  'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);

/**
 * Decide whether an error is transient (worth retrying / backing off) or
 * permanent (log + skip; retrying will not help).
 *
 * Aborts are never retryable. Timeouts and known network/5xx errors are.
 * Everything else fails closed → permanent.
 *
 * @param {unknown} error
 * @returns {boolean} true = transient, false = permanent
 */
export function isTransientError(error) {
  if (isAbortError(error)) return false;
  if (isTimeoutError(error)) return true;

  if (error && typeof error === 'object') {
    const status = /** @type {any} */ (error).status;
    if (typeof status === 'number') return RETRYABLE_STATUS_CODES.has(status);

    const code = getErrnoCode(error);
    if (code && RETRYABLE_ERRNO.has(code)) return true;

    if (/** @type {any} */ (error).retryable === true) return true;

    // Bare fetch() network failures surface as TypeError("fetch failed").
    if (error instanceof TypeError && /fetch failed|network|terminated/i.test(error.message)) return true;
  }

  return false;
}

/**
 * Classify an error into a short, telemetry-safe string (no PII / paths / code).
 * In bundled builds constructor.name is mangled to 1–3 chars, so we read .name
 * (set explicitly above) and errno codes instead.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function classifyError(error) {
  if (error && typeof error === 'object') {
    const status = /** @type {any} */ (error).status;
    if (typeof status === 'number') return `HTTP:${status}`;

    const errno = getErrnoCode(error);
    if (errno) return `Errno:${errno}`;
  }

  if (error instanceof Error) {
    if (error.name && error.name !== 'Error' && error.name.length > 3) {
      return error.name.slice(0, 60);
    }
    return 'Error';
  }

  return 'UnknownError';
}
