/* eslint-disable no-loss-of-precision -- mpmath dps=25 oracle constants written
   at full precision; rounding to the nearest IEEE-754 double is intended. */
import { describe, it, expect } from 'vitest';
import { polylog, struveH, struveL, kelvinBer, kelvinBei, barnesG } from '../dist/index.js';

/**
 * Niche special-function oracle test: polylogarithm, Struve H/L, Kelvin
 * ber/bei (order 0), and the Barnes G-function.
 *
 * Ground truth: mpmath at dps=25. Regenerate with:
 *
 *   python -c "
 *   import mpmath as mp
 *   mp.mp.dps = 25
 *   print(mp.nstr(mp.polylog(2, mp.mpf('0.5')), 20))
 *   print(mp.nstr(mp.polylog(3, mp.mpf('0.5')), 20))
 *   print(mp.nstr(mp.polylog(1, mp.mpf('0.5')), 20))
 *   print(mp.nstr(mp.struveh(0, 1), 20))
 *   print(mp.nstr(mp.struveh(1, 2), 20))
 *   print(mp.nstr(mp.struvel(0, 1), 20))
 *   print(mp.nstr(mp.struvel(1, 2), 20))
 *   print(mp.nstr(mp.ber(0, 2), 20))
 *   print(mp.nstr(mp.bei(0, 2), 20))
 *   print(mp.nstr(mp.barnesg(4.5), 20))
 *   "
 *
 * relerr < 1e-10 throughout except where noted (all six functions here in
 * fact hold well under 1e-12 in practice — see per-assertion tolerances).
 */

function relerr(actual: number, expected: number): number {
  if (expected === 0) return Math.abs(actual);
  return Math.abs((actual - expected) / expected);
}

describe('gap: niche special functions oracle (polylog, Struve, Kelvin, Barnes-G)', () => {
  describe('polylog(s, z) — dilog/trilog series, |z| < 1', () => {
    it('matches mpmath.polylog(2, 0.5) (dilogarithm)', () => {
      const actual = polylog(2, 0.5) as number;
      expect(relerr(actual, 0.5822405264650125059)).toBeLessThan(1e-12);
    });

    it('matches mpmath.polylog(3, 0.5) (trilogarithm)', () => {
      const actual = polylog(3, 0.5) as number;
      expect(relerr(actual, 0.53721319360804020094)).toBeLessThan(1e-12);
    });

    it('matches mpmath.polylog(1, 0.5) and the closed form -ln(1-z)', () => {
      const expected = 0.69314718055994530942;
      const actual = polylog(1, 0.5) as number;
      expect(relerr(actual, expected)).toBeLessThan(1e-12);
      // Special-value sanity: Li_1(z) = -ln(1 - z).
      expect(relerr(actual, -Math.log(1 - 0.5))).toBeLessThan(1e-14);
    });

    it('matches mpmath.polylog(2, -0.7) (negative z, alternating series)', () => {
      const actual = polylog(2, -0.7) as number;
      expect(relerr(actual, -0.60515840233770528397)).toBeLessThan(1e-11);
    });

    it('returns 0 at z = 0', () => {
      expect(polylog(2, 0)).toBe(0);
    });

    it('throws for |z| >= 1 (analytic continuation out of scope)', () => {
      expect(() => polylog(2, 1)).toThrow();
      expect(() => polylog(2, -1.5)).toThrow();
    });
  });

  describe('struveH(v, z) — Struve function power series', () => {
    it('matches mpmath.struveh(0, 1)', () => {
      const actual = struveH(0, 1) as number;
      expect(relerr(actual, 0.56865662704828795099)).toBeLessThan(1e-12);
    });

    it('matches mpmath.struveh(1, 2)', () => {
      const actual = struveH(1, 2) as number;
      expect(relerr(actual, 0.64676372828356211712)).toBeLessThan(1e-12);
    });

    it('returns 0 at z = 0', () => {
      expect(struveH(0, 0)).toBe(0);
    });

    it('throws for negative z', () => {
      expect(() => struveH(0, -1)).toThrow();
    });
  });

  describe('struveL(v, z) — modified Struve function power series', () => {
    it('matches mpmath.struvel(0, 1)', () => {
      const actual = struveL(0, 1) as number;
      expect(relerr(actual, 0.71024318593789088874)).toBeLessThan(1e-12);
    });

    it('matches mpmath.struvel(1, 2)', () => {
      const actual = struveL(1, 2) as number;
      expect(relerr(actual, 1.1027597873677158176)).toBeLessThan(1e-12);
    });

    it('returns 0 at z = 0', () => {
      expect(struveL(0, 0)).toBe(0);
    });
  });

  describe('kelvinBer / kelvinBei — Kelvin functions ber(x), bei(x) (order 0)', () => {
    it('matches mpmath.ber(0, 2)', () => {
      const actual = kelvinBer(2) as number;
      expect(relerr(actual, 0.75173418271380822855)).toBeLessThan(1e-12);
    });

    it('matches mpmath.bei(0, 2)', () => {
      const actual = kelvinBei(2) as number;
      expect(relerr(actual, 0.9722916273066612061)).toBeLessThan(1e-12);
    });

    it('matches mpmath.ber(0, 3.5)', () => {
      const actual = kelvinBer(3.5) as number;
      expect(relerr(actual, -1.1935981795899280601)).toBeLessThan(1e-12);
    });

    it('matches mpmath.bei(0, 3.5)', () => {
      const actual = kelvinBei(3.5) as number;
      expect(relerr(actual, 2.2832499668539146182)).toBeLessThan(1e-12);
    });

    it('special values: ber(0) = 1, bei(0) = 0', () => {
      expect(kelvinBer(0)).toBe(1);
      expect(kelvinBei(0)).toBe(0);
    });
  });

  describe('barnesG(z) — Barnes G-function, real z > 0', () => {
    it('matches the factorial-product identity at small integers', () => {
      // G(n+3) = prod_{k=1}^{n} k!  =>  G(3)=1, G(4)=1!=1... check exact table.
      expect(relerr(barnesG(3) as number, 1)).toBeLessThan(1e-12);
      expect(relerr(barnesG(4) as number, 2)).toBeLessThan(1e-12);
      expect(relerr(barnesG(5) as number, 12)).toBeLessThan(1e-12);
      expect(relerr(barnesG(6) as number, 288)).toBeLessThan(1e-12);
    });

    it('matches mpmath.barnesg(4.5) (half-integer, non-trivial)', () => {
      const actual = barnesG(4.5) as number;
      expect(relerr(actual, 4.1862532589695806716)).toBeLessThan(1e-12);
    });

    it('matches mpmath.barnesg(1.5)', () => {
      const actual = barnesG(1.5) as number;
      expect(relerr(actual, 1.0692226492664129495)).toBeLessThan(1e-12);
    });

    it('matches mpmath.barnesg(10) (large integer, tests the shift+asymptotic path)', () => {
      const actual = barnesG(10) as number;
      expect(relerr(actual, 5056584744960000)).toBeLessThan(1e-12);
    });

    it('throws for z <= 0 (out of scope)', () => {
      expect(() => barnesG(0)).toThrow();
      expect(() => barnesG(-1)).toThrow();
    });
  });
});
