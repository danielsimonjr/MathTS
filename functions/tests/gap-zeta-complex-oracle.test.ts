import { describe, it, expect } from 'vitest';
import { zeta } from '../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';

/**
 * GC6 — Riemann ζ on the complex plane, pinned to an EXTERNAL oracle
 * (mpmath 1.3.0, dps=40). The factory implementation (Gourdon–Sebah / Borwein
 * acceleration + the functional equation for reflection) was complete and
 * accurate but had no complex-argument oracle. This test pins all three
 * regions — convergent Re>1, the critical strip, and Re<1 reached via the
 * functional equation — plus the pole and the first two nontrivial zeros.
 *
 * Building it surfaced a real bug: `zetaComplex` returned NaN for the ENTIRE
 * line Re=1, but the pole is only the point s=1; ζ(1+it), t≠0 is finite. Fixed.
 *
 * Reference values were produced with `mpmath.zeta(mpc(re, im))`. Measured
 * accuracy: ~1e-14 (convergent / strip), ~1e-11 (via reflection). Tolerances
 * are set a couple of orders looser than measured — honest, not aspirational.
 */
const z = (re: number, im: number): { re: number; im: number } =>
  zeta(new Complex(re, im)) as { re: number; im: number };

// mpmath.zeta references (dps=40)
const REFS = [
  { re: 2, im: 1, zre: 1.1503557032549, zim: -0.437530865919608 }, // Re>1 convergent
  { re: 3, im: -2, zre: 0.973041960418942, zim: 0.147695593000454 },
  { re: 2, im: 0, zre: 1.64493406684823, zim: 0 }, // real via complex path (π²/6)
  { re: 0.5, im: 1, zre: 0.143936427077189, zim: -0.722099743531673 }, // critical strip
  { re: 0.7, im: 5, zre: 0.726329115157795, zim: 0.209087276045729 },
  { re: 1, im: 1, zre: 0.582158059752004, zim: -0.926848564330807 }, // on Re=1, off the pole
  { re: -0.5, im: 0, zre: -0.207886224977355, zim: 0 }, // functional equation
  { re: -1, im: 0, zre: -0.0833333333333333, zim: 0 }, // -1/12
  { re: -1, im: 1, zre: 0.0168761517881749, zim: -0.114156480432385 },
  { re: -2, im: 3, zre: 0.132971155879299, zim: 0.123053300404588 },
  { re: 0, im: 1, zre: 0.0033002236853241, zim: -0.418155449141322 }, // ζ(i)
];

describe('GC6: ζ(complex) vs mpmath oracle', () => {
  for (const { re, im, zre, zim } of REFS) {
    it(`ζ(${re}${im >= 0 ? '+' : ''}${im}i) matches mpmath`, () => {
      const r = z(re, im);
      expect(r.re).toBeCloseTo(zre, 9);
      expect(r.im).toBeCloseTo(zim, 9);
    });
  }

  it('ζ(-1) = -1/12 exactly to oracle precision (Ramanujan)', () => {
    const r = z(-1, 0);
    expect(r.re).toBeCloseTo(-1 / 12, 9);
  });

  it('the pole at s=1 is NaN, but ζ(1+it), t≠0 is finite', () => {
    const pole = z(1, 0);
    expect(Number.isNaN(pole.re)).toBe(true);
    const offPole = z(1, 1);
    expect(Number.isFinite(offPole.re)).toBe(true);
    expect(Number.isFinite(offPole.im)).toBe(true);
    // regression guard for the "whole line Re=1 → NaN" bug
    expect(Number.isNaN(offPole.re)).toBe(false);
  });

  it('vanishes at the first two nontrivial zeros on Re=1/2', () => {
    for (const t of [14.134725141734695, 21.022039638771556]) {
      const r = z(0.5, t);
      expect(Math.hypot(r.re, r.im)).toBeLessThan(1e-8);
    }
  });
});
