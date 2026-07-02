import { describe, it, expect } from 'vitest';

import { studentTTest, anova } from '../src/typed/hypothesis.js';

/**
 * External-oracle pins for the core `hypothesis.ts` tests the WS-1 audit flagged
 * as SELF-REF (`docs/roadmap/ORACLE_COVERAGE_MATRIX.md`). The oracle is
 * independent of the implementation:
 *
 *  - test **statistics** are exact closed forms hand-derived from the definitions
 *    (t = x̄ / (s/√n) with sample variance; one-way F = MSB/MSW), verified by an
 *    independent arithmetic pass;
 *  - **p-values** are pinned to an exact closed form where one exists (the F(2, d₂)
 *    survival function `P(F>x) = (1 + 2x/d₂)^(−d₂/2)`), otherwise bracketed by
 *    published Student-t two-tailed critical values (df=4: t₀.₀₅=2.776, t₀.₀₂=3.747,
 *    t₀.₀₁=4.604).
 *
 * Covers `studentTTest` and `anova`; the permutation tests (KS/MW/W/chi²) return
 * stochastic empirical p-values and need a statistic-only or seeded approach —
 * tracked as remaining WS-1 P2 work.
 */

/** Relative closeness (absolute for values ≤ 1). */
function expectClose(actual: number, expected: number, relTol: number): void {
  const diff = Math.abs(actual - expected);
  const scale = Math.max(1, Math.abs(expected));
  expect(diff / scale).toBeLessThan(relTol);
}

describe('studentTTest — external oracle (exact statistic + t-table p brackets)', () => {
  it('one-sample t on [1,2,3,4,5] (vs μ=0) equals 3·√2, df=4', () => {
    // mean=3, sample variance s²=Σ(x−3)²/(n−1)=10/4=2.5 ⇒ t = 3 / √(2.5/5) = 3/√0.5 = 3√2.
    const r = studentTTest([1, 2, 3, 4, 5]);
    expectClose(r.statistic, 3 * Math.SQRT2, 1e-9);
    expect(r.degreesOfFreedom).toBe(4);
    // |t| = 4.243 lies between the df=4 two-tailed critical values 3.747 (p=0.02)
    // and 4.604 (p=0.01) ⇒ 0.01 < p < 0.02.
    expect(r.pValue).toBeGreaterThan(0.01);
    expect(r.pValue).toBeLessThan(0.02);
  });

  it('two-sample Welch t on [1,2,3] vs [4,5,6] equals −3/√(2/3), df=4', () => {
    // m1=2, m2=5, v1=v2=1, se=√(1/3+1/3)=√(2/3); t=(2−5)/se. Welch df = 4.
    const r = studentTTest([1, 2, 3], [4, 5, 6]);
    expectClose(r.statistic, -3 / Math.sqrt(2 / 3), 1e-9);
    expectClose(r.degreesOfFreedom, 4, 1e-9);
    // |t| = 3.674 lies between df=4 two-tailed 2.776 (p=0.05) and 3.747 (p=0.02).
    expect(r.pValue).toBeGreaterThan(0.02);
    expect(r.pValue).toBeLessThan(0.05);
  });
});

describe('anova — external oracle (exact F and closed-form p-value)', () => {
  it('one-way ANOVA on three equal-spaced groups: F=27, p=0.001, df=(2,6)', () => {
    // grand mean 5; SSB = 3·(9+0+9)=54; SSW = 3·2 = 6; MSB=54/2=27, MSW=6/6=1 ⇒ F=27.
    const r = anova([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expectClose(r.fStatistic, 27, 1e-9);
    expect(r.dfBetween).toBe(2);
    expect(r.dfWithin).toBe(6);
    // For numerator df=2 the F survival is exactly (1 + 2x/d₂)^(−d₂/2);
    // at x=27, d₂=6: (1+9)^(−3) = 10⁻³ = 0.001.
    expectClose(r.pValue, 0.001, 1e-6);
  });
});
