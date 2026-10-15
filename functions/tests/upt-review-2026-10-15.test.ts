/**
 * Defects found by the Universal-Physics-Tensor MathTS-usage review of
 * 2026-10-15, each proved red before its fix.
 */
import { describe, expect, it } from 'vitest';
import { findRoot, gammaincp, quad } from '../src/index.js';

describe('gammaincp computes the upper tail directly', () => {
  it('resolves a far upper tail instead of rounding 1 − P to 0', () => {
    // Q(5, 80) = e^{-80} Σ_{k<5} 80^k/k! (an integer shape has a finite sum)
    const exact = Math.exp(-80) * (1 + 80 + 80 ** 2 / 2 + 80 ** 3 / 6 + 80 ** 4 / 24);
    expect(exact).toBeGreaterThan(1e-29);
    const q = gammaincp(5, 80) as number;
    expect(q).toBeGreaterThan(0);
    expect(Math.abs(q / exact - 1)).toBeLessThan(1e-12);
  });

  it('still agrees with 1 − gammainc where that subtraction is exact enough', () => {
    for (const [a, x] of [
      [1, 1],
      [2.5, 0.5],
      [3, 4],
      [10, 12],
    ] as const) {
      const closed = a === 1 ? Math.exp(-x) : null;
      const q = gammaincp(a, x) as number;
      if (closed !== null) expect(Math.abs(q / closed - 1)).toBeLessThan(1e-13);
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThan(1);
    }
    expect(gammaincp(3, 0)).toBe(1);
  });

  it('the vector form agrees with the scalar form on the far tail', async () => {
    const out = (await gammaincp(5, new Float64Array([1, 80]))) as Float64Array;
    expect(out[0]).toBeCloseTo(gammaincp(5, 1) as number, 15);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[1]).toBeCloseTo(gammaincp(5, 80) as number, 40);
  });
});

describe('findRoot refuses a NaN endpoint and separates the width tolerance', () => {
  it('throws when an endpoint value is not a number', () => {
    expect(() => findRoot((x) => (x === 0 ? Number.NaN : x - 0.5), 0, 1)).toThrow(
      /not a number|NaN/
    );
  });

  it('xtol: 0 stops on the residual alone, so a residual tolerance in f units is honoured', () => {
    // A square-root crossing: inverse quadratic interpolation is poor on it, so Brent bisects,
    // and the single tolerance stopped at a bracket width of 1e-3, where |f| is about 300.
    const r = 0.3;
    const f = (s: number) => 1e4 * Math.sign(s - r) * Math.sqrt(Math.abs(s - r));
    const stopped = findRoot(f, 0, 1, { tol: 1e-3, maxIter: 200 });
    expect(Math.abs(f(stopped))).toBeGreaterThan(1);
    const root = findRoot(f, 0, 1, { tol: 1e-3, xtol: 0, maxIter: 200 });
    expect(Math.abs(f(root))).toBeLessThanOrEqual(1e-3);
  });

  it('the default is unchanged: one tol on both', () => {
    const root = findRoot((x) => x * x - 2, 1, 2);
    expect(Math.abs(root - Math.SQRT2)).toBeLessThan(1e-10);
  });
});

describe('quad takes an absolute floor option', () => {
  it('atol: 0 integrates an SI-scaled integrand to the relative tolerance', () => {
    // ∫₀¹ 1e-16/√x dx = 2e-16. The first panel's |K − G| is about 1e-18, under the default
    // absolute floor of 1e-14, so the panel was accepted at a relative error of order 1e-3.
    const f = (x: number) => 1e-16 / Math.sqrt(x);
    const floored = quad(f, 0, 1, { tol: 1e-6 });
    expect(Math.abs(floored.value / 2e-16 - 1)).toBeGreaterThan(1e-4);
    const { value } = quad(f, 0, 1, { tol: 1e-6, atol: 0 });
    expect(Math.abs(value / 2e-16 - 1)).toBeLessThan(1e-6);
  });
});
