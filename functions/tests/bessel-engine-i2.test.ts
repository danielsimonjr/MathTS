/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * Batch I2: the real-order Bessel engine (#1331, #1332, #1334), the recurrence polynomials
 * (#1332), the zeta reflection (#1327), and the defects of the same classes that the plan
 * found (D1 to D4).
 *
 * Oracle: mpmath 1.3.0 (mp.dps = 50 to 90). Every Bessel and polynomial input is the EXACT
 * DOUBLE (`mpf(float)`), not its decimal. The decimal and the double of `-2.0000001` give
 * different values at x = 1e-10 (40000096567245.8 against 40000096501782.345).
 *
 * A failing test is a finding. No bound is widened to make a value pass.
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { besselJ, lgamma } from '../src/typed/special.js';
import { gamma } from '../src/index.js';

/** Relative error of `got` against `want` (absolute when `want` is 0). */
const rel = (got: unknown, want: number): number =>
  want === 0 ? Math.abs(got as number) : Math.abs(((got as number) - want) / want);

const expectRel = (got: unknown, want: number, tol: number): void => {
  expect(Number.isFinite(got as number)).toBe(true);
  expect(rel(got, want)).toBeLessThanOrEqual(tol);
};

describe('D1: sin(pi x) near a nonzero integer keeps its digits', () => {
  // pi * x rounds by ulp(pi * x), and sin there is about pi * dist, so the old form lost
  // about log10(x / dist) digits. The new helper reduces x exactly first.
  it('gamma(-1.0000001) = 9999999.5713771343 (main 9999999.569845542)', () => {
    expectRel(gamma(-1.0000001), 9999999.5713771343, 1e-13);
  });

  it('lgamma(-1.0000001) = 16.118095608096032 (main 16.118095607942873)', () => {
    expect(Math.abs((lgamma(-1.0000001) as number) - 16.118095608096032)).toBeLessThanOrEqual(
      1e-13
    );
  });

  it('the array form of lgamma equals the scalar form', () => {
    const arr = lgamma(new Float64Array([-1.0000001, -2.5, 0.25])) as Float64Array;
    expect(arr[0]).toBe(lgamma(-1.0000001));
    expect(arr[1]).toBe(lgamma(-2.5));
    expect(arr[2]).toBe(lgamma(0.25));
  });

  it('gamma(complex(-1.0000001, 1e-9)) = 9998999.6713688866 + 99990.000883148520i', () => {
    const g = gamma(new Complex(-1.0000001, 1e-9)) as Complex;
    expectRel(g.re, 9998999.6713688866, 1e-12);
    expectRel(g.im, 99990.00088314852, 1e-12);
  });

  it('besselJ(-1.0000001, 1e-10) = -2000.0046295296178 (main -2000.0046298359373)', () => {
    expectRel(besselJ(-1.0000001, 1e-10), -2000.0046295296178, 1e-13);
  });

  it('besselJ(-151.0000000001, 1) = -1.6334002392385388e+298 (main is 2e-7 off)', () => {
    expectRel(besselJ(-151.0000000001, 1), -1.6334002392385388e298, 1e-12);
  });
});
