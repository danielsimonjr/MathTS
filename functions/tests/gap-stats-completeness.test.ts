import { describe, it, expect } from 'vitest';
import { kolmogorovSmirnov2Test } from '../src/index.js';

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
