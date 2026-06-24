// server/lib/evaluate.mjs — ONE evaluation pass over all enabled zones.
// Shared by the local setInterval poller (server/index.mjs) and the stateless
// Vercel GET /api/zones/evaluate endpoint (api/index.mjs). Pure orchestration:
// fetch prices → classify → fire on transitions only (debounced) → persist
// runtime state. Each pass is tagged with duration + per-source status (T13).

import {
  classifyZoneState,
  distanceToZone,
  shouldFire,
  buildAlertMessage,
} from './zoneEngine.mjs';
import { displaySymbol } from './assets.mjs';
import { getPrices } from './prices.mjs';
import { sendPush } from './push.mjs';
import { listZones, saveZoneRuntime, persistZones } from './store.mjs';
import { classifyError } from './errors.mjs';

// Single-flight guard: ALL entry points (the local 45s poller AND direct
// GET /api/zones/evaluate hits) share this, so two passes can never run at once
// against the shared in-memory zones array and double-fire an alert.
/** @type {Promise<any> | null} */
let inFlight = null;

/**
 * @param {{ breaker: any, logger: any, signal?: AbortSignal, now?: () => number }} ctx
 * @returns {Promise<{
 *   ts: string, durationMs: number, zonesEvaluated: number, alertsFired: number,
 *   sources: Record<string,string>, transitions: Array<object>, skipped: number
 * }>}
 */
export function runEvaluationPass(ctx) {
  if (inFlight) return inFlight; // coalesce concurrent callers onto the running pass
  inFlight = evaluateOnce(ctx).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * @param {{ breaker: any, logger: any, signal?: AbortSignal, now?: () => number }} ctx
 */
async function evaluateOnce(ctx) {
  const { breaker, logger } = ctx;
  const startedAt = Date.now();

  const enabled = listZones().filter((z) => z.enabled);
  if (enabled.length === 0) {
    const out = {
      ts: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      zonesEvaluated: 0,
      alertsFired: 0,
      sources: {},
      transitions: [],
      skipped: 0,
    };
    logger.info('poll cycle (no enabled zones)', out);
    return out;
  }

  const assetIds = [...new Set(enabled.map((z) => z.assetId))];
  const { prices, sources } = await getPrices(assetIds, ctx);

  let alertsFired = 0;
  let skipped = 0;
  /** @type {Array<object>} */
  const transitions = [];

  for (const zone of enabled) {
    const price = prices.get(zone.assetId);
    if (price === undefined) {
      // No price this cycle → leave state untouched, don't fire on stale data.
      skipped += 1;
      continue;
    }

    const prevState = zone.lastState || 'idle';
    const newState = classifyZoneState(price, zone);
    const fire = shouldFire(prevState, newState, zone);
    const nowIso = new Date().toISOString();

    if (fire.approach || fire.enter) {
      transitions.push({ id: zone.id, assetId: zone.assetId, prevState, newState, price });
      const kind = fire.enter ? 'enter' : 'approach';
      const message = buildAlertMessage(zone, price, kind, displaySymbol(zone.assetId));
      try {
        await sendPush(
          { title: message.title, body: message.body, data: { zoneId: zone.id, assetId: zone.assetId, kind, price } },
          ctx,
        );
        alertsFired += 1;
        if (fire.approach) zone.lastFiredApproachAt = nowIso;
        if (fire.enter) zone.lastFiredEnterAt = nowIso;
      } catch (err) {
        // Never let a push failure abort the loop — alert is best-effort.
        logger.error('alert delivery threw', { zoneId: zone.id, err: classifyError(err) });
      }
    }

    zone.lastState = newState;
    zone.lastPrice = price;
    zone.lastEvaluatedAt = nowIso;
    saveZoneRuntime(zone);
  }

  persistZones();

  const out = {
    ts: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    zonesEvaluated: enabled.length,
    alertsFired,
    sources,
    transitions,
    skipped,
  };
  logger.info('poll cycle complete', out);
  return out;
}

/**
 * Live status for the dashboard/mobile: each zone with current price, state,
 * signed distance %, and last-fired timestamps.
 * @param {{ breaker: any, logger: any, signal?: AbortSignal }} ctx
 */
export async function zonesStatus(ctx) {
  const zones = listZones();
  const assetIds = [...new Set(zones.filter((z) => z.enabled).map((z) => z.assetId))];
  const { prices, sources } = assetIds.length ? await getPrices(assetIds, ctx) : { prices: new Map(), sources: {} };

  const items = zones.map((zone) => {
    const price = prices.has(zone.assetId) ? prices.get(zone.assetId) : zone.lastPrice;
    const hasPrice = typeof price === 'number' && Number.isFinite(price);
    return {
      id: zone.id,
      assetId: zone.assetId,
      label: zone.label,
      upper: zone.upper,
      lower: zone.lower,
      direction: zone.direction,
      enabled: zone.enabled,
      action: zone.action,
      currentPrice: hasPrice ? price : null,
      state: hasPrice ? classifyZoneState(price, zone) : zone.lastState ?? 'idle',
      distancePct: hasPrice ? finiteOrNull(distanceToZone(price, zone)) : null,
      priceFresh: prices.has(zone.assetId),
      lastEvaluatedAt: zone.lastEvaluatedAt ?? null,
      lastFiredApproachAt: zone.lastFiredApproachAt ?? null,
      lastFiredEnterAt: zone.lastFiredEnterAt ?? null,
    };
  });

  return { ts: new Date().toISOString(), sources, zones: items };
}

/** Round to 4dp, or null if non-finite (degenerate zone) — never emits Infinity/NaN. */
function finiteOrNull(n) {
  return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
}
