import { describe, it, expect } from 'vitest';
import { mannWhitneyTest, kolmogorovSmirnov2Test } from '../src/index.js';

/**
 * Phase 4 Task 2b — exact small-n Mann-Whitney (now the default) + opt-in
 * exact two-sample KS. Oracle values from `scipy` (verified locally,
 * scipy 1.17.1):
 *   - mannwhitneyu([1,2,3,4],[5,6,7,8], method='exact') -> p=0.02857142857142857
 *   - mannwhitneyu([1,2,3],[4,5,6], method='exact')     -> p=0.1
 * `kolmogorovSmirnov2Test`'s default stays the asymptotic `kstwobign` value
 * (unchanged from before Task 2b — see gap-stats-completeness.test.ts, which
 * is NOT modified by this change); `{ method: 'exact' }` opts into the
 * lattice-path exact p-value.
 */
describe('exact MW (default) + KS (opt-in)', () => {
  it('MW exact default: [1,2,3,4] vs [5,6,7,8] -> p=0.02857', async () => {
    const r = await mannWhitneyTest([1, 2, 3, 4], [5, 6, 7, 8]);
    expect(r.pValue).toBeCloseTo(0.02857, 4);
  });

  it('MW exact default: [1,2,3] vs [4,5,6] -> p=0.1', async () => {
    const r = await mannWhitneyTest([1, 2, 3], [4, 5, 6]);
    expect(r.pValue).toBeCloseTo(0.1, 4);
  });

  it('MW falls back to normal approximation when ties are present', async () => {
    // Identical samples -> ties throughout; must not attempt the (ties-invalid)
    // exact recurrence. p should still be a valid, high p (no separation).
    const r = await mannWhitneyTest([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(r.pValue).toBeGreaterThan(0.5);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });

  it('KS default result is unchanged (asymptotic); exact is opt-in and differs sensibly', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1.5, 2.5, 3.5, 6, 7];
    const def = kolmogorovSmirnov2Test(a, b);
    const exact = kolmogorovSmirnov2Test(a, b, { method: 'exact' });
    expect(def.statistic).toBeCloseTo(exact.statistic, 10);
    // scipy: ks_2samp(a, b, method='asymp').pvalue via kstwobign  ~ 0.8186211744710058
    expect(def.pValue).toBeCloseTo(0.8186211744710058, 8);
    // scipy: ks_2samp(a, b, method='exact').pvalue = 0.873015873015873
    expect(exact.pValue).toBeCloseTo(0.873015873015873, 8);
    expect(def.pValue).not.toBeCloseTo(exact.pValue, 3);
  });

  it('KS exact matches scipy on the pinned n=8,8 case (asymptotic pin untouched)', () => {
    const c = [0.1, 0.2, 0.35, 0.4, 0.55, 0.6, 0.7, 0.85];
    const d = [0.3, 0.45, 0.5, 0.65, 0.75, 0.8, 0.9, 0.95];
    const exact = kolmogorovSmirnov2Test(c, d, { method: 'exact' });
    // scipy: ks_2samp(c, d, method='exact').pvalue = 0.6601398601398599
    expect(exact.pValue).toBeCloseTo(0.6601398601398599, 8);
  });
});
