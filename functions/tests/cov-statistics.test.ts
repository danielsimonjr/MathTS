/**
 * Coverage tests for functions/src/typed/statistics.ts.
 *
 * Targets the typed-dispatch branches the existing statistics suites miss:
 *   - the variadic (number, number[, number[, number]]) overloads of sum / mean
 *     / variance / std / min / max / median / prod,
 *   - the normalization variants (uncorrected / biased / n == 1) of variance/std,
 *   - the empty- and single-element guard branches,
 *   - the minMax, mode, cumsum, distance, correlation, MAD, quantile, percentile
 *     and histogram forms (Float64Array + number[] paths),
 *   - the p-norm branches (p = 1, 2, ∞, −∞, general p) of parallelStatNorm.
 *
 * Reference values are computed by hand / from textbook formulas, not from the
 * implementation under test.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  parallelStatSum,
  parallelStatMean,
  parallelStatVariance,
  parallelStatStd,
  parallelStatMin,
  parallelStatMax,
  parallelStatMinMax,
  parallelStatMedian,
  parallelStatMode,
  parallelStatProd,
  parallelStatNorm,
  parallelStatDistance,
  parallelStatCorr,
  parallelStatMAD,
  parallelStatCumsum,
  parallelStatQuantile,
  parallelStatPercentile,
  parallelStatHistogram,
  initializeStatistics,
  terminateStatistics,
} from '../src/typed/statistics.js';

const F = (...xs: number[]) => Float64Array.from(xs);

beforeAll(async () => {
  await initializeStatistics();
});

afterAll(async () => {
  await terminateStatistics();
});

describe('statistics — variadic number overloads', () => {
  it('sum / mean variadic', () => {
    expect(parallelStatSum(2, 3)).toBe(5);
    expect(parallelStatSum(1, 2, 3)).toBe(6);
    expect(parallelStatSum(1, 2, 3, 4)).toBe(10);
    expect(parallelStatMean(2, 4)).toBe(3);
    expect(parallelStatMean(1, 2, 3)).toBe(2);
    expect(parallelStatMean(2, 4, 6, 8)).toBe(5);
  });

  it('variance / median / prod / min / max variadic', () => {
    // unbiased variance of [2,4]: mean 3 -> ((1)+(1))/1 = 2
    expect(parallelStatVariance(2, 4)).toBeCloseTo(2, 10);
    // [1,2,3]: mean 2 -> (1+0+1)/2 = 1
    expect(parallelStatVariance(1, 2, 3)).toBeCloseTo(1, 10);
    expect(parallelStatMedian(2, 4)).toBe(3);
    expect(parallelStatMedian(3, 1, 2)).toBe(2);
    expect(parallelStatProd(2, 3)).toBe(6);
    expect(parallelStatProd(2, 3, 4)).toBe(24);
    expect(parallelStatProd(2, 3, 4, 5)).toBe(120);
    expect(parallelStatMin(5, 2)).toBe(2);
    expect(parallelStatMin(5, 2, 8)).toBe(2);
    expect(parallelStatMin(5, 2, 8, 1)).toBe(1);
    expect(parallelStatMax(5, 2)).toBe(5);
    expect(parallelStatMax(5, 2, 8)).toBe(8);
    expect(parallelStatMax(5, 2, 8, 1)).toBe(8);
  });
});

describe('statistics — variance/std normalizations + guards', () => {
  it('variance normalization variants (Float64Array, string)', async () => {
    const data = F(2, 4, 6, 8); // population variance = 5
    // uncorrected (population)
    expect(await (parallelStatVariance(data, 'uncorrected') as Promise<number>)).toBeCloseTo(5, 8);
    // biased: pop*n/(n+1) = 5*4/5 = 4
    expect(await (parallelStatVariance(data, 'biased') as Promise<number>)).toBeCloseTo(4, 8);
    // unbiased (sample): pop*n/(n-1) = 5*4/3 = 6.6667
    expect(await (parallelStatVariance(data, 'unbiased') as Promise<number>)).toBeCloseTo(
      6.666666666666667,
      8
    );
    // default Float64Array overload is unbiased too
    expect(await (parallelStatVariance(data) as Promise<number>)).toBeCloseTo(6.666666666666667, 8);
  });

  it('variance n <= 1 and empty guards', async () => {
    // Bare Float64Array overload returns 0 when n <= 1 (incl. empty).
    expect(await (parallelStatVariance(F(5)) as Promise<number>)).toBe(0);
    expect(await (parallelStatVariance(F()) as Promise<number>)).toBe(0);
    // The (Float64Array, string) overload returns NaN for empty and 0 for n == 1.
    expect(await (parallelStatVariance(F(5), 'unbiased') as Promise<number>)).toBe(0);
    expect(Number.isNaN(await (parallelStatVariance(F(), 'unbiased') as Promise<number>))).toBe(
      true
    );
    // number[] overloads return NaN for empty.
    expect(Number.isNaN(await (parallelStatVariance([]) as Promise<number>))).toBe(true);
    expect(Number.isNaN(await (parallelStatVariance([], 'biased') as Promise<number>))).toBe(true);
  });

  it('variance/std via number[] (+ normalization)', async () => {
    expect(await (parallelStatVariance([2, 4, 6, 8]) as Promise<number>)).toBeCloseTo(
      6.666666666666667,
      8
    );
    expect(await (parallelStatVariance([2, 4, 6, 8], 'uncorrected') as Promise<number>)).toBeCloseTo(
      5,
      8
    );
    expect(await (parallelStatStd([2, 4, 6, 8]) as Promise<number>)).toBeCloseTo(
      Math.sqrt(6.666666666666667),
      8
    );
    expect(await (parallelStatStd([2, 4, 6, 8], 'uncorrected') as Promise<number>)).toBeCloseTo(
      Math.sqrt(5),
      8
    );
  });

  it('std guards (Float64Array n<=1, empty array)', async () => {
    expect(await (parallelStatStd(F(7)) as Promise<number>)).toBe(0);
    expect(await (parallelStatStd(F(2, 4, 6, 8)) as Promise<number>)).toBeCloseTo(
      Math.sqrt(6.666666666666667),
      8
    );
    expect(await (parallelStatStd(F(2, 4, 6, 8), 'biased') as Promise<number>)).toBeCloseTo(
      Math.sqrt(4),
      8
    );
    expect(Number.isNaN(await (parallelStatStd([]) as Promise<number>))).toBe(true);
    expect(Number.isNaN(await (parallelStatStd([], 'unbiased') as Promise<number>))).toBe(true);
  });

  it('mean empty array guard', async () => {
    expect(Number.isNaN(await (parallelStatMean([]) as Promise<number>))).toBe(true);
  });
});

describe('statistics — min/max/minMax forms', () => {
  it('min/max number[] + empty guards', async () => {
    expect(await (parallelStatMin([4, 1, 7]) as Promise<number>)).toBe(1);
    expect(await (parallelStatMax([4, 1, 7]) as Promise<number>)).toBe(7);
    expect(await (parallelStatMin([]) as Promise<number>)).toBe(Infinity);
    expect(await (parallelStatMax([]) as Promise<number>)).toBe(-Infinity);
  });

  it('min/max Float64Array', async () => {
    expect(await (parallelStatMin(F(4, 1, 7)) as Promise<number>)).toBe(1);
    expect(await (parallelStatMax(F(4, 1, 7)) as Promise<number>)).toBe(7);
  });

  it('minMax Float64Array + number[]', async () => {
    const r1 = await (parallelStatMinMax(F(3, 1, 4, 1, 5)) as Promise<{ min: number; max: number }>);
    expect(r1.min).toBe(1);
    expect(r1.max).toBe(5);
    const r2 = await (parallelStatMinMax([3, 1, 4, 1, 5]) as Promise<{
      min: number;
      max: number;
    }>);
    expect(r2.min).toBe(1);
    expect(r2.max).toBe(5);
  });
});

describe('statistics — median / mode', () => {
  it('median Float64Array even/odd + guards', async () => {
    expect(await (parallelStatMedian(F(1, 2, 3, 4)) as Promise<number>)).toBe(2.5);
    expect(await (parallelStatMedian(F(5, 1, 3)) as Promise<number>)).toBe(3);
    expect(await (parallelStatMedian(F(42)) as Promise<number>)).toBe(42);
    expect(Number.isNaN(await (parallelStatMedian(F()) as Promise<number>))).toBe(true);
    expect(await (parallelStatMedian([4, 2, 6, 8]) as Promise<number>)).toBe(5);
    expect(Number.isNaN(await (parallelStatMedian([]) as Promise<number>))).toBe(true);
  });

  it('mode number[] + Float64Array (incl. multi-modal + empty)', () => {
    expect(parallelStatMode([1, 2, 2, 3, 3, 3])).toEqual([3]);
    // bimodal -> sorted list of all max-count values
    expect(parallelStatMode([1, 1, 2, 2, 3])).toEqual([1, 2]);
    expect(parallelStatMode([])).toEqual([]);
    expect(parallelStatMode(F(4, 4, 5))).toEqual([4]);
  });
});

describe('statistics — prod / cumsum', () => {
  it('prod number[] (incl. empty) + Float64Array sequential', async () => {
    expect(parallelStatProd([2, 3, 4])).toBe(24);
    expect(parallelStatProd([])).toBe(1);
    // small Float64Array stays below threshold -> sequential branch
    expect(await (parallelStatProd(F(2, 3, 4)) as Promise<number>)).toBe(24);
    expect(await (parallelStatProd(F()) as Promise<number>)).toBe(1);
  });

  it('cumsum Float64Array + number[]', () => {
    expect(Array.from(parallelStatCumsum(F(1, 2, 3, 4)) as Float64Array)).toEqual([1, 3, 6, 10]);
    expect(parallelStatCumsum([1, 2, 3])).toEqual([1, 3, 6]);
  });
});

describe('statistics — norm forms', () => {
  it('default L2 norm (Float64Array + number[])', async () => {
    expect(await (parallelStatNorm(F(3, 4)) as Promise<number>)).toBeCloseTo(5, 10);
    expect(await (parallelStatNorm([3, 4]) as Promise<number>)).toBeCloseTo(5, 10);
  });

  it('p-norm branches (p = 2, 1, ∞, −∞, general)', () => {
    const v = F(3, -4);
    expect(parallelStatNorm(v, 2) as number).toBeCloseTo(5, 10);
    expect(parallelStatNorm(v, 1) as number).toBeCloseTo(7, 10);
    expect(parallelStatNorm(v, Infinity) as number).toBe(4);
    expect(parallelStatNorm(v, -Infinity) as number).toBe(3);
    // general p=3: (3^3 + 4^3)^(1/3) = (27+64)^(1/3) = 91^(1/3)
    expect(parallelStatNorm(v, 3) as number).toBeCloseTo(Math.cbrt(91), 10);
    // number[] p-norm path
    expect(parallelStatNorm([3, -4], 1) as number).toBeCloseTo(7, 10);
  });
});

describe('statistics — distance / correlation / MAD', () => {
  it('distance forms', async () => {
    expect(await (parallelStatDistance(F(0, 0), F(3, 4)) as Promise<number>)).toBeCloseTo(5, 10);
    expect(await (parallelStatDistance([0, 0], [3, 4]) as Promise<number>)).toBeCloseTo(5, 10);
    // 2D-point form
    expect(parallelStatDistance(0, 0, 3, 4) as number).toBeCloseTo(5, 10);
  });

  it('correlation Float64Array + number[] + degenerate', async () => {
    // perfectly correlated
    expect(await (parallelStatCorr(F(1, 2, 3, 4), F(2, 4, 6, 8)) as Promise<number>)).toBeCloseTo(
      1,
      6
    );
    // perfectly anti-correlated
    expect(await (parallelStatCorr([1, 2, 3, 4], [8, 6, 4, 2]) as Promise<number>)).toBeCloseTo(
      -1,
      6
    );
    // constant series -> std 0 -> NaN
    expect(Number.isNaN(await (parallelStatCorr(F(1, 1, 1), F(1, 2, 3)) as Promise<number>))).toBe(
      true
    );
    // empty -> NaN
    expect(Number.isNaN(await (parallelStatCorr(F(), F()) as Promise<number>))).toBe(true);
  });

  it('mean absolute deviation', async () => {
    // [1,2,3,4,5] mean 3, MAD = (2+1+0+1+2)/5 = 1.2
    expect(await (parallelStatMAD(F(1, 2, 3, 4, 5)) as Promise<number>)).toBeCloseTo(1.2, 10);
    expect(await (parallelStatMAD([1, 2, 3, 4, 5]) as Promise<number>)).toBeCloseTo(1.2, 10);
    expect(Number.isNaN(await (parallelStatMAD(F()) as Promise<number>))).toBe(true);
  });
});

describe('statistics — quantile / percentile / histogram', () => {
  it('quantile interpolation + exact + guards', () => {
    const data = F(1, 2, 3, 4, 5);
    expect(parallelStatQuantile(data, 0) as number).toBe(1);
    expect(parallelStatQuantile(data, 1) as number).toBe(5);
    expect(parallelStatQuantile(data, 0.5) as number).toBe(3);
    // interpolated quartile: pos = 4*0.25 = 1 -> exact element index 1 = 2
    expect(parallelStatQuantile(data, 0.25) as number).toBe(2);
    // fractional interpolation: q=0.3 -> pos 1.2 -> 2*0.8 + 3*0.2 = 2.2
    expect(parallelStatQuantile(data, 0.3) as number).toBeCloseTo(2.2, 10);
    // single element + empty
    expect(parallelStatQuantile(F(7), 0.5) as number).toBe(7);
    expect(Number.isNaN(parallelStatQuantile(F(), 0.5) as number)).toBe(true);
    // out-of-range throws
    expect(() => parallelStatQuantile(data, -0.1)).toThrow(/between 0 and 1/);
    expect(() => parallelStatQuantile(data, 1.5)).toThrow(/between 0 and 1/);
  });

  it('quantile number[] + multi-quantile array', () => {
    expect(parallelStatQuantile([5, 1, 3, 2, 4], 0.5) as number).toBe(3);
    const qs = parallelStatQuantile(F(1, 2, 3, 4, 5), [0, 0.5, 1]) as number[];
    expect(qs).toEqual([1, 3, 5]);
  });

  it('percentile wrapper + range guard', () => {
    expect(parallelStatPercentile(F(1, 2, 3, 4, 5), 50)).toBe(3);
    expect(parallelStatPercentile(F(1, 2, 3, 4, 5), 100)).toBe(5);
    expect(() => parallelStatPercentile(F(1, 2, 3), -1)).toThrow(/between 0 and 100/);
    expect(() => parallelStatPercentile(F(1, 2, 3), 101)).toThrow(/between 0 and 100/);
  });

  it('histogram Float64Array (bins / bins+range) + number[]', async () => {
    const data = F(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    const h1 = await (parallelStatHistogram(data, 5) as Promise<number[]>);
    expect(h1.reduce((a, b) => a + b, 0)).toBe(10);
    const h2 = await (parallelStatHistogram(data, 2, 0, 10) as Promise<number[]>);
    expect(h2.reduce((a, b) => a + b, 0)).toBe(10);
    const h3 = await (parallelStatHistogram([0, 1, 2, 3], 2) as Promise<number[]>);
    expect(h3.reduce((a, b) => a + b, 0)).toBe(4);
  });
});
