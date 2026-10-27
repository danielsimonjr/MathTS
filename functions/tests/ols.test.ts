import { describe, it, expect } from 'vitest';
import { pairwiseDot } from '@danielsimonjr/mathts-core';
import { ols } from '../src/index.js';

describe('ols (multiple regression with inference)', () => {
  it('exact fit y=1+2x1+3x2 -> coefficients [1,2,3], r2=1', () => {
    const X = [
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
    ];
    const y = [6, 5, 10, 9];
    const r = ols(X, y);
    expect(r.coefficients[0]).toBeCloseTo(1, 6);
    expect(r.coefficients[1]).toBeCloseTo(2, 6);
    expect(r.coefficients[2]).toBeCloseTo(3, 6);
    expect(r.r2).toBeCloseTo(1, 8);
  });

  it('RSS is pairwise sum of squared residuals (oracle: n uniform 0.1 → n/100)', () => {
    const n = 10;
    const residuals = Array.from({ length: n }, () => 0.1);
    const rssOracle = n / 100;
    expect(pairwiseDot(residuals, residuals)).toBeCloseTo(rssOracle, 12);
    const X = [
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
    ];
    const y = [6, 5, 10, 9];
    const r = ols(X, y);
    expect(pairwiseDot(r.residuals, r.residuals)).toBeLessThan(1e-20);
  });

  it('returns inference fields with correct shapes', () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1];
    const r = ols(X, y);
    expect(r.coefficients).toHaveLength(2);
    expect(r.stderr).toHaveLength(2);
    expect(r.pValues).toHaveLength(2);
    expect(r.coefficients[1]).toBeCloseTo(2, 1);
    expect(r.r2).toBeGreaterThan(0.99);
  });
});
