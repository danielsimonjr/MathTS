import { describe, it, expect } from 'vitest';
import { normalCDF, normalDist, logNormalDist } from '@danielsimonjr/mathts-functions';

/**
 * GC3 — normal/log-normal CDF + quantile accuracy. The external-oracle audit
 * (vs scipy.stats) caught the old Abramowitz-&-Stegun erf approximation
 * collapsing in the tails (normalCDF(-5) was 3-digit; quantile was ~1e-3).
 * Reference values from scipy.stats.norm.
 */
describe('GC3: normal/log-normal CDF + quantile accuracy', () => {
  // [x, scipy norm.cdf(x)]
  const cdfRefs: [number, number][] = [
    [-5, 2.8665157187919333e-7],
    [-3, 0.0013498980316300933],
    [0, 0.5],
    [1.96, 0.9750021048517795],
    [5, 0.9999997133484281],
  ];

  it('normalCDF matches scipy across the tails (~14 digits)', () => {
    for (const [x, ref] of cdfRefs) {
      expect(normalCDF(x)).toBeCloseTo(ref, 14);
    }
  });

  it('normalDist cdf/quantile are mutual inverses to full precision', () => {
    const d = normalDist(1.5, 2.3);
    for (const p of [0.001, 0.05, 0.5, 0.95, 0.999]) {
      expect(d.cdf(d.quantile(p))).toBeCloseTo(p, 12);
    }
  });

  it('normalDist.quantile matches known z-scores', () => {
    const z = normalDist(0, 1);
    expect(z.quantile(0.975)).toBeCloseTo(1.959963984540054, 10); // scipy norm.ppf(0.975)
    expect(z.quantile(0.5)).toBeCloseTo(0, 12);
  });

  it('logNormalDist cdf/quantile round-trip', () => {
    const d = logNormalDist(0, 1);
    for (const p of [0.1, 0.5, 0.9]) {
      expect(d.cdf(d.quantile(p))).toBeCloseTo(p, 10);
    }
    expect(d.cdf(2)).toBeCloseTo(0.7558914042144173, 12); // scipy lognorm
  });
});
