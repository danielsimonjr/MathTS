import { describe, it, expect } from 'vitest';
import { PI, E, TAU, PHI, SQRT2, SQRT1_2, LN2, LN10, LOG2E, LOG10E } from '../src/index.js';

/**
 * Named mathematical constants. These back the documented
 * `import { PI, E, TAU, PHI } from '@danielsimonjr/mathts-core'` API
 * (docs/reference/constants.md), which previously referenced non-existent exports.
 */
describe('core math constants', () => {
  it('match their Math.* / closed-form values', () => {
    expect(PI).toBe(Math.PI);
    expect(E).toBe(Math.E);
    expect(TAU).toBe(2 * Math.PI);
    expect(PHI).toBeCloseTo((1 + Math.sqrt(5)) / 2, 15);
    expect(SQRT2).toBe(Math.SQRT2);
    expect(SQRT1_2).toBe(Math.SQRT1_2);
    expect(LN2).toBe(Math.LN2);
    expect(LN10).toBe(Math.LN10);
    expect(LOG2E).toBe(Math.LOG2E);
    expect(LOG10E).toBe(Math.LOG10E);
  });

  it('satisfy the golden-ratio identity φ² = φ + 1', () => {
    expect(PHI * PHI).toBeCloseTo(PHI + 1, 14);
  });

  it('are all finite numbers', () => {
    for (const c of [PI, E, TAU, PHI, SQRT2, SQRT1_2, LN2, LN10, LOG2E, LOG10E]) {
      expect(typeof c).toBe('number');
      expect(Number.isFinite(c)).toBe(true);
    }
  });
});
