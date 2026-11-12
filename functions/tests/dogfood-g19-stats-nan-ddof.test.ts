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
  nanstd,
  factory_variance,
} from '../src/index.js';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

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

  it('ddof 0, 1 and 2 match NumPy divisors; ddof >= n is NaN', () => {
    // SSD of 1..10 is 82.5. np.var(ddof=2) = 82.5 / 8 = 10.3125
    expect(variance(SEQ, { ddof: 2 })).toBeCloseTo(10.3125, 12);
    expect(std(SEQ, { ddof: 2 })).toBeCloseTo(Math.sqrt(10.3125), 12);
    expect(variance([1, 2], { ddof: 2 })).toBeNaN();
    expect(variance([1], { ddof: 1 })).toBeNaN();
    expect(variance([1], { ddof: 0 })).toBe(0);
    expect(std([1, 2, 3], { ddof: 3 })).toBeNaN();
    // mathjs string on one value stays 0; the ddof spelling follows NumPy.
    expect(variance([1], 'unbiased')).toBe(0);
    expect(variance([1], 'uncorrected')).toBe(0);
  });

  it('a string and ddof that disagree throw; agreeing aliases compute', () => {
    expect(() => variance(SEQ, 'unbiased', { ddof: 0 })).toThrow(/Conflicting variance options/);
    expect(() => variance(SEQ, { ddof: 0, normalization: 'unbiased' })).toThrow(
      /Conflicting variance options/
    );
    expect(() => std(SEQ, 'biased', { ddof: 1 })).toThrow(/Conflicting variance options/);
    expect(variance(SEQ, 'uncorrected', { ddof: 0 })).toBeCloseTo(8.25, 12);
    expect(variance(SEQ, 'unbiased', { skipNaN: true })).toBeCloseTo(9.166666666666666, 12);
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

  it('skipna keeps Infinity, all-NaN is NaN, and matrices honor dim', () => {
    expect(mean([1, NaN, Infinity], { skipna: true })).toBe(Infinity);
    expect(mean([1, Infinity], { skipNaN: true })).toBe(Infinity);
    expect(mean([NaN, NaN], { skipNaN: true })).toBeNaN();
    expect(nanmean([NaN, NaN])).toBeNaN();
    expect(nanvariance([NaN, NaN])).toBeNaN();
    expect(nanstd([NaN, NaN])).toBeNaN();
    expect(median([NaN, NaN], { skipna: true })).toBeNaN();

    const A = [
      [1, NaN],
      [3, 4],
    ];
    expect(mean(A, 0, { skipna: true })).toEqual([2, 4]);
    expect(mean(A, 1, { skipNaN: true })).toEqual([1, 3.5]);
    expect(median(A, 0, { skipna: true })).toEqual([2, 4]);
    expect(nanmean(A, 0)).toEqual([2, 4]);
    expect(nanmedian(A, 0)).toEqual([2, 4]);
    const colVar = variance(A, 0, { skipna: true, ddof: 1 }) as number[];
    expect(colVar[0]).toBeCloseTo(2, 12);
    expect(colVar[1]).toBeNaN();
    const colStd = std(A, 0, { skipna: true, ddof: 1 }) as number[];
    expect(colStd[0]).toBeCloseTo(Math.sqrt(2), 12);
    expect(colStd[1]).toBeNaN();
    expect(nanvariance(A, 1, 0)).toEqual(colVar);
    expect(mean([[NaN, NaN]], 0, { skipna: true })).toEqual([NaN, NaN]);

    const dense = new DenseMatrix(2, 2, [
      [1, NaN],
      [3, 4],
    ]);
    expect(mean(dense, 0, { skipna: true })).toEqual([2, 4]);
    expect(variance(dense, 1, { skipNaN: true, ddof: 0 })).toEqual([0, 0.25]);
    expect(median(dense, 0, { skipna: true })).toEqual([2, 4]);
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
    expect(variance(new Float64Array(huge))).toBe(0);
  });

  it('shifted two-pass is exact on a large offset and finite near 1e308', () => {
    const offset = [1e9 + 1, 1e9 + 2, 1e9 + 3];
    expect(variance(offset)).toBe(1);
    expect(variance(offset, { ddof: 0 })).toBeCloseTo(2 / 3, 12);
    expect(std(offset, 'uncorrected')).toBeCloseTo(Math.sqrt(2 / 3), 12);

    // A 1e150 bump is below the ulp of 1e308, so the samples collapse and the variance is 0.
    expect(variance([1e308, 1e308, 1e308 + 1e150])).toBe(0);
    // A representable gap squares past the float range: Infinity, not NaN from Inf-Inf.
    expect(variance([1e308, 1e308, 1e307], { ddof: 1 })).toBe(Infinity);
    expect(variance([8e307, 8e307, 8e307 + 2e293, 8e307 + 4e293], { ddof: 0 })).toBe(Infinity);
    expect(variance([Infinity, Infinity, Infinity])).toBeNaN();
  });
});

describe('G19 #775 empty input', () => {
  it('exact issue repro: median/mode do not throw', () => {
    expect(mean([])).toBeNaN();
    expect(variance([])).toBeNaN();
    expect(median([])).toBeNaN();
    expect(mad([])).toBeNaN();
    expect(mode([])).toBeNaN();
    expect(std([])).toBeNaN();
    expect(nanmean([])).toBeNaN();
    expect(nanmedian([])).toBeNaN();
  });
});

describe('G19 rich types and factory dim', () => {
  it('factory variance still accepts BigNumber and a numeric dimension', () => {
    const v = factory_variance([
      BigNumber.fromNumber(2),
      BigNumber.fromNumber(4),
      BigNumber.fromNumber(6),
    ]) as { toNumber(): number };
    expect(v.toNumber()).toBe(4);
    const along = factory_variance(
      [
        [1, 2, 3],
        [4, 6, 8],
      ],
      0
    ) as number[];
    expect(along[0]).toBeCloseTo(4.5, 12);
    expect(along[1]).toBeCloseTo(8, 12);
    expect(along[2]).toBeCloseTo(12.5, 12);
  });
});
