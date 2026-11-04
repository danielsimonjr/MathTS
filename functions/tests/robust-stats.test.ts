import { describe, it, expect } from 'vitest';
import {
  pmean,
  gstd,
  gzscore,
  theilSen,
  siegelSlopes,
  partialCorrelation,
} from '../src/stats/robust-stats.js';

describe('pmean', () => {
  it('reproduces power, geometric and harmonic means', () => {
    expect(pmean([1, 2, 4], 2)).toBeCloseTo(2.6457513110645907, 12);
    expect(pmean([1, 4], -1)).toBeCloseTo(1.6, 12);
    expect(pmean([1, 4], 0)).toBeCloseTo(2, 12);
    expect(pmean([1, 4], 1)).toBeCloseTo(2.5, 12);
  });
  it('rejects non-positive entries for non-integer p', () => {
    expect(() => pmean([0, 1], 0.5)).toThrow(RangeError);
  });
});

describe('gstd and gzscore', () => {
  it('gstd is exp(std(log x)) with ddof 1', () => {
    expect(gstd([1, 2, 4])).toBeCloseTo(2, 12);
  });
  it('gstd rejects non-positive entries', () => {
    expect(() => gstd([1, -2])).toThrow(RangeError);
  });
  it('gzscore standardizes the logs', () => {
    const z = gzscore([1, 2, 4]);
    expect(z[0]).toBeCloseTo(-1, 12);
    expect(z[1]).toBeCloseTo(0, 12);
    expect(z[2]).toBeCloseTo(1, 12);
  });
});

describe('theilSen', () => {
  it('ignores the outlier and recovers the line', () => {
    const r = theilSen([0, 1, 2, 3, 4], [1, 3, 5, 7, 100]);
    expect(r.slope).toBeCloseTo(2, 12);
    expect(r.intercept).toBeCloseTo(1, 12);
  });
  it('requires at least two points and some distinct x', () => {
    expect(() => theilSen([1], [1])).toThrow(RangeError);
    expect(() => theilSen([2, 2, 2], [1, 2, 3])).toThrow(RangeError);
  });
});

describe('siegelSlopes', () => {
  it('recovers an exact line despite an outlier', () => {
    const r = siegelSlopes([0, 1, 2, 3, 4], [1, 3, 5, 7, 100]);
    expect(r.slope).toBeCloseTo(2, 12);
    expect(r.intercept).toBeCloseTo(1, 12);
  });
});

describe('partialCorrelation', () => {
  it('is 1 when y is proportional to x', () => {
    expect(partialCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], [1, 0, 2, 0, 3])).toBeCloseTo(
      1,
      12
    );
  });
});
