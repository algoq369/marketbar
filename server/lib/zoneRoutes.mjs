// server/lib/zoneRoutes.mjs — mounts the zone-alert HTTP surface on an Express
// app. Imported by BOTH server/index.mjs (local) and api/index.mjs (Vercel) so
// the two backends expose identical, Zod-validated, rate-limited endpoints.
//
// Endpoints:
//   GET    /api/zones            list
//   POST   /api/zones            create (zoneCreateSchema)
//   PUT    /api/zones/:id        update (zoneUpdateSchema)
//   DELETE /api/zones/:id        delete
//   POST   /api/zones/:id/toggle flip enabled
//   GET    /api/zones/status     live price/state/distance per zone
//   GET    /api/zones/evaluate   run ONE evaluation pass (Vercel cron / pinger)
//   POST   /api/push/register    store an Expo push token (pushRegisterSchema)

import { timingSafeEqual } from 'node:crypto';
import { createLogger } from './log.mjs';
import { createCircuitBreaker } from './circuitBreaker.mjs';
import { createRateLimiter } from './rateLimit.mjs';
import { zoneCreateSchema, zoneUpdateSchema, pushRegisterSchema, validateBounds } from './schemas.mjs';
import {
  listZones,
  getZone,
  createZone,
  updateZone,
  deleteZone,
  addToken,
} from './store.mjs';
import { runEvaluationPass, zonesStatus } from './evaluate.mjs';

// Process-wide singletons; the poller in server/index.mjs reuses this exact
// breaker + logger so failure state is shared across the engine.
const logger = createLogger('zones');
const breaker = createCircuitBreaker({ threshold: 4, cooldownMs: 120_000 });

/** Engine context passed to evaluate/prices/push. */
export function engineContext(signal) {
  return { breaker, logger, signal };
}

/** Flatten a Zod error into a compact 400 reason string. */
function zodReason(err) {
  return err.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; ');
}

/** Constant-time-ish secret compare (length is allowed to leak). */
function secretEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Mount all zone-alert routes on `app`.
 * @param {import('express').Express} app
 */
export function registerZoneRoutes(app) {
  // Reads can be polled (mobile status); mutations are tighter.
  const readLimiter = createRateLimiter({ windowMs: 60_000, max: 240 });
  const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
  const evalLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

  // ── List ──
  app.get('/api/zones', readLimiter, (_req, res) => {
    res.json({ zones: listZones() });
  });

  // ── Live status (price / state / distance) ── registered before :id routes ──
  app.get('/api/zones/status', readLimiter, async (_req, res) => {
    try {
      res.json(await zonesStatus(engineContext()));
    } catch (err) {
      logger.error('status failed', { err: String(err) });
      res.status(500).json({ error: 'status failed' });
    }
  });

  // ── One evaluation pass (Vercel cron / uptime pinger triggers this) ──
  app.get('/api/zones/evaluate', evalLimiter, async (req, res) => {
    // Optional shared-secret guard for the internet-facing trigger.
    const required = process.env.EVALUATE_TOKEN;
    if (required) {
      const supplied = req.get('x-evaluate-token') || req.query.token;
      if (!supplied || !secretEqual(supplied, required)) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    try {
      res.json(await runEvaluationPass(engineContext()));
    } catch (err) {
      logger.error('evaluate failed', { err: String(err) });
      res.status(500).json({ error: 'evaluate failed' });
    }
  });

  // ── Create ──
  app.post('/api/zones', writeLimiter, (req, res) => {
    const parsed = zoneCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid zone', reason: zodReason(parsed.error) });
    const zone = createZone(parsed.data);
    logger.info('zone created', { id: zone.id, assetId: zone.assetId });
    res.status(201).json({ ok: true, zone });
  });

  // ── Update ──
  app.put('/api/zones/:id', writeLimiter, (req, res) => {
    const existing = getZone(req.params.id);
    if (!existing) return res.status(404).json({ error: 'zone not found' });

    const parsed = zoneUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid update', reason: zodReason(parsed.error) });

    const merged = { upper: parsed.data.upper ?? existing.upper, lower: parsed.data.lower ?? existing.lower };
    const boundsErr = validateBounds(merged);
    if (boundsErr) return res.status(400).json({ error: 'invalid update', reason: boundsErr });

    const zone = updateZone(req.params.id, parsed.data);
    logger.info('zone updated', { id: req.params.id, fields: Object.keys(parsed.data) });
    res.json({ ok: true, zone });
  });

  // ── Delete ──
  app.delete('/api/zones/:id', writeLimiter, (req, res) => {
    if (!deleteZone(req.params.id)) return res.status(404).json({ error: 'zone not found' });
    logger.info('zone deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  // ── Toggle enabled ──
  app.post('/api/zones/:id/toggle', writeLimiter, (req, res) => {
    const existing = getZone(req.params.id);
    if (!existing) return res.status(404).json({ error: 'zone not found' });
    const zone = updateZone(req.params.id, { enabled: !existing.enabled });
    logger.info('zone toggled', { id: req.params.id, enabled: zone?.enabled });
    res.json({ ok: true, zone });
  });

  // ── Register an Expo push token ──
  app.post('/api/push/register', writeLimiter, (req, res) => {
    const parsed = pushRegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid token', reason: zodReason(parsed.error) });
    const added = addToken(parsed.data.token, parsed.data.platform);
    logger.info('push token registered', { added, platform: parsed.data.platform ?? 'unknown' });
    res.json({ ok: true, added });
  });
}
