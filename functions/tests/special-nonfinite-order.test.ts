/**
 * A non-finite order gives NaN for the order-taking special functions.
 *
 * Before, an infinite order ran the order recurrence forever (the call never returned),
 * and a NaN order skipped the recurrence and gave the value of order 0 or 1.
 */
import { describe, expect, it } from 'vitest';
import {
  besselJ,
  besselY,
  besselK,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
} from '../src/index.js';

const FNS = { besselJ, besselY, besselK, chebyshevT, hermiteH, laguerreL, legendreP } as Record<
  string,
  (n: number, x: unknown) => unknown
>;

describe('order-taking special functions: non-finite order', () => {
  for (const [name, f] of Object.entries(FNS)) {
    it(`${name}(NaN | Infinity | -Infinity, x) is NaN`, () => {
      for (const n of [NaN, Infinity, -Infinity]) {
        expect(f(n, 0.5)).toBeNaN();
      }
    });

    it(`${name} on a Float64Array with a non-finite order is all NaN`, () => {
      const r = f(Infinity, Float64Array.from([0.25, 0.5, 2])) as Float64Array;
      expect(Array.from(r).every(Number.isNaN)).toBe(true);
    });
  }

  it('a finite order is unchanged', () => {
    expect(besselK(2, 1.5)).toBeCloseTo(0.5836559632566508, 14);
    expect(chebyshevT(3, 0.5)).toBeCloseTo(-1, 14);
    expect(legendreP(2, 0.5)).toBeCloseTo(-0.125, 14);
  });
});
