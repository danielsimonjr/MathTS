/**
 * Special-function accuracy in the regions where earlier code lost precision, pinned to
 * mpmath (dps=25) references. Found by a fresh sweep of the whole special-function surface against
 * mpmath/scipy — everything else was already machine-precision (gamma/erf/digamma/elliptic/Bessel
 * J·I/distributions all ~1e-14 to 1e-16, even deep in the tails).
 */
import { describe, it, expect } from 'vitest';
import { zeta, besselK } from '../src/index.js';

/** Relative error against an mpmath reference. */
const rel = (got: number, ref: number): number => Math.abs((got - ref) / ref);

describe('zeta at negative arguments (reflection formula, not the cancelling direct series)', () => {
  // The direct Borwein series subtracts terms that grow like k^|Re s| for negative s, so ζ(-3) had
  // come out ~1.5e-7 off. Reflecting through ζ(1-s) (Re > 1) fixes it to machine precision.
  const cases: Array<[number, number]> = [
    [-1, -1 / 12], // exact rational
    [-3, 1 / 120],
    [-5, -1 / 252],
    [-11, 0.021092796092796094],
    [-0.5, -0.20788622497735457],
  ];
  for (const [s, ref] of cases) {
    it(`zeta(${s}) matches mpmath to ~1e-13`, () => {
      const r = rel(zeta(s) as number, ref);
      expect(r, `zeta(${s}) relErr ${r.toExponential(2)}`).toBeLessThan(1e-13);
    });
  }

  it('did not regress the positive/critical-strip values', () => {
    expect(rel(zeta(2) as number, 1.6449340668482264)).toBeLessThan(1e-13); // π²/6
    expect(rel(zeta(0.5) as number, -1.4603545088095868)).toBeLessThan(1e-12);
  });
});

describe('besselK accuracy in the series/asymptotic transition band (x≈8–11)', () => {
  // The ascending series cancels two O(I0(x)) terms; moving the crossover to x=8 caps the peak
  // error near the join at ~1.6e-9 (was ~5.3e-9 at the old x=9 boundary).
  const cases: Array<[number, number, number]> = [
    [0, 9, 0.000050881312956459246],
    [1, 9, 0.00005363701637945195],
    [0, 8, 0.0001464707052228154],
    [1, 8, 0.00015536921180500115],
    [0, 10, 0.00001778006231616765],
  ];
  for (const [nu, x, ref] of cases) {
    it(`besselK(${nu}, ${x}) within 3e-9 of mpmath`, () => {
      const r = rel(besselK(nu, x) as number, ref);
      expect(r, `K${nu}(${x}) relErr ${r.toExponential(2)}`).toBeLessThan(3e-9);
    });
  }

  it('stays machine-precision outside the transition band', () => {
    expect(rel(besselK(0, 2) as number, 0.11389387274953344)).toBeLessThan(1e-13);
    expect(rel(besselK(0, 20) as number, 5.741237815336525e-10)).toBeLessThan(1e-12);
  });
});
