import { describe, it, expect } from 'vitest';
import { kendallTauTest } from '../src/index.js';

/**
 * Task 2 (Phase 4) — exact small-n p-values.
 *
 * Kendall τ p-value: `kendallTauTest` below is new (delegates to the
 * pre-existing `kendalltau`, which already implements the requested normal
 * approximation `z = τ / √(2(2n+5) / (9n(n−1)))`; verified algebraically
 * equivalent to `kendalltau`'s `z = 3τ√(n(n−1)) / √(2(2n+5))`). It only
 * renames `coefficient` → `tau` to match the `*Test` result-object
 * convention used elsewhere in this file.
 *
 * Mann-Whitney exact p-values: `mannWhitneyTest` chooses its method as
 * `scipy.stats.mannwhitneyu` does (`_mwu_choose_method`): the exact U
 * distribution when there are no ties and one sample has 8 or fewer
 * values, otherwise the normal approximation (#1148; pinned in
 * dogfood-1148-mw-wilcoxon-scipy.test.ts).
 *
 * KS-2samp: `kolmogorovSmirnov2Test` keeps the kstwobign ASYMPTOTIC p for
 * small samples (pinned in gap-stats-completeness.test.ts, "Wave 1:
 * kolmogorovSmirnov2Test vs scipy.ks_2samp"), a documented choice over
 * SciPy's small-n exact p.
 */
describe('exact p-values — Kendall tau (new export)', () => {
  it('kendallTauTest: perfect concordance -> tau=1, small p', () => {
    const r = kendallTauTest([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(r.tau).toBeCloseTo(1, 8);
    expect(r.pValue).toBeLessThan(0.05);
  });

  it('kendallTauTest: perfect discordance -> tau=-1', () => {
    const r = kendallTauTest([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]);
    expect(r.tau).toBeCloseTo(-1, 8);
  });

  it('kendallTauTest matches scipy.stats.kendalltau coefficient (no ties)', () => {
    // scipy.stats.kendalltau([1,2,3,4,5],[2,1,4,3,5]) -> tau=0.6
    const r = kendallTauTest([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]);
    expect(r.tau).toBeCloseTo(0.6, 12);
  });
});
