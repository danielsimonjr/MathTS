/**
 * Issue #1146: functions that gave a silent wrong value for a NaN or an infinite input.
 *
 * Oracles: SciPy 1.16.3 and NumPy 2.3.5. `signTest` has no SciPy counterpart; it follows
 * the NaN propagation of `kruskalWallis` and `wilcoxon`.
 */
import { describe, it, expect } from 'vitest';
import {
  signTest,
  moodMedianTest,
  cummax,
  cummin,
  ecdf,
  medianSelect,
  theilSen,
  wassersteinDistance,
  fisherExact,
} from '../src/index.js';

describe('NaN input returns NaN (#1146)', () => {
  it('signTest: a NaN gives a NaN statistic and p-value, and keeps the counts of the other values', () => {
    const r = signTest([1, NaN, 2, 3]);
    expect(r.statistic).toBeNaN();
    expect(r.pValue).toBeNaN();
    expect(r.nPos).toBe(3);
    expect(r.nNeg).toBe(0);
  });

  it('signTest: a NaN median gives NaN', () => {
    const r = signTest([1, 2, 3], NaN);
    expect(r.statistic).toBeNaN();
    expect(r.pValue).toBeNaN();
  });

  it('signTest: input without NaN is unchanged', () => {
    const r = signTest([1, 2, 3, -1]);
    expect(r.statistic).toBe(3);
    expect(r.nPos).toBe(3);
    expect(r.nNeg).toBe(1);
    expect(r.pValue).toBeCloseTo(0.625, 12);
  });

  it('moodMedianTest: scipy.stats.median_test gives nan, nan, nan', () => {
    const r = moodMedianTest([
      [1, NaN, 2, 3],
      [1, 2, 3, 4],
    ]);
    expect(r.statistic).toBeNaN();
    expect(r.pValue).toBeNaN();
    expect(r.grandMedian).toBeNaN();
  });

  it('moodMedianTest: a NaN in the second group gives NaN too', () => {
    const r = moodMedianTest([
      [1, 2, 3, 4],
      [1, 2, NaN, 4],
    ]);
    expect(r.statistic).toBeNaN();
    expect(r.pValue).toBeNaN();
  });

  it('cummax: NumPy maximum.accumulate keeps a NaN from its first position', () => {
    expect(cummax([1, NaN, 2, 3])).toEqual([1, NaN, NaN, NaN]);
    expect(cummax([NaN, 1])).toEqual([NaN, NaN]);
  });

  it('cummin: NumPy minimum.accumulate keeps a NaN from its first position', () => {
    expect(cummin([1, NaN, 2, 3])).toEqual([1, NaN, NaN, NaN]);
    expect(cummin([NaN, 1])).toEqual([NaN, NaN]);
  });

  it('cummax and cummin: input without NaN is unchanged', () => {
    expect(cummax([1, 3, 2, 5, 4])).toEqual([1, 3, 3, 5, 5]);
    expect(cummin([5, 3, 4, 1, 2])).toEqual([5, 3, 3, 1, 1]);
    expect(cummax([-Infinity, Infinity, 1])).toEqual([-Infinity, Infinity, Infinity]);
  });

  it('ecdf: scipy.stats.ecdf raises for a NaN, so ecdf throws a RangeError', () => {
    expect(() => ecdf([1, NaN, 2])).toThrow(RangeError);
    expect(() => ecdf([1, NaN, 2])).toThrow(/^ecdf: .*NaN/);
  });

  it('ecdf: input without NaN is unchanged', () => {
    const e = ecdf([2, 1, 1, 3]);
    expect(e.x).toEqual([1, 2, 3]);
    expect(e.y).toEqual([0.5, 0.75, 1]);
    expect(e.evaluate(1.5)).toBe(0.5);
  });

  it('medianSelect: numpy.median gives nan for a NaN', () => {
    expect(medianSelect([1, NaN, 2, 3])).toBeNaN();
    expect(medianSelect([1, NaN, 2])).toBeNaN();
    expect(medianSelect([NaN])).toBeNaN();
  });

  it('medianSelect: input without NaN is unchanged', () => {
    expect(medianSelect([3, 1, 2])).toBe(2);
    expect(medianSelect([4, 1, 3, 2])).toBe(2.5);
    expect(medianSelect([])).toBeNaN();
  });
});

describe('infinite input (#1146)', () => {
  // The issue compared theilSen(x, y) with scipy.stats.theilslopes(y, x). SciPy takes the
  // response first, so the two calls below pin the argument order that is correct.
  it('theilSen(x, y) with infinite x equals scipy.stats.theilslopes(y, x)', () => {
    const r = theilSen([1, Infinity, 2, -Infinity], [1, 2, 3, 4]);
    // SciPy: slope 0.0, intercept 2.5
    expect(Math.abs(r.slope)).toBe(0);
    expect(r.intercept).toBe(2.5);
  });

  it('theilSen(x, y) with infinite y equals scipy.stats.theilslopes(y, x)', () => {
    const r = theilSen([1, 2, 3, 4], [1, Infinity, 2, -Infinity]);
    // SciPy: slope -inf, intercept inf
    expect(r.slope).toBe(-Infinity);
    expect(r.intercept).toBe(Infinity);
  });

  it('wassersteinDistance: an infinite value that occurs twice gives NaN, as in SciPy', () => {
    expect(wassersteinDistance([Infinity], [Infinity])).toBeNaN();
    expect(wassersteinDistance([Infinity, Infinity], [1])).toBeNaN();
    expect(wassersteinDistance([-Infinity], [-Infinity, 2])).toBeNaN();
    expect(wassersteinDistance([1, Infinity], [2, Infinity])).toBeNaN();
    expect(wassersteinDistance([-Infinity, 1], [-Infinity, 2])).toBeNaN();
  });

  it('wassersteinDistance: one infinite value gives Infinity, as in SciPy', () => {
    expect(wassersteinDistance([Infinity, 1], [1, 2])).toBe(Infinity);
    expect(wassersteinDistance([-Infinity], [Infinity])).toBe(Infinity);
    expect(wassersteinDistance([Infinity], [1])).toBe(Infinity);
    expect(wassersteinDistance([-Infinity, Infinity], [1, 2])).toBe(Infinity);
  });

  it('wassersteinDistance: a zero weight on an infinite value still gives NaN (0 * Infinity)', () => {
    expect(wassersteinDistance([1, Infinity], [1, 2], { uWeights: [1, 0] })).toBeNaN();
    expect(wassersteinDistance([Infinity, 2], [Infinity, 3], { uWeights: [0, 1] })).toBeNaN();
  });

  it('wassersteinDistance: finite input is unchanged', () => {
    expect(wassersteinDistance([1, 2], [1, 2])).toBe(0);
    expect(wassersteinDistance([0, 1, 3], [5, 6, 8])).toBeCloseTo(5, 12);
  });
});

describe('fisherExact returns at once for large counts (#1146)', () => {
  // The old loop evaluated every table of the hypergeometric range: 1e9 entries never returned.
  // No wall-clock assertion: with the old code this test does not end, and the runner limit is the failure.
  it('[[1e9, 1e9], [1e9, 1e9]] gives p = 1 (SciPy: 1.0)', () => {
    const r = fisherExact([
      [1e9, 1e9],
      [1e9, 1e9],
    ]);
    expect(r.pValue).toBe(1);
  });
});
