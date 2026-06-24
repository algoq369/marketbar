// server/lib/store.mjs — file-backed persistence for zones + Expo push tokens.
// Zones live in server/zones.json; tokens in server/push-tokens.json (paths
// overridable via env for Vercel's read-only FS / /tmp). Writes are atomic
// (tmp + rename) and best-effort: a read-only FS logs a warning and keeps the
// in-memory copy rather than crashing the engine.
//
// T4: zone ids come from crypto.randomBytes — never Math.random().

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './log.mjs';

const log = createLogger('store');
const here = dirname(fileURLToPath(import.meta.url)); // …/server/lib

// On serverless (Vercel/Lambda) the repo FS is read-only — only /tmp is
// writable (and is per-instance + ephemeral). Default there so writes succeed
// within a warm instance; override with ZONES_PATH/PUSH_TOKENS_PATH. Durable,
// cross-instance state needs a real DB — see // PHASE 2 note in api/index.mjs.
const onServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const defaultDir = onServerless ? '/tmp' : resolve(here, '..');

const ZONES_PATH = process.env.ZONES_PATH || resolve(defaultDir, 'zones.json');
const TOKENS_PATH = process.env.PUSH_TOKENS_PATH || resolve(defaultDir, 'push-tokens.json');

/** @typedef {import('./zoneEngine.mjs').Zone} Zone */
/**
 * Zones carry server-managed runtime fields appended to the spec model. These
 * are never client-settable; they let the stateless Vercel evaluate endpoint
 * detect transitions across cold starts.
 * @typedef {Zone & {
 *   lastState?: import('./zoneEngine.mjs').ZoneState,
 *   lastPrice?: number,
 *   lastEvaluatedAt?: string,
 *   lastFiredApproachAt?: string | null,
 *   lastFiredEnterAt?: string | null,
 * }} StoredZone
 */

/** @param {string} path @param {unknown} fallback */
function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    log.warn('failed to read state file; starting empty', { path, err: String(err) });
    return fallback;
  }
}

/** Atomic-ish write; degrades to in-memory on read-only FS. @param {string} path @param {unknown} data */
function writeJson(path, data) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, path);
    return true;
  } catch (err) {
    // Vercel serverless FS is read-only outside /tmp — expected; don't crash.
    log.warn('persist failed (read-only FS?); keeping in-memory only', { path, err: String(err) });
    return false;
  }
}

/** @type {StoredZone[]} */
let zones = /** @type {StoredZone[]} */ (readJson(ZONES_PATH, []));
/** @type {{ token: string, platform?: string, registeredAt: string }[]} */
let tokens = readJson(TOKENS_PATH, []);

// ─── Zones ──────────────────────────────────────────────────────────

/** @returns {StoredZone[]} a shallow copy so callers can't mutate the cache. */
export function listZones() {
  return zones.map((z) => ({ ...z }));
}

/** @param {string} id @returns {StoredZone | undefined} */
export function getZone(id) {
  const z = zones.find((x) => x.id === id);
  return z ? { ...z } : undefined;
}

/**
 * Create a zone from already-validated input. Generates the id + createdAt and
 * sets the inert Phase-1 fields.
 * @param {object} input validated by zoneCreateSchema
 * @returns {StoredZone}
 */
export function createZone(input) {
  /** @type {StoredZone} */
  const zone = {
    id: 'zn_' + randomBytes(12).toString('hex'),
    assetId: input.assetId,
    label: input.label,
    upper: input.upper,
    lower: input.lower,
    approachThreshold: input.approachThreshold,
    direction: input.direction,
    enabled: input.enabled,
    notifyOnApproach: input.notifyOnApproach,
    notifyOnEnter: input.notifyOnEnter,
    action: input.action, // 'notify' in Phase 1
    tradeConfig: null, // PHASE 2 — leave inert
    createdAt: new Date().toISOString(),
    lastState: 'idle',
    lastPrice: undefined,
    lastEvaluatedAt: undefined,
    lastFiredApproachAt: null,
    lastFiredEnterAt: null,
  };
  zones.push(zone);
  persistZones();
  return { ...zone };
}

/**
 * Apply a validated partial patch to a zone.
 * @param {string} id
 * @param {object} patch validated by zoneUpdateSchema
 * @returns {StoredZone | undefined}
 */
export function updateZone(id, patch) {
  const z = zones.find((x) => x.id === id);
  if (!z) return undefined;
  Object.assign(z, patch);
  persistZones();
  return { ...z };
}

/** @param {string} id @returns {boolean} */
export function deleteZone(id) {
  const before = zones.length;
  zones = zones.filter((x) => x.id !== id);
  if (zones.length === before) return false;
  persistZones();
  return true;
}

/**
 * Persist the in-memory runtime fields the poller mutated. Accepts the whole
 * updated zone object (must already be the cached reference's data).
 * @param {StoredZone} updated
 */
export function saveZoneRuntime(updated) {
  const z = zones.find((x) => x.id === updated.id);
  if (!z) return;
  z.lastState = updated.lastState;
  z.lastPrice = updated.lastPrice;
  z.lastEvaluatedAt = updated.lastEvaluatedAt;
  z.lastFiredApproachAt = updated.lastFiredApproachAt;
  z.lastFiredEnterAt = updated.lastFiredEnterAt;
}

export function persistZones() {
  return writeJson(ZONES_PATH, zones);
}

// ─── Push tokens ────────────────────────────────────────────────────

/** @returns {string[]} */
export function listTokens() {
  return tokens.map((t) => t.token);
}

/** @param {string} token @param {string} [platform] @returns {boolean} true if newly added */
export function addToken(token, platform) {
  if (tokens.some((t) => t.token === token)) return false;
  tokens.push({ token, platform, registeredAt: new Date().toISOString() });
  writeJson(TOKENS_PATH, tokens);
  return true;
}

/** @param {string} token @returns {boolean} */
export function removeToken(token) {
  const before = tokens.length;
  tokens = tokens.filter((t) => t.token !== token);
  if (tokens.length === before) return false;
  writeJson(TOKENS_PATH, tokens);
  return true;
}

export const paths = { ZONES_PATH, TOKENS_PATH };
