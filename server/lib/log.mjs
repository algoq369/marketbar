// server/lib/log.mjs — structured JSON-line logger with secret redaction (T13).
// Emits one JSON object per line: {ts, level, component, msg, ...ctx}.
// Redacts anything key/secret/token-like so push tokens & API keys never leak
// into logs. No console.log of raw context anywhere else in the engine.

/** Levels in increasing severity; LOG_LEVEL env gates output. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

/** Field names whose values must never be logged in full. */
const SECRET_KEY = /(?:key|secret|token|authorization|auth|password|passphrase|cookie|signature|apikey)/i;

/**
 * Recursively redact secret-like fields and mask Expo push tokens. Guards
 * against circular references and pathological depth so a logger call (often in
 * a catch block) can never itself throw.
 * @param {unknown} value
 * @param {string} [keyName]
 * @param {WeakSet<object>} [seen]
 * @param {number} [depth]
 * @returns {unknown}
 */
function redact(value, keyName = '', seen = new WeakSet(), depth = 0) {
  if (keyName && SECRET_KEY.test(keyName)) return '[redacted]';
  if (depth > 8) return '[depth-limit]';

  if (typeof value === 'string') {
    // Mask Expo push tokens even when the field name is innocuous (e.g. "to").
    if (/^ExponentPushToken\[/.test(value) || /^ExpoPushToken\[/.test(value)) {
      return value.slice(0, 18) + '…]';
    }
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[fn]';
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    return value.map((v) => redact(v, '', seen, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    // Errors don't enumerate name/message/stack via Object.entries — surface them.
    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k, seen, depth + 1);
    return out;
  }
  return value;
}

/**
 * @param {keyof typeof LEVELS} level
 * @param {string} component
 * @param {string} msg
 * @param {Record<string, unknown>} [ctx]
 */
function emit(level, component, msg, ctx) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    ...(ctx ? /** @type {object} */ (redact(ctx)) : {}),
  };
  // Single stdout/stderr write of a JSON line — the one sanctioned console use.
  // Stringify is guarded so a logger call can never crash the caller.
  let text;
  try {
    text = JSON.stringify(line);
  } catch {
    text = JSON.stringify({ ts: line.ts, level, component, msg, _logError: 'unserializable context' });
  }
  if (level === 'error' || level === 'warn') process.stderr.write(text + '\n');
  else process.stdout.write(text + '\n');
}

/**
 * Create a component-scoped logger.
 * @param {string} component
 * @returns {{ debug: Fn, info: Fn, warn: Fn, error: Fn, child: (sub: string) => ReturnType<typeof createLogger> }}
 * @typedef {(msg: string, ctx?: Record<string, unknown>) => void} Fn
 */
export function createLogger(component) {
  return {
    debug: (msg, ctx) => emit('debug', component, msg, ctx),
    info: (msg, ctx) => emit('info', component, msg, ctx),
    warn: (msg, ctx) => emit('warn', component, msg, ctx),
    error: (msg, ctx) => emit('error', component, msg, ctx),
    child: (sub) => createLogger(`${component}:${sub}`),
  };
}

// Exported for unit testing the redaction logic.
export const __test = { redact };
