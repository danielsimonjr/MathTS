import { describe, it, expect } from 'vitest';
import {
  gmean,
  hmean,
  moment,
  skewness,
  kurtosis,
  iqr,
  sem,
  zscore,
  cov,
  corrcoef,
  clamp,
  sigmoid,
  logsumexp,
  softmax,
  cumprod,
  cummax,
  cummin,
  cumtrapz,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave A of the domain gap analysis — descriptive-stats + elementwise/cumulative
 * primitives. Reference values are from SciPy/NumPy (scipy.stats / scipy.special /
 * numpy), pinned here so CI needs no Python. Conventions: skew/kurtosis population
 * (SciPy bias=true), kurtosis excess (fisher=true), cov/corrcoef ddof=1 rowvar=false,
 * zscore ddof=0, sem ddof=1.
 */
const X = [2.5, 3.1, 1.8, 4.2, 2.9, 3.7, 2.1, 3.3];
const Y = [1.0, 2.0, 1.5, 3.0, 2.2, 2.8, 1.7, 2.5];
const M = [
  [1, 2, 3],
  [2, 1, 4],
  [3, 5, 2],
  [4, 4, 6],
  [2, 3, 1],
];

const arrCloseTo = (a: number[], b: number[], d = 9) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
};

describe('gap Wave A — descriptive statistics (vs SciPy/NumPy)', () => {
  it('gmean / hmean', () => {
    expect(gmean(X)).toBeCloseTo(2.8503261474224093, 12);
    expect(hmean(X)).toBeCloseTo(2.7486213242171216, 12);
  });

  it('skewness — population and sample-corrected', () => {
    expect(skewness(X)).toBeCloseTo(0.057394721469627714, 12);
    expect(skewness(X, { bias: false })).toBeCloseTo(0.07158379451622182, 12);
  });

  it('kurtosis — excess (Fisher) and Pearson', () => {
    expect(kurtosis(X)).toBeCloseTo(-1.008712506852534, 12);
    expect(kurtosis(X, { fisher: false })).toBeCloseTo(1.991287493147466, 12);
  });

  it('moment(3) central', () => {
    expect(moment(X, 3)).toBeCloseTo(0.024374999999999904, 12);
    // raw 1st moment is the mean
    expect(moment(X, 1, false)).toBeCloseTo(2.95, 12);
  });

  it('iqr / sem', () => {
    expect(iqr(X)).toBeCloseTo(1.0, 12);
    expect(sem(X)).toBeCloseTo(0.284102597162162, 12);
  });

  it('zscore (ddof=0)', () => {
    arrCloseTo(zscore(X), [
      -0.5986710947139656, 0.19955703157132165, -1.5299372420468005, 1.6629752630943482,
      -0.06651901052377428, 0.9977851578566089, -1.130823178904157, 0.46563307366641704,
    ]);
  });

  it('cov(x,y) scalar and cov(M)/corrcoef(M) matrices', () => {
    expect(cov(X, Y)).toBeCloseTo(0.4707142857142857, 12);
    const c = cov(M) as number[][];
    arrCloseTo(c[0], [1.3, 1.25, 1.15]);
    arrCloseTo(c[1], [1.25, 2.5, -0.25]);
    arrCloseTo(c[2], [1.15, -0.25, 3.7]);
    const r = corrcoef(M);
    arrCloseTo(r[0], [1.0, 0.6933752452815363, 0.5243548654756861]);
    expect(r[1][1]).toBeCloseTo(1.0, 12);
    expect(r[1][2]).toBeCloseTo(-0.08219949365267865, 12);
  });
});

describe('gap Wave A — elementwise / cumulative (vs SciPy/NumPy)', () => {
  it('logsumexp / softmax (sum to 1)', () => {
    expect(logsumexp(X)).toBeCloseTo(5.303387901183306, 12);
    const s = softmax(X);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    arrCloseTo(s, [
      0.06060439273344899, 0.11042840338586737, 0.030095250776633654, 0.331745257530474,
      0.09041112986531034, 0.2012136699064959, 0.0406243393270475, 0.1348775564747222,
    ]);
  });

  it('sigmoid — stable on large-magnitude inputs', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(710)).toBeCloseTo(1, 12); // no overflow
    expect(sigmoid(-710)).toBeCloseTo(0, 12); // no overflow
    arrCloseTo(sigmoid(X) as number[], X.map((v) => 1 / (1 + Math.exp(-v))));
  });

  it('clamp — scalar and array', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(clamp([-1, 2, 5], 0, 3)).toEqual([0, 2, 3]);
  });

  it('cumprod / cummax / cummin', () => {
    arrCloseTo(cumprod(X), [2.5, 7.75, 13.95, 58.59, 169.911, 628.6707, 1320.20847, 4356.687951]);
    expect(cummax(X)).toEqual([2.5, 3.1, 3.1, 4.2, 4.2, 4.2, 4.2, 4.2]);
    expect(cummin(X)).toEqual([2.5, 2.5, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8]);
  });

  it('cumtrapz — unit, scalar dx, and explicit abscissae', () => {
    arrCloseTo(cumtrapz(Y), [0, 1.5, 3.25, 5.5, 8.1, 10.6, 12.85, 14.95]);
    // scalar dx scales linearly; explicit x with unit spacing equals the default
    arrCloseTo(
      cumtrapz(Y, 2),
      cumtrapz(Y).map((v) => v * 2)
    );
    arrCloseTo(cumtrapz(Y, [0, 1, 2, 3, 4, 5, 6, 7]), cumtrapz(Y));
  });
});

describe('gap Wave A — edge cases', () => {
  it('empty / degenerate inputs do not throw', () => {
    expect(gmean([])).toBeNaN();
    expect(logsumexp([])).toBe(-Infinity);
    expect(softmax([])).toEqual([]);
    expect(cumprod([])).toEqual([]);
  });
});
