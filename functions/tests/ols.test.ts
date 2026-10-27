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
    const rssOracle = n / 100;
    expect(
      pairwiseDot(
        Array.from({ length: n }, () => 0.1),
        Array.from({ length: n }, () => 0.1)
      )
    ).toBeCloseTo(rssOracle, 12);
    // y = X + 0.1 with X = [1,-1,...,1,-1] (no intercept): residual 0.1 is orthogonal
    // to the column, so β = 1, RSS = n/100. Hand TSS: mean(y) = 0.1, five ±1 deviations → TSS = 10.
    const X = Array.from({ length: n }, (_, i) => [i % 2 === 0 ? 1 : -1]);
    const y = X.map((row) => row[0] + 0.1);
    const r = ols(X, y, { intercept: false });
    expect(r.coefficients[0]).toBeCloseTo(1, 12);
    for (const e of r.residuals) expect(e).toBeCloseTo(0.1, 12);
    expect(pairwiseDot(r.residuals, r.residuals)).toBeCloseTo(rssOracle, 12);
    expect(r.r2).toBeCloseTo(1 - rssOracle / 10, 12);
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
