// server/lib/zoneEngine.mjs — PURE zone math + transition logic (T17 testable core).
// No I/O, no fetch, no fs — every function here is deterministic and unit-tested.
// This is the money path: it decides when an alert fires. Keep it pure.

/**
 * @typedef {'into' | 'above' | 'below'} ZoneDirection
 * @typedef {'idle' | 'approaching' | 'inside'} ZoneState
 *
 * @typedef {Object} Zone
 * @property {string} id
 * @property {string} assetId            Canonical asset id ('bitcoin','gold','sp500').
 * @property {string} label
 * @property {number} upper              Upper boundary (> lower).
 * @property {number} lower              Lower boundary.
 * @property {number} approachThreshold  % distance to nearer boundary that counts as "approaching".
 * @property {ZoneDirection} direction   Stored for forward-compat; see note below.
 * @property {boolean} enabled
 * @property {boolean} notifyOnApproach
 * @property {boolean} notifyOnEnter
 * @property {'notify' | 'trade'} action ALWAYS 'notify' in Phase 1.
 * @property {null} tradeConfig          // PHASE 2 — inert.
 * @property {string} createdAt
 */

// NOTE on `direction`: classifyZoneState below is deliberately direction-agnostic —
// it matches the spec exactly (nearer boundary, % threshold). `direction` is stored,
// validated, and surfaced in the alert wording today; in PHASE 2 it selects the trade
// side (long on 'below'/'into' from beneath, short on 'above') without touching this math.

/**
 * Geometry of a price relative to a zone, computed once and shared by the
 * public functions so distance and state can never disagree.
 *
 * `pct` is the gap to the nearer boundary expressed as a percentage **of that
 * boundary's price** (the conventional "X% away from the level"). It is 0 when
 * the price sits inside the zone.
 *
 * @param {number} price
 * @param {Zone} zone
 * @returns {{ side: 'above' | 'below' | 'inside', pct: number, boundary: number }}
 */
function geometry(price, zone) {
  const { lower, upper } = zone;
  if (price > upper) {
    return { side: 'above', pct: pctGap(price - upper, upper), boundary: upper };
  }
  if (price < lower) {
    return { side: 'below', pct: pctGap(lower - price, lower), boundary: lower };
  }
  return { side: 'inside', pct: 0, boundary: price >= (lower + upper) / 2 ? upper : lower };
}

/**
 * Gap as a % of the boundary's MAGNITUDE so the percentage is always a
 * non-negative distance (distanceToZone re-applies the sign). Dividing by the
 * signed boundary would flip the sign for negative-priced zones; dividing by 0
 * would yield ±Infinity. Zod guards CRUD to positive bounds, but this keeps the
 * pure core correct if called directly. A degenerate (0 / non-finite) boundary
 * yields Infinity → classified 'idle', never NaN.
 * @param {number} gap @param {number} boundary
 */
function pctGap(gap, boundary) {
  const denom = Math.abs(boundary);
  if (!Number.isFinite(denom) || denom === 0) return Infinity;
  return (gap / denom) * 100;
}

/**
 * Signed percentage distance to the nearer boundary.
 *   > 0  → price is ABOVE the zone (that many % above `upper`)
 *   < 0  → price is BELOW the zone (that many % below `lower`)
 *   = 0  → price is INSIDE the zone
 *
 * @param {number} price
 * @param {Zone} zone
 * @returns {number} signed % distance
 */
export function distanceToZone(price, zone) {
  if (!Number.isFinite(price)) return NaN;
  const g = geometry(price, zone);
  if (g.side === 'inside') return 0;
  return g.side === 'above' ? g.pct : -g.pct;
}

/**
 * Classify a price into a zone state.
 *   inside       = lower <= price <= upper
 *   approaching  = not inside, but within approachThreshold% of the nearer boundary
 *   idle         = otherwise
 *
 * @param {number} price
 * @param {Zone} zone
 * @returns {ZoneState}
 */
export function classifyZoneState(price, zone) {
  if (!Number.isFinite(price)) return 'idle';
  const g = geometry(price, zone);
  if (g.side === 'inside') return 'inside';
  return g.pct <= zone.approachThreshold ? 'approaching' : 'idle';
}

/**
 * Decide which notification(s) fire on a state TRANSITION. Debounced: returns
 * all-false when the state is unchanged, so an alert fires once per transition.
 *
 *   approach → on idle → approaching
 *   enter    → on (idle | approaching) → inside
 *
 * Gated by the zone's notify flags so callers get a single decision point.
 *
 * @param {ZoneState} prevState
 * @param {ZoneState} newState
 * @param {Zone} zone
 * @returns {{ approach: boolean, enter: boolean }}
 */
export function shouldFire(prevState, newState, zone) {
  if (prevState === newState) return { approach: false, enter: false };

  const approach = newState === 'approaching' && prevState === 'idle' && zone.notifyOnApproach === true;
  const enter = newState === 'inside' && prevState !== 'inside' && zone.notifyOnEnter === true;

  return { approach, enter };
}

/**
 * Human-readable alert body. Pure so it is covered by the test suite.
 * Example: "BTC approaching demand zone — $62,400 (zone $61,000–$62,000)".
 *
 * @param {Zone} zone
 * @param {number} price
 * @param {'approach' | 'enter'} kind
 * @param {string} [displaySymbol] Short ticker for the headline (defaults to assetId).
 * @returns {{ title: string, body: string }}
 */
export function buildAlertMessage(zone, price, kind, displaySymbol) {
  const sym = (displaySymbol || zone.assetId).toUpperCase();
  const g = geometry(price, zone);
  const verb = kind === 'enter' ? 'entered' : 'approaching';
  const fromSide = g.side === 'above' ? ' from above' : g.side === 'below' ? ' from below' : '';
  const title = `${sym} ${kind === 'enter' ? 'entered' : 'approaching'} ${zone.label}`;
  const body =
    `${sym} ${verb} ${zone.label}${kind === 'approach' ? fromSide : ''} — ` +
    `${fmtPrice(price)} (zone ${fmtPrice(zone.lower)}–${fmtPrice(zone.upper)})`;
  return { title, body };
}

/**
 * Compact USD formatting that keeps precision for sub-dollar assets.
 * @param {number} n
 * @returns {string}
 */
function fmtPrice(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 0 : abs >= 1 ? 2 : 6;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}
