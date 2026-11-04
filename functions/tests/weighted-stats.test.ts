import { describe, it, expect } from 'vitest';
import {
  weightedMean,
  weightedVariance,
  weightedMedian,
  weightedQuantile,
} from '../src/stats/weighted-stats.js';

describe('weightedMean', () => {
  it('matches hand-computed values', () => {
    expect(weightedMean([1, 2, 3, 4], [1, 1, 1, 5])).toBeCloseTo(3.25, 12);
    expect(weightedMean([2, 4, 6], [1, 1, 1])).toBeCloseTo(4, 12);
  });
  it('returns the element for a single point', () => {
    expect(weightedMean([7], [3])).toBe(7);
  });
  it('rejects length mismatch, negative and all-zero weights', () => {
    expect(() => weightedMean([1, 2], [1])).toThrow(RangeError);
    expect(() => weightedMean([1, 2], [1, -1])).toThrow(RangeError);
    expect(() => weightedMean([1, 2], [0, 0])).toThrow(RangeError);
  });
  it('returns NaN for a NaN weight and accepts Float64Array', () => {
    expect(weightedMean([1, 2], [1, NaN])).toBeNaN();
    expect(weightedMean(new Float64Array([1, 2, 3]), new Float64Array([1, 1, 1]))).toBeCloseTo(
      2,
      12
    );
  });
});

describe('weightedVariance', () => {
  it('gives the population weighted variance by default', () => {
    expect(weightedVariance([1, 2, 3, 4], [1, 1, 1, 5])).toBeCloseTo(1.1875, 12);
  });
  it('ddof 1 divides by Σw − 1', () => {
    expect(weightedVariance([1, 2, 3, 4], [1, 1, 1, 5], { ddof: 1 })).toBeCloseTo(9.5 / 7, 12);
  });
});

describe('weightedMedian and weightedQuantile', () => {
  it('weightedMedian honors heavy weights', () => {
    expect(weightedMedian([1, 2, 3, 4, 5], [1, 1, 1, 1, 10])).toBe(5);
  });
  it('lower median for equal weights', () => {
    expect(weightedMedian([1, 2, 3], [1, 1, 1])).toBe(2);
  });
  it('quantile skips zero-weight points and handles p = 0 and p = 1', () => {
    expect(weightedQuantile([1, 2, 3], [0, 1, 1], 0)).toBe(2);
    expect(weightedQuantile([1, 2, 3], [1, 1, 1], 1)).toBe(3);
    expect(weightedQuantile([1, 2, 3, 4], [1, 1, 1, 1], 0.25)).toBe(1);
  });
  it('rejects p outside [0, 1]', () => {
    expect(() => weightedQuantile([1, 2], [1, 1], 1.5)).toThrow(RangeError);
  });
});
