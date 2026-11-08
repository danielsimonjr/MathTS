import { describe, it, expect } from 'vitest';
import * as functions from '../src/index.js';

interface Interval {
  lower: number;
  upper: number;
}
const api = functions as unknown as {
  wilsonInterval: (successes: number, n: number, confidence?: number) => Interval;
  newcombePairedInterval: (
    table: { a: number; b: number; c: number; d: number },
    confidence?: number
  ) => Interval & { diff: number };
  cohensKappa: (matrix: number[][]) => number;
};

const close = (a: number, b: number, tol = 1e-14): void => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
};

describe('wilsonInterval (UPT plan task M4)', () => {
  // statsmodels proportion_confint(method='wilson'), alpha = 1 - confidence.
  const cases: [number, number, number, number, number][] = [
    [8, 20, 0.95, 0.21880653237281705, 0.6134184992377469],
    [0, 10, 0.95, 0, 0.27753279986288926],
    [10, 10, 0.95, 0.7224672001371106, 1],
    [81, 263, 0.95, 0.2552885198782742, 0.36620957698280004],
    [1, 1000, 0.99, 0.00011741635361832078, 0.008460566219981695],
    [50, 100, 0.9, 0.4188477961125295, 0.5811522038874706],
  ];
  it.each(cases)('%i of %i at %f matches statsmodels', (s, n, conf, lo, hi) => {
    const r = api.wilsonInterval(s, n, conf);
    close(r.lower, lo);
    close(r.upper, hi);
  });

  it('the bounds at 0 and n are exactly 0 and 1', () => {
    expect(api.wilsonInterval(0, 10).lower).toBe(0);
    expect(api.wilsonInterval(10, 10).upper).toBe(1);
  });

  it('refuses a non-integer or out-of-range count and a bad confidence', () => {
    expect(() => api.wilsonInterval(3, 0)).toThrow();
    expect(() => api.wilsonInterval(11, 10)).toThrow();
    expect(() => api.wilsonInterval(1.5, 10)).toThrow();
    expect(() => api.wilsonInterval(1, 10, 1)).toThrow();
  });
});

describe('newcombePairedInterval, method 10 (UPT plan task M4)', () => {
  // Newcombe (1998) method 10, values from an independent Python implementation, to 4 decimals.
  const cases: [number, number, number, number, number, number][] = [
    [36, 12, 2, 0, 0.0569, 0.3404],
    [263, 15, 3, 22, 0.0117, 0.0704],
    [2, 1, 1, 8, -0.2745, 0.2745],
    [4, 9, 1, 3, 0.135, 0.684],
  ];
  it.each(cases)('a=%i b=%i c=%i d=%i', (a, b, c, d, lo, hi) => {
    const r = api.newcombePairedInterval({ a, b, c, d });
    close(r.diff, (b - c) / (a + b + c + d));
    expect(Math.abs(r.lower - lo)).toBeLessThan(5e-5);
    expect(Math.abs(r.upper - hi)).toBeLessThan(5e-5);
  });

  it('refuses an empty table', () => {
    expect(() => api.newcombePairedInterval({ a: 0, b: 0, c: 0, d: 0 })).toThrow();
  });
});

describe('cohensKappa (UPT plan task M4)', () => {
  // statsmodels inter_rater.cohens_kappa; the 2x2 case also matches sklearn cohen_kappa_score (0.4).
  it('matches statsmodels', () => {
    close(
      api.cohensKappa([
        [20, 5],
        [10, 15],
      ]),
      0.3999999999999999
    );
    close(
      api.cohensKappa([
        [45, 4, 1],
        [3, 30, 2],
        [2, 5, 8],
      ]),
      0.7152428810720268
    );
    expect(
      api.cohensKappa([
        [10, 0],
        [0, 10],
      ])
    ).toBe(1);
  });

  it('is NaN when chance agreement is 1, and refuses a bad matrix', () => {
    expect(
      Number.isNaN(
        api.cohensKappa([
          [5, 0],
          [0, 0],
        ])
      )
    ).toBe(true);
    expect(() => api.cohensKappa([[1, 2]])).toThrow();
    expect(() => api.cohensKappa([[0]])).toThrow();
  });
});
