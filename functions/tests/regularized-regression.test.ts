import { describe, it, expect } from 'vitest';
import { ridge, lasso, elasticNet } from '../src/index.js';

describe('regularized regression', () => {
  it('ridge(alpha=0) recovers the OLS fit (y=2x)', () => {
    const r = ridge([[1], [2], [3], [4]], [2, 4, 6, 8], 0);
    expect(r.coefficients[0]).toBeCloseTo(2, 4);
    expect(r.intercept).toBeCloseTo(0, 4);
  });
  it('ridge with large alpha shrinks the coefficient toward 0', () => {
    const big = ridge([[1], [2], [3], [4]], [2, 4, 6, 8], 1000);
    expect(Math.abs(big.coefficients[0])).toBeLessThan(1);
  });
  it('lasso with large alpha zeroes the coefficient', () => {
    const r = lasso([[1], [2], [3], [4]], [2, 4, 6, 8], 100);
    expect(Math.abs(r.coefficients[0])).toBeLessThan(1e-6);
  });
  it('lasso(small alpha) ~ OLS slope', () => {
    const r = lasso([[1], [2], [3], [4]], [2, 4, 6, 8], 0.001);
    expect(r.coefficients[0]).toBeCloseTo(2, 1);
  });
  it('elasticNet returns finite coefficients', () => {
    const r = elasticNet([[1], [2], [3], [4]], [2, 4, 6, 8], 0.1, 0.5);
    expect(Number.isFinite(r.coefficients[0])).toBe(true);
  });
});
