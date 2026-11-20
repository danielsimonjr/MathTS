/**
 * Dogfood #1100 - owensT for a large a, and nintegrate of an integrand with no limit.
 *
 * owensT integrated over [0, a] with a peak of width 1/h near 0, so a large a missed the
 * peak and returned 0. It now reduces a > 1 to the integral of T(a h, 1/a) with the identity
 * of Owen (1956). nintegrate(sin(1/x), 0, 1) bisected every panel near 0 to the depth limit and
 * took 19 to 37 s. quad now stops after `maxPanels` Gauss-Kronrod panels (default 100000).
 * Expected values: SciPy 1.16.3 `owens_t` (from the issue), the closed form T(0, a) =
 * atan(a) / (2 pi), and a composite Simpson rule of 4e6 intervals for the middle values.
 */
import { describe, it, expect } from 'vitest';
import { nintegrate, owensT, quad, skewNormalCDF } from '../src/index.js';

const relErr = (got: number, want: number): number => Math.abs(got / want - 1);

describe('#1100 owensT of a large a', () => {
  it('matches SciPy for a = 1e4 and a = 1e12', () => {
    expect(relErr(owensT(1, 1e4), 0.07932762696572854)).toBeLessThanOrEqual(1e-12);
    expect(relErr(owensT(1e-3, 1e12), 0.24980052889304447)).toBeLessThanOrEqual(1e-12);
  });

  it('is odd in a and even in h', () => {
    expect(relErr(owensT(1, -1e4), -0.07932762696572854)).toBeLessThanOrEqual(1e-12);
    expect(relErr(owensT(-1, 1e4), 0.07932762696572854)).toBeLessThanOrEqual(1e-12);
  });

  it('matches the closed form at h = 0', () => {
    expect(relErr(owensT(0, 5), Math.atan(5) / (2 * Math.PI))).toBeLessThanOrEqual(1e-14);
    expect(relErr(owensT(0, 1e8), Math.atan(1e8) / (2 * Math.PI))).toBeLessThanOrEqual(1e-14);
  });

  it('matches a composite Simpson rule on a > 1', () => {
    const cases: Array<[number, number, number]> = [
      [0.5, 2, 0.1415806036539926],
      [1, 3, 0.0792995047488795],
      [0.1, 5, 0.21469517597822188],
      [2, 1.5, 0.011365119947354056],
      [0, 5, 0.2185835209055177],
    ];
    for (const [h, a, want] of cases) {
      expect(relErr(owensT(h, a), want)).toBeLessThanOrEqual(1e-11);
    }
  });

  it('gives the skew-normal CDF of a large shape the half-normal limit', () => {
    // alpha -> infinity: the density is the half normal, and F(1) = 2 Phi(1) - 1 = erf(1 / sqrt 2).
    expect(relErr(skewNormalCDF(1, 1e4), 0.6826894921370859)).toBeLessThanOrEqual(1e-12);
  });
});

describe('#1100 quad stops after maxPanels panels', () => {
  const oscillating = (x: number): number => Math.sin(1 / x);

  it('reports an unconverged result when the budget is small', () => {
    expect(quad(oscillating, 0, 1, { maxPanels: 50 }).converged).toBe(false);
  });

  it('keeps a smooth integral converged with the default budget', () => {
    const r = quad((x) => 4 / (1 + x * x), 0, 1);
    expect(r.converged).toBe(true);
    expect(Math.abs(r.value - Math.PI)).toBeLessThanOrEqual(1e-9);
  });

  it('nintegrate of sin(1/x) evaluates the integrand a bounded number of times', () => {
    // 15 points per panel. No panel is bisected after 100000 panels, and at most maxDepth (50)
    // panels that wait on the recursion stack are evaluated once each. A call beyond that throws.
    const limit = 15 * (100000 + 50);
    let calls = 0;
    const counted = (x: number): number => {
      if (++calls > limit) throw new Error('budget');
      return Math.sin(1 / x);
    };
    let outcome: 'value' | 'range-error';
    try {
      const v = nintegrate(counted, 0, 1);
      expect(Math.abs(v - 0.5040670617880166)).toBeLessThan(1e-6);
      outcome = 'value';
    } catch (e) {
      expect((e as Error).message).not.toBe('budget');
      expect(e).toBeInstanceOf(RangeError);
      outcome = 'range-error';
    }
    expect(['value', 'range-error']).toContain(outcome);
    expect(calls).toBeLessThanOrEqual(limit);
  });

  it('nintegrate passes maxPanels to quad', () => {
    expect(() => nintegrate(oscillating, 0, 1, { maxPanels: 50 })).toThrow(RangeError);
  });
});
