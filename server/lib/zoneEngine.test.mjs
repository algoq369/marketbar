// server/lib/zoneEngine.test.mjs — unit tests for the money-path core (T17).
// Covers distance math, state classification, transition/debounce logic, and
// alert message formatting. Run: NODE_ENV=development npm test

import { describe, it, expect } from 'vitest';
import {
  distanceToZone,
  classifyZoneState,
  shouldFire,
  buildAlertMessage,
} from './zoneEngine.mjs';

/** Build a zone with sensible defaults; override what each test needs. */
function zone(overrides = {}) {
  return {
    id: 'zn_test',
    assetId: 'bitcoin',
    label: 'demand zone',
    upper: 62000,
    lower: 61000,
    approachThreshold: 1, // %
    direction: 'into',
    enabled: true,
    notifyOnApproach: true,
    notifyOnEnter: true,
    action: 'notify',
    tradeConfig: null,
    createdAt: '2026-06-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('distanceToZone', () => {
  it('is 0 when price is inside the zone', () => {
    expect(distanceToZone(61500, zone())).toBe(0);
    expect(distanceToZone(61000, zone())).toBe(0); // lower boundary inclusive
    expect(distanceToZone(62000, zone())).toBe(0); // upper boundary inclusive
  });

  it('is positive above the zone (% of upper boundary)', () => {
    // (62400 - 62000) / 62000 * 100 = 0.6452%
    expect(distanceToZone(62400, zone())).toBeCloseTo(0.6452, 3);
  });

  it('is negative below the zone (% of lower boundary)', () => {
    // (61000 - 60500) / 61000 * 100 = 0.8197%, signed negative
    expect(distanceToZone(60500, zone())).toBeCloseTo(-0.8197, 3);
  });

  it('returns NaN for non-finite price', () => {
    expect(Number.isNaN(distanceToZone(NaN, zone()))).toBe(true);
    expect(Number.isNaN(distanceToZone(Infinity, zone()))).toBe(true);
  });
});

// Defense-in-depth: the API guards bounds with Zod (.positive()), but the pure
// core must stay correct if called directly with odd data (negative/zero bounds).
describe('geometry robustness (negative / zero boundaries)', () => {
  it('keeps the sign correct for a negative-priced zone', () => {
    const z = zone({ lower: -100, upper: -10 });
    expect(distanceToZone(-200, z)).toBeLessThan(0); // far below → negative
    expect(distanceToZone(0, z)).toBeGreaterThan(0); // above → positive
    expect(distanceToZone(-50, z)).toBe(0); // inside
  });

  it('classifies a negative-priced zone correctly', () => {
    const z = zone({ lower: -100, upper: -10, approachThreshold: 1 });
    expect(classifyZoneState(-50, z)).toBe('inside');
    expect(classifyZoneState(-200, z)).toBe('idle'); // far below
    // 1% below lower(-100) magnitude: -100 - 1 = -101 → 1% gap → approaching
    expect(classifyZoneState(-101, z)).toBe('approaching');
  });

  it('never yields NaN/Infinity state for a zero boundary; distance stays guardable', () => {
    const z = zone({ lower: 0, upper: 10, approachThreshold: 1 });
    expect(classifyZoneState(-5, z)).toBe('idle'); // degenerate → idle, never throws
    expect(classifyZoneState(5, z)).toBe('inside');
    expect(Number.isNaN(distanceToZone(-5, z))).toBe(false); // Infinity sentinel, not NaN
  });
});

describe('classifyZoneState', () => {
  it('inside when lower <= price <= upper (inclusive)', () => {
    expect(classifyZoneState(61500, zone())).toBe('inside');
    expect(classifyZoneState(61000, zone())).toBe('inside');
    expect(classifyZoneState(62000, zone())).toBe('inside');
  });

  it('approaching when within threshold% of the nearer boundary (above)', () => {
    expect(classifyZoneState(62400, zone())).toBe('approaching'); // 0.645% < 1%
  });

  it('approaching when within threshold% below the zone', () => {
    expect(classifyZoneState(60500, zone())).toBe('approaching'); // 0.82% < 1%
  });

  it('idle when beyond threshold% of the nearer boundary', () => {
    expect(classifyZoneState(62700, zone())).toBe('idle'); // 1.13% > 1%
    expect(classifyZoneState(60000, zone())).toBe('idle'); // 1.64% > 1%
  });

  it('treats the threshold as inclusive (<=)', () => {
    // exactly 1% above upper: 62000 * 1.01 = 62620
    expect(classifyZoneState(62620, zone())).toBe('approaching');
  });

  it('respects a custom approachThreshold', () => {
    const wide = zone({ approachThreshold: 5 });
    expect(classifyZoneState(62700, wide)).toBe('approaching'); // 1.13% < 5%
    const tight = zone({ approachThreshold: 0.5 });
    expect(classifyZoneState(62400, tight)).toBe('idle'); // 0.645% > 0.5%
  });

  it('is idle for non-finite price', () => {
    expect(classifyZoneState(NaN, zone())).toBe('idle');
  });
});

describe('shouldFire — transitions + debounce', () => {
  it('fires approach on idle -> approaching', () => {
    expect(shouldFire('idle', 'approaching', zone())).toEqual({ approach: true, enter: false });
  });

  it('fires enter on approaching -> inside', () => {
    expect(shouldFire('approaching', 'inside', zone())).toEqual({ approach: false, enter: true });
  });

  it('fires enter on idle -> inside (skips approaching)', () => {
    expect(shouldFire('idle', 'inside', zone())).toEqual({ approach: false, enter: true });
  });

  it('debounces: no re-fire while state is unchanged', () => {
    expect(shouldFire('approaching', 'approaching', zone())).toEqual({ approach: false, enter: false });
    expect(shouldFire('inside', 'inside', zone())).toEqual({ approach: false, enter: false });
    expect(shouldFire('idle', 'idle', zone())).toEqual({ approach: false, enter: false });
  });

  it('does NOT fire approach when leaving the zone (inside -> approaching)', () => {
    expect(shouldFire('inside', 'approaching', zone())).toEqual({ approach: false, enter: false });
  });

  it('does not fire on retreat transitions (inside->idle, approaching->idle)', () => {
    expect(shouldFire('inside', 'idle', zone())).toEqual({ approach: false, enter: false });
    expect(shouldFire('approaching', 'idle', zone())).toEqual({ approach: false, enter: false });
  });

  it('respects notifyOnApproach = false', () => {
    expect(shouldFire('idle', 'approaching', zone({ notifyOnApproach: false }))).toEqual({
      approach: false,
      enter: false,
    });
  });

  it('respects notifyOnEnter = false', () => {
    expect(shouldFire('approaching', 'inside', zone({ notifyOnEnter: false }))).toEqual({
      approach: false,
      enter: false,
    });
  });

  it('fires only enter (not approach) on idle->inside even with both flags on', () => {
    const r = shouldFire('idle', 'inside', zone());
    expect(r.enter).toBe(true);
    expect(r.approach).toBe(false);
  });
});

describe('buildAlertMessage', () => {
  it('formats an approach-from-above message with the zone range', () => {
    const m = buildAlertMessage(zone(), 62400, 'approach', 'BTC');
    expect(m.body).toContain('BTC');
    expect(m.body).toContain('approaching');
    expect(m.body).toContain('from above');
    expect(m.body).toContain('demand zone');
    expect(m.body).toContain('$61,000');
    expect(m.body).toContain('$62,000');
  });

  it('formats an enter message', () => {
    const m = buildAlertMessage(zone(), 61500, 'enter', 'BTC');
    expect(m.title).toContain('BTC');
    expect(m.title).toContain('entered');
    expect(m.body).toContain('entered');
  });

  it('keeps precision for sub-dollar assets', () => {
    const penny = zone({ assetId: 'dogecoin', lower: 0.12, upper: 0.13, label: 'doge zone' });
    const m = buildAlertMessage(penny, 0.135, 'approach', 'DOGE');
    expect(m.body).toContain('0.13');
    expect(m.body).toContain('DOGE');
  });

  it('falls back to assetId when no display symbol given', () => {
    const m = buildAlertMessage(zone(), 62400, 'approach');
    expect(m.title).toContain('BITCOIN');
  });
});
