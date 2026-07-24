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
 * Mann-Whitney / KS-2samp exact small-n p-values: investigated but NOT
 * wired into `mannWhitneyTest`/`kolmogorovSmirnov2Test`'s default `pValue`.
 * Making the exact U-distribution / KS lattice-path p the default for
 * n1*n2 <= 400 is a REAL regression against two pre-existing, deliberately
 * pinned oracle tests:
 *   - functions/tests/gap-hypothesis-oracle.test.ts ("mannWhitneyTest —
 *     external oracle"): pins the *normal-approximation* p for
 *     [1,2,3] vs [4,5,6] (n1*n2=9) into (0.04, 0.055). scipy's exact p for
 *     this case (mannwhitneyu(..., method='exact')) is 0.1 — outside that
 *     bound.
 *   - functions/tests/gap-stats-completeness.test.ts ("Wave 1:
 *     kolmogorovSmirnov2Test vs scipy.ks_2samp"): pins the kstwobign
 *     ASYMPTOTIC p for n=8,8 and n=10,10 (both <= 400) with an explicit
 *     comment that this was a deliberate choice over scipy's
 *     version-specific small-n exact p.
 * Changing either default would silently invalidate a documented design
 * decision (ADR-level), so this was left for the parent/user to decide
 * rather than resolved unilaterally. See session report for scipy-verified
 * values on both sides.
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
