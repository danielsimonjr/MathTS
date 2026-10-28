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

  const design = [
    [1, 0],
    [2, 1],
    [3, 0],
    [4, 2],
  ];
  const response = [1, 3, 2, 7];

  it('lasso(X,y,alpha) matches elasticNet(X,y,alpha,1)', () => {
    const a = 0.05;
    const l = lasso(design, response, a);
    const e = elasticNet(design, response, a, 1);
    expect(l.coefficients).toEqual(e.coefficients);
    expect(l.intercept).toBeCloseTo(e.intercept, 12);
  });

  it('lasso and elasticNet with alpha=0 agree on small design', () => {
    const l = lasso(design, response, 0);
    const e = elasticNet(design, response, 0, 0.5);
    expect(l.coefficients[0]).toBeCloseTo(e.coefficients[0], 10);
    expect(l.coefficients[1]).toBeCloseTo(e.coefficients[1], 10);
  });

  it('elasticNet l1Ratio=0 stays finite (coordinate ridge)', () => {
    const r = elasticNet(design, response, 0.01, 0);
    expect(Number.isFinite(r.coefficients[0])).toBe(true);
    expect(Number.isFinite(r.coefficients[1])).toBe(true);
  });

  it('lasso intercept:false keeps intercept 0', () => {
    const r = lasso(design, response, 0.01, { intercept: false });
    expect(r.intercept).toBe(0);
  });

  it('validation errors keep lasso:/elasticNet: prefixes', () => {
    expect(() => lasso([], [1], 0)).toThrow('lasso: empty design matrix');
    expect(() => elasticNet([], [1], 0, 0.5)).toThrow('elasticNet: empty design matrix');
    expect(() => lasso([[1]], [1, 2], 0)).toThrow('lasso: length mismatch (X has 1 rows, y has 2)');
    expect(() => lasso(design, response, -1)).toThrow('lasso: alpha must be non-negative');
    expect(() => elasticNet(design, response, -1, 0.5)).toThrow(
      'elasticNet: alpha must be non-negative'
    );
    expect(() => elasticNet(design, response, 0.1, -0.1)).toThrow(
      'elasticNet: l1Ratio must be in [0, 1]'
    );
    expect(() => elasticNet(design, response, 0.1, 1.1)).toThrow(
      'elasticNet: l1Ratio must be in [0, 1]'
    );
  });

  it('NaN in y propagates through lasso (intercept NaN)', () => {
    const r = lasso([[1], [2]], [1, NaN], 0.01);
    expect(Number.isNaN(r.intercept)).toBe(true);
  });
});
