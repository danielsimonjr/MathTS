import { describe, it, expect } from 'vitest';
import {
  normalQuantile,
  studentTCDF,
  studentTQuantile,
  chiSquaredCDF,
  chiSquaredQuantile,
  fCDF,
  fQuantile,
  gammaCDF,
  betaCDF,
  fTest,
  jarqueBera,
  normalCDF,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave B of the domain gap analysis — standalone distribution CDF/quantile surface
 * (bridge C4) + low-complexity hypothesis tests (bridge C9). Reference values from
 * scipy.stats (chi2/t/f/norm/gamma/beta + jarque_bera), pinned so CI needs no Python.
 * These wrap the existing distribution objects + reuse variance/skewness/kurtosis —
 * no distribution math or tail probability is re-implemented.
 */
describe('gap Wave B — standalone distribution functions (vs SciPy)', () => {
  it('quantiles invert their CDFs and match scipy.ppf', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 9);
    expect(chiSquaredQuantile(0.95, 3)).toBeCloseTo(7.814727903251179, 6);
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.2281388519862744, 6);
    expect(fQuantile(0.95, 5, 10)).toBeCloseTo(3.3258345304130104, 5);
  });

  it('CDFs match scipy.cdf', () => {
    expect(chiSquaredCDF(7, 3)).toBeCloseTo(0.9281022275035349, 9);
    expect(studentTCDF(2, 10)).toBeCloseTo(0.9633059826146299, 9);
    expect(fCDF(3, 5, 10)).toBeCloseTo(0.9344424379061559, 9);
    expect(gammaCDF(2, 3, 1)).toBeCloseTo(0.32332358381693654, 9);
    expect(betaCDF(0.4, 2, 3)).toBeCloseTo(0.5248, 9);
  });

  it('normalQuantile is the inverse of normalCDF (round-trip)', () => {
    for (const p of [0.01, 0.25, 0.5, 0.84, 0.999]) {
      expect(normalCDF(normalQuantile(p) as number) as number).toBeCloseTo(p, 9);
    }
  });
});

describe('gap Wave B — hypothesis tests (vs SciPy)', () => {
  const x = [2.5, 3.1, 1.8, 4.2, 2.9, 3.7, 2.1, 3.3];
  const y = [1.0, 2.0, 1.5, 3.0, 2.2, 2.8, 1.7, 2.5];
  const z = [1.2, 0.4, -0.7, 2.1, -1.3, 0.9, 0.1, -0.5, 1.8, -2.0, 0.3, 1.1, -0.9, 0.6, -0.2];

  it('fTest — variance ratio + two-sided p-value', () => {
    const r = fTest(x, y);
    expect(r.statistic).toBeCloseTo(1.4086482275029217, 9);
    expect(r.pValue).toBeCloseTo(0.6625574737731921, 9);
    expect(r.df1).toBe(7);
    expect(r.df2).toBe(7);
  });

  it('jarqueBera — matches scipy.stats.jarque_bera', () => {
    const r = jarqueBera(z);
    expect(r.statistic).toBeCloseTo(0.3566922140510697, 6);
    expect(r.pValue).toBeCloseTo(0.8366528019589446, 6);
    expect(r.skewness).toBeCloseTo(-0.14769654991988523, 9);
    expect(r.kurtosis).toBeCloseTo(-0.695306018274517, 9);
  });
});
