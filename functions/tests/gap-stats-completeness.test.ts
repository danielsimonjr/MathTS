import { describe, it, expect } from 'vitest';
import {
  kolmogorovSmirnov2Test,
  leveneTest,
  bartlettTest,
  hypergeometricDist,
  negativeBinomialDist,
} from '../src/index.js';

/**
 * Statistics/probability completeness waves (2026-07-06) — closing the breadth
 * gap to matrix-level parity. Every new function is pinned to an EXTERNAL oracle
 * (scipy 1.17.1), not to its own output. Reference values are generated with
 * scipy and embedded per test.
 *
 * Wave 1 — two-sample Kolmogorov–Smirnov. D pinned to `scipy.stats.ks_2samp`
 * (exact statistic); p-value pinned to the asymptotic Kolmogorov distribution
 * `scipy.stats.distributions.kstwobign.sf(√(n₁n₂/(n₁+n₂))·D)` (scipy's small-n
 * `ks_2samp` p is an exact combinatorial value, version-specific; the asymptotic
 * is the stable, standard oracle).
 */
describe('Wave 1: kolmogorovSmirnov2Test vs scipy.ks_2samp', () => {
  it('D matches scipy exactly, p matches kstwobign (n=8,8)', () => {
    const a = [0.1, 0.2, 0.35, 0.4, 0.55, 0.6, 0.7, 0.85];
    const b = [0.3, 0.45, 0.5, 0.65, 0.75, 0.8, 0.9, 0.95];
    const r = kolmogorovSmirnov2Test(a, b);
    expect(r.statistic).toBeCloseTo(0.375, 10);
    expect(r.pValue).toBeCloseTo(0.6271670418, 8);
  });

  it('D and p match scipy (n=10,10, shifted)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const r = kolmogorovSmirnov2Test(a, b);
    expect(r.statistic).toBeCloseTo(0.5, 10);
    expect(r.pValue).toBeCloseTo(0.1640791977, 8);
  });

  it('identical samples give D=0, p=1', () => {
    const r = kolmogorovSmirnov2Test([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
  });

  it('rejects empty samples', () => {
    expect(() => kolmogorovSmirnov2Test([], [1, 2])).toThrow(/non-empty/);
  });
});

describe('Wave 2: Levene + Bartlett vs scipy', () => {
  const g1 = [8.1, 8.3, 7.9, 8.0, 8.2];
  const g2 = [9.1, 9.5, 8.9, 9.3, 9.0];
  const g3 = [7.1, 7.3, 6.9, 7.5, 7.0];

  it('leveneTest (median-centered) matches scipy.stats.levene', () => {
    const r = leveneTest([g1, g2, g3]);
    expect(r.statistic).toBeCloseTo(0.3529411765, 8);
    expect(r.pValue).toBeCloseTo(0.7096733516, 7);
    expect(r.degreesOfFreedom).toEqual([2, 12]);
  });

  it('leveneTest (mean-centered) matches scipy', () => {
    const r = leveneTest([g1, g2, g3], 'mean');
    expect(r.statistic).toBeCloseTo(0.8404669261, 8);
    expect(r.pValue).toBeCloseTo(0.4553999912, 7);
  });

  it('bartlettTest matches scipy.stats.bartlett', () => {
    const r = bartlettTest([g1, g2, g3]);
    expect(r.statistic).toBeCloseTo(0.758451453, 8);
    expect(r.pValue).toBeCloseTo(0.68439111, 7);
    expect(r.degreesOfFreedom).toBe(2);
  });

  it('both reject <2 groups', () => {
    expect(() => leveneTest([g1])).toThrow(/at least 2/);
    expect(() => bartlettTest([g1])).toThrow(/at least 2/);
  });
});

describe('Wave 3: hypergeometric + negative-binomial vs scipy', () => {
  it('hypergeometricDist(50,5,10) pmf/cdf/mean/var match scipy.stats.hypergeom', () => {
    const h = hypergeometricDist(50, 5, 10);
    const pmf = [0.310562782, 0.4313371972, 0.2098397176, 0.0441767826, 0.0039645831, 0.0001189375];
    pmf.forEach((v, k) => expect(h.pdf(k)).toBeCloseTo(v, 10));
    expect(h.cdf(2)).toBeCloseTo(0.9517396968, 9);
    expect(h.mean).toBeCloseTo(1.0, 12);
    expect(h.variance).toBeCloseTo(0.7346938776, 9);
    // pmf sums to 1 over support
    let s = 0;
    for (let k = 0; k <= 5; k++) s += h.pdf(k);
    expect(s).toBeCloseTo(1, 10);
  });

  it('negativeBinomialDist(5,0.4) pmf/cdf/mean/var match scipy.stats.nbinom', () => {
    const nb = negativeBinomialDist(5, 0.4);
    expect(nb.pdf(0)).toBeCloseTo(0.01024, 10);
    expect(nb.pdf(3)).toBeCloseTo(0.0774144, 10);
    expect(nb.pdf(5)).toBeCloseTo(0.1003290624, 9);
    expect(nb.pdf(10)).toBeCloseTo(0.0619792816, 9);
    expect(nb.cdf(5)).toBeCloseTo(0.3668967424, 8);
    expect(nb.mean).toBeCloseTo(7.5, 10);
    expect(nb.variance).toBeCloseTo(18.75, 10);
  });

  it('reject invalid params', () => {
    expect(() => hypergeometricDist(10, 20, 5)).toThrow();
    expect(() => negativeBinomialDist(0, 0.5)).toThrow();
    expect(() => negativeBinomialDist(5, 1.5)).toThrow();
  });
});
