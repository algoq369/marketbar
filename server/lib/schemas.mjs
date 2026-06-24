// server/lib/schemas.mjs — Zod schemas for every zone-CRUD + push boundary (T3).
// Reject bad input with 400 + reason. Ranges enforced (upper > lower,
// approachThreshold 0–50), enums checked, max lengths capped. Server-managed
// runtime fields are NOT accepted from clients — they are stripped/ignored.

import { z } from 'zod';
import { KNOWN_ASSET_IDS } from './assets.mjs';

const finiteNumber = z.number().finite();

/** Body for POST /api/zones — everything a client may set on create. */
export const zoneCreateSchema = z
  .object({
    assetId: z.enum(KNOWN_ASSET_IDS),
    label: z.string().trim().min(1, 'label required').max(80, 'label max 80 chars'),
    upper: finiteNumber.positive('upper must be > 0'),
    lower: finiteNumber.positive('lower must be > 0'),
    approachThreshold: finiteNumber.min(0).max(50, 'approachThreshold must be 0–50'),
    direction: z.enum(['into', 'above', 'below']).default('into'),
    enabled: z.boolean().default(true),
    notifyOnApproach: z.boolean().default(true),
    notifyOnEnter: z.boolean().default(true),
    // action is always 'notify' in Phase 1. 'trade' is accepted into the schema
    // for forward-compat but tradeConfig stays inert. // PHASE 2
    action: z.enum(['notify', 'trade']).default('notify'),
  })
  .strict()
  .refine((z_) => z_.upper > z_.lower, {
    message: 'upper must be greater than lower',
    path: ['upper'],
  });

/** Body for PUT /api/zones/:id — all fields optional, same constraints. */
export const zoneUpdateSchema = z
  .object({
    assetId: z.enum(KNOWN_ASSET_IDS).optional(),
    label: z.string().trim().min(1).max(80).optional(),
    upper: finiteNumber.positive().optional(),
    lower: finiteNumber.positive().optional(),
    approachThreshold: finiteNumber.min(0).max(50).optional(),
    direction: z.enum(['into', 'above', 'below']).optional(),
    enabled: z.boolean().optional(),
    notifyOnApproach: z.boolean().optional(),
    notifyOnEnter: z.boolean().optional(),
    action: z.enum(['notify', 'trade']).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'no fields to update' });

/** Body for POST /api/push/register. */
export const pushRegisterSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^Expo(?:nent)?PushToken\[[^\]]+\]$/, 'must be a valid Expo push token'),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  })
  .strict();

/**
 * Validate `merged` (existing zone + update patch) keeps upper > lower after a
 * partial PUT. Returns an error string or null.
 * @param {{ upper: number, lower: number }} merged
 * @returns {string | null}
 */
export function validateBounds(merged) {
  if (!(merged.upper > merged.lower)) return 'upper must be greater than lower';
  return null;
}
