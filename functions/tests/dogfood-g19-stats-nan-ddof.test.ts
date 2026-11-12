/**
 * Dogfood relay G19 — statistics NaN / ddof / typed arrays (#769 #771 #767 #776 #775).
 *
 * Parity oracles: NumPy `np.var(..., ddof=)`, `np.nanmean`, empty reductions → nan.
 */
import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  mode,
  variance,
  std,
  cov,
  quantileSeq,
  mad,
  corr,
  describe as describeStats,
  nanmean,
  nanmedian,
  nanvariance,
} from '../src/index.js';

const SEQ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('G19 #769 variance ddof', () => {
  it('exact issue repro: { ddof: 1 } and { ddof: 0 }', () => {
    expect(variance(SEQ)).toBeCloseTo(9.166666666666666, 12);
    expect(variance(SEQ, 'unbiased')).toBeCloseTo(9.166666666666666, 12);
    expect(variance(SEQ, 'uncorrected')).toBeCloseTo(8.25, 12);
    expect(variance(SEQ, { ddof: 1 })).toBeCloseTo(9.166666666666666, 12);
    expect(variance(SEQ, { ddof: 0 })).toBeCloseTo(8.25, 12);
    expect(cov(SEQ, SEQ, 1)).toBeCloseTo(9.166666666666666, 12);
    expect(cov(SEQ, SEQ, 0)).toBeCloseTo(8.25, 12);
  });

  it('std honors ddof object', () => {
    expect(std(SEQ, { ddof: 0 })).toBeCloseTo(Math.sqrt(8.25), 12);
  });
});

describe('G19 #771 skip NaN / nan* helpers', () => {
  const x = [1, 2, NaN, 4, 5];

  it('exact issue repro: mean/median/variance propagate without option', () => {
    expect(mean(x)).toBeNaN();
    expect(median(x)).toBeNaN();
    expect(variance(x)).toBeNaN();
  });

  it('skipNaN and nan* match NumPy nanmean / nanmedian / nanvar', () => {
    expect(mean(x, { skipNaN: true })).toBe(3);
    expect(median(x, { skipNaN: true })).toBe(3);
    expect(nanmean(x)).toBe(3);
    expect(nanmedian(x)).toBe(3);
    // numpy.nanvar([1,2,nan,4,5], ddof=1) = 3.333...
    expect(nanvariance(x, 1)).toBeCloseTo(3.333333333333333, 12);
    expect(variance(x, { skipNaN: true, ddof: 1 })).toBeCloseTo(3.333333333333333, 12);
  });
});

describe('G19 #767 Float64Array on reductions', () => {
  it('exact issue repro loop', () => {
    const a = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mean(a)).toBe(5.5);
    expect(median(a)).toBe(5.5);
    expect(variance(a)).toBeCloseTo(9.166666666666666, 12);
    expect(quantileSeq(a, 0.5)).toBe(5.5);
    expect(mad(a)).toBe(2.5);
    expect(corr(a, a)).toBe(1);
    const dup = new Float64Array([1, 1, 2, 3, 4]);
    expect(mode(dup)).toEqual([1]);
    expect(describeStats(a).mean).toBe(5.5);
  });
});

describe('G19 #776 huge identical values', () => {
  it('exact issue repro: variance is 0, not NaN', () => {
    const huge = [1e308, 1e308, 1e308];
    expect(mean(huge)).toBe(Infinity);
    expect(variance(huge)).toBe(0);
    expect(Number.isNaN(variance(huge))).toBe(false);
  });
});

describe('G19 #775 empty input', () => {
  it('exact issue repro: median/mode do not throw', () => {
    expect(mean([])).toBeNaN();
    expect(variance([])).toBeNaN();
    expect(median([])).toBeNaN();
    expect(mad([])).toBeNaN();
    expect(mode([])).toEqual([]);
  });
});
