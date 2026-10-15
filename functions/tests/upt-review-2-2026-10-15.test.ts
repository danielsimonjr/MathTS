/**
 * The second set of defects found by the Universal-Physics-Tensor deep dive of
 * 2026-10-15, each proved red before its fix.
 */
import { describe, expect, it } from 'vitest';
import { linearRegression, ols, symbolicEqual } from '../src/index.js';

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
    // Two-sided p of |t| with ν degrees of freedom is the regularized incomplete beta
    // I_{ν/(ν+t²)}(ν/2, 1/2); at t = 1, ν = 1 (Cauchy) that is exactly 1/2.
    const t1 = linearRegression([0, 1, 2], [0, 1, 0]);
    expect(t1.pValue).toBeCloseTo(1, 12); // slope 0, t = 0 → p = 1
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
