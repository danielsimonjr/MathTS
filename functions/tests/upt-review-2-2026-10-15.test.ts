/**
 * The second set of defects found by the Universal-Physics-Tensor deep dive of
 * 2026-10-15, each proved red before its fix.
 */
import { describe, expect, it } from 'vitest';
import { linearRegression, linregress, ols, symbolicEqual } from '../src/index.js';

describe('symbolicEqual simplifies with the default rules', () => {
  it('recognises commuted products, squares and nested quotients', () => {
    expect(symbolicEqual('x*y', 'y*x')).toBe(true);
    expect(symbolicEqual('x*x', 'x^2')).toBe(true);
    expect(symbolicEqual('a/(b/c)', 'a*c/b')).toBe(true);
    expect(symbolicEqual('2*(x+1)', '2*x+2')).toBe(true);
  });

  it('still says no when the forms differ', () => {
    expect(symbolicEqual('x*y', 'x+y')).toBe(false);
    expect(symbolicEqual('x^2', 'x^3')).toBe(false);
  });
});

describe('a t-distribution p-value resolves the far tail', () => {
  it('linearRegression: a steep, nearly exact line has a tiny but nonzero pValue', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = x.map((v) => 2 * v + (v === 8 ? 1e-4 : 0));
    const r = linearRegression(x, y);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThan(1e-20);
    const lr = linregress(x, y);
    // Wrapper shares slope inference with linearRegression (studentTTwoSidedP).
    expect(lr.pValue).toBe(r.pValue);
    expect(lr.slope).toBe(r.slope);
    expect(lr.intercept).toBe(r.intercept);
    expect(lr.rValue).toBe(r.rValue);
    expect(lr.stdErr).toBe(r.stdErr);
    expect(lr.pValue).toBeGreaterThan(0);
    expect(lr.pValue).toBeLessThan(1e-20);
    // Two-sided p of |t| with ν degrees of freedom is the regularized incomplete beta
    // I_{ν/(ν+t²)}(ν/2, 1/2). For this (x, y), ν = 6, t ≈ 415693.92587780085, so
    // x = ν/(ν+t²) ≈ 3.47219328695e-11. Independent oracles all give
    // 1.30816251668737e-32: scipy.special.betainc(3, 0.5, x), 2*scipy.stats.t.sf(|t|, 6),
    // and mpmath.betainc(3, 0.5, 0, x, regularized=True). scipy.stats.linregress reports
    // 1.3081704512567805e-32 (relative ~6e-6; its t differs in the 8th digit because
    // it does not use pairwise sums). The CDF form 2*(1-studentTCDF(|t|,ν)) flushes to 0.
    expect(Math.abs(lr.pValue / 1.30816251668737e-32 - 1)).toBeLessThan(1e-12);
    // ν = 1 (Cauchy): I_{1/(1+t²)}(1/2, 1/2) = (2/π) arctan(1/|t|). At t = 1 that is 1/2.
    // x = [0,1,2], y = [0, 1+√3, 2] has slope 1, stderr 1, t = 1, df = 1.
    const cauchy = linregress([0, 1, 2], [0, 1 + Math.sqrt(3), 2]);
    expect(cauchy.pValue).toBeCloseTo(0.5, 12);
    const t0 = linearRegression([0, 1, 2], [0, 1, 0]);
    expect(t0.pValue).toBeCloseTo(1, 12); // slope 0, t = 0 → p = 1
  });

  it('ols: the same tail, and the coefficient p-values are in (0, 1)', () => {
    const X = [[1], [2], [3], [4], [5], [6], [7], [8]];
    const y = X.map(([v]) => 3 * v + (v === 8 ? 1e-4 : 0));
    const r = ols(X, y, { intercept: false });
    expect(r.pValues[0]).toBeGreaterThan(0);
    expect(r.pValues[0]).toBeLessThan(1e-20);
  });
});

describe('ols is scale-free', () => {
  it('solves an SI-scaled design that is far from singular', () => {
    const X = [[1e-20], [2e-20], [3e-20], [4e-20]];
    const y = [2e-20, 4e-20, 6e-20, 8.0001e-20];
    const r = ols(X, y, { intercept: false });
    // β = Σxy/Σx² = 60.0004/30 on the unscaled numbers.
    expect(r.coefficients[0]).toBeCloseTo(60.0004 / 30, 9);
    expect(r.r2).toBeGreaterThan(0.999999);
  });

  it('still refuses a collinear design', () => {
    expect(() =>
      ols(
        [
          [1, 2],
          [2, 4],
          [3, 6],
          [4, 8],
        ],
        [1, 2, 3, 4],
        { intercept: false }
      )
    ).toThrow(/singular|collinear/);
  });

  it('the well-scaled answer is unchanged', () => {
    const r = ols(
      [
        [1, 1],
        [2, 0],
        [3, 1],
        [4, 0],
      ],
      [6, 5, 10, 9]
    );
    expect(r.coefficients[0]).toBeCloseTo(1, 10);
    expect(r.coefficients[1]).toBeCloseTo(2, 10);
    expect(r.coefficients[2]).toBeCloseTo(3, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });
});
