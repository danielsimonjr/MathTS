/**
 * besselK and besselI at a huge argument. K_n(x) underflows to 0 and I_n(x) overflows (mpmath 1.3.0).
 * The scalars returned NaN (K above 8.9e307, where 2 (1 + x) overflows) or threw a RangeError (I from
 * x = 1e306, where the series plan counted x steps).
 */
import { describe, it, expect } from 'vitest';
import { besselI, besselK } from '../src/typed/special.js';

describe('besselK and besselI at a huge argument', () => {
  it('K is 0 at 1e308 and 1.7e308 for an integer and a fractional order', () => {
    for (const x of [1e305, 1e308, 1.7e308]) {
      expect(besselK(0, x)).toBe(0);
      expect(besselK(2.5, x)).toBe(0);
    }
  });

  it('I is Infinity, not a RangeError, at 1e306 and 1.7e308', () => {
    for (const x of [1e305, 1e306, 1.7e308]) {
      expect(besselI(0, x)).toBe(Infinity);
      expect(besselI(2.5, x)).toBe(Infinity);
      expect(besselI(-2.5, x)).toBe(Infinity);
    }
    expect(besselI(3, -1e306)).toBe(-Infinity);
  });
});
