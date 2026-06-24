// server/lib/push.mjs — Expo push delivery. Sends to the Expo push API in
// chunks of 100, wrapped in withRetry (T2) + 8s timeout (T10). Tokens that
// Expo reports as DeviceNotRegistered are pruned from the store so the list
// self-heals. Token values are never logged in full (logger redacts them).

import { withRetry, withTimeout } from './retry.mjs';
import { HttpError, classifyError } from './errors.mjs';
import { listTokens, removeToken } from './store.mjs';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;
const TIMEOUT_MS = 8000;

/** @param {T[]} arr @param {number} size @template T @returns {T[][]} */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send one notification to every registered token.
 *
 * @param {{ title: string, body: string, data?: Record<string, unknown> }} msg
 * @param {{ logger: any, signal?: AbortSignal }} ctx
 * @returns {Promise<{ sent: number, failed: number, pruned: number }>}
 */
export async function sendPush(msg, ctx) {
  const { logger, signal } = ctx;
  const tokens = listTokens();
  if (tokens.length === 0) {
    logger.info('no push tokens registered; alert not delivered', { title: msg.title });
    return { sent: 0, failed: 0, pruned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  for (const batch of chunk(tokens, CHUNK)) {
    const messages = batch.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      sound: 'default',
      priority: 'high',
      data: msg.data ?? {},
    }));

    try {
      const result = await withRetry(
        () =>
          withTimeout(async (s) => {
            const resp = await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              signal: s,
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(messages),
            });
            if (!resp.ok) throw new HttpError(resp.status, `Expo push ${resp.status}`);
            return resp.json();
          }, TIMEOUT_MS, signal),
        {
          maxRetries: 2,
          onRetry: (err, attempt, delayMs) =>
            logger.warn('retrying push batch', { attempt, delayMs, err: classifyError(err) }),
        },
      );

      const tickets = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket, i) => {
        if (ticket?.status === 'ok') {
          sent += 1;
        } else {
          failed += 1;
          const code = ticket?.details?.error;
          if (code === 'DeviceNotRegistered') {
            removeToken(batch[i]);
            pruned += 1;
          }
          logger.warn('push ticket error', { code: code ?? 'unknown' });
        }
      });
    } catch (err) {
      failed += batch.length;
      logger.error('push batch failed', { count: batch.length, err: classifyError(err) });
    }
  }

  logger.info('push delivery summary', { title: msg.title, sent, failed, pruned });
  return { sent, failed, pruned };
}
