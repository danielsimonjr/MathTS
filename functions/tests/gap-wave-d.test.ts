import { describe, it, expect } from 'vitest';
import {
  movingAverage,
  ewma,
  detrend,
  acf,
  gradient,
  linearRegression,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave D (batch 1) — time-series basics, numeric gradient, OLS regression. Reference
 * values from NumPy/SciPy (convolve, scipy.signal.detrend, numpy.gradient,
 * scipy.stats.linregress) + the canonical EWMA/ACF formulas. Pinned so CI needs no
 * Python. Reuses mean + the studentTCDF connector.
 */
const X = [2, 4, 6, 8, 7, 5, 3, 5, 7, 9];
const T = [1, 2, 3, 5, 8, 13];
const Y = [1, 4, 9, 25, 64, 169];
const arrCloseTo = (a: number[], b: number[], d = 9) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
};

describe('gap Wave D — time series', () => {
  it('movingAverage (window 3, valid)', () => {
    arrCloseTo(movingAverage(X, 3), [4, 6, 7, 6.6666666667, 5, 4.3333333333, 5, 7]);
  });
  it('ewma (alpha 0.4, adjust=False)', () => {
    arrCloseTo(ewma(X, 0.4), [
      2, 2.8, 4.08, 5.648, 6.1888, 5.71328, 4.627968, 4.7767808, 5.66606848, 6.999641088,
    ]);
  });
  it('detrend — linear and constant (vs scipy.signal.detrend)', () => {
    arrCloseTo(
      detrend(X),
      [
        -1.90909090909091, -0.284848484848486, 1.339393939393939, 2.963636363636363,
        1.587878787878787, -0.7878787878787881, -3.163636363636364, -1.53939393939394,
        0.08484848484848495, 1.709090909090909,
      ],
      9
    );
    // constant detrend = subtract mean; sums to ~0
    expect(detrend(X, 'constant').reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9);
  });
  it('acf — biased estimator, acf[0] = 1 (vs numpy formula)', () => {
    arrCloseTo(acf(X, 4), [
      1.0, 0.35225225225225226, -0.34054054054054056, -0.627927927927928, -0.14954954954954958,
    ]);
  });
});

describe('gap Wave D — numeric gradient (vs numpy.gradient)', () => {
  it('uniform spacing', () => {
    arrCloseTo(gradient(Y), [3, 4, 10.5, 27.5, 72, 105]);
  });
  it('non-uniform spacing (second-order)', () => {
    arrCloseTo(gradient(Y, T), [3, 4, 6, 10, 16, 21], 9);
  });
});

describe('gap Wave D — linearRegression (vs scipy.stats.linregress)', () => {
  it('matches slope/intercept/r/p/stderr', () => {
    const r = linearRegression(T, Y);
    expect(r.slope).toBeCloseTo(14.00657894736842, 9);
    expect(r.intercept).toBeCloseTo(-29.368421052631568, 9);
    expect(r.rValue).toBeCloseTo(0.9718272335555642, 9);
    expect(r.rSquared).toBeCloseTo(0.9718272335555642 ** 2, 9);
    expect(r.pValue).toBeCloseTo(0.0011793767241557848, 7);
    expect(r.stdErr).toBeCloseTo(1.6984868561209163, 9);
  });
});
