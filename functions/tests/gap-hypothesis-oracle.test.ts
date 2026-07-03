import { describe, it, expect } from 'vitest';

import {
  studentTTest,
  anova,
  chiSquareTest,
  mannWhitneyTest,
  principalComponentAnalysis,
  kolmogorovSmirnovTest,
  shapiroWilkTest,
} from '../src/typed/hypothesis.js';

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
 * Covers `studentTTest`, `anova`, `chiSquareTest`, and `mannWhitneyTest`. For the
 * latter two, the *statistic* is deterministic and exactly hand-derivable, so it is
 * pinned directly; the χ² goodness-of-fit p-value is the exact χ²₂ survival
 * `exp(−x/2)`, and the Mann-Whitney p-value (a deterministic normal approximation
 * at the default settings) is bracketed by the Φ(1.96)=0.975 fact. `kolmogorovSmirnovTest`
 * / `shapiroWilkTest` / `principalComponentAnalysis` remain — tracked WS-1 P2 work.
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

describe('chiSquareTest — external oracle (exact statistic + closed-form χ²₂ p)', () => {
  it('goodness-of-fit [10,20,30] vs [20,20,20]: χ²=10, p=exp(−5)', async () => {
    // Σ(O−E)²/E = 100/20 + 0 + 100/20 = 10.  df = k−1 = 2.
    const r = await chiSquareTest([10, 20, 30], [20, 20, 20]);
    expectClose(r.statistic, 10, 1e-9);
    // χ²₂ survival is exactly exp(−x/2) ⇒ p(10) = exp(−5). No stats package needed.
    expectClose(r.pValue, Math.exp(-5), 1e-6);
  });
});

describe('mannWhitneyTest — external oracle (exact U statistic)', () => {
  it('[1,2,3] vs [4,5,6] fully separated: U = 0', async () => {
    // Ranks 1,2,3 vs 4,5,6 ⇒ R₁=6, U₁ = 6 − n₁(n₁+1)/2 = 0, U = min(U₁, n₁n₂−U₁) = 0.
    const r = await mannWhitneyTest([1, 2, 3], [4, 5, 6]);
    expectClose(r.uStatistic, 0, 1e-9);
    // Default p is the deterministic normal approximation 2·Φ((U−μ)/σ) with
    // μ=4.5, σ=√5.25 ⇒ z≈−1.964; since Φ(1.96)=0.975, the two-tailed p sits just
    // under 0.05.  Bracket it (externally grounded, robust to the approximation).
    expect(r.pValue).toBeGreaterThan(0.04);
    expect(r.pValue).toBeLessThan(0.055);
  });
});

describe('principalComponentAnalysis — external oracle (known covariance spectrum)', () => {
  it('diagonal covariance eigenvalues (16/3, 4/3) ⇒ explained [0.8, 0.2], axis-aligned PCs', () => {
    // Two orthogonal, mean-zero columns: col1=[2,−2,2,−2] (sample var 16/3),
    // col2=[1,1,−1,−1] (sample var 4/3), sample covariance 0. So the covariance
    // matrix is diag(16/3, 4/3); trace 20/3; explained ratios 0.8 and 0.2.
    const data = [
      [2, 1],
      [-2, 1],
      [2, -1],
      [-2, -1],
    ];
    const r = principalComponentAnalysis(data);
    expectClose(r.explained[0], 0.8, 1e-6);
    expectClose(r.explained[1], 0.2, 1e-6);
    // First PC aligns with the high-variance axis (col 1); second with col 2.
    // Eigenvectors are sign-ambiguous, so compare magnitudes.
    expect(Math.abs(r.components[0][0])).toBeCloseTo(1, 5);
    expect(Math.abs(r.components[0][1])).toBeCloseTo(0, 5);
    expect(Math.abs(r.components[1][1])).toBeCloseTo(1, 5);
    expect(Math.abs(r.components[1][0])).toBeCloseTo(0, 5);
  });
});

describe('kolmogorovSmirnovTest — external oracle (exact D statistic vs uniform CDF)', () => {
  // One-sample KS D = maxᵢ( |（i+1)/n − F(xᵢ)|, |F(xᵢ) − i/n| ). With the uniform
  // CDF F(x)=x the statistic is an exact rational, hand-derived and independently
  // verified. (The empirical/asymptotic p-value is separate; the D statistic is the
  // deterministic quantity the audit's SELF-REF concern was about.)
  it('sample [0.1,0.5,0.9] vs uniform: D = 7/30', async () => {
    const r = await kolmogorovSmirnovTest([0.1, 0.5, 0.9], (x) => x);
    expectClose(r.statistic, 7 / 30, 1e-9);
  });

  it('sample [0.2,0.4,0.6,0.8] vs uniform: D = 0.2', async () => {
    const r = await kolmogorovSmirnovTest([0.2, 0.4, 0.6, 0.8], (x) => x);
    expectClose(r.statistic, 0.2, 1e-9);
  });
});

describe('shapiroWilkTest — invariance + discrimination oracle', () => {
  // The W statistic uses an approximation (Blom order-statistic coefficients) so
  // it does not match SciPy's Royston AS-R94 to many digits — but it obeys exact,
  // implementation-independent invariances (W subtracts the mean and divides by S²,
  // so location cancels and scale cancels between the b² numerator and the S²
  // denominator; the antisymmetric coefficients make it reflection-invariant).
  const W = async (x: number[]): Promise<number> =>
    ((await shapiroWilkTest(x)) as { statistic: number }).statistic;

  it('scale + location invariant: W(x) = W(a·x + b) for a > 0', async () => {
    const x = [2, 3, 5, 7, 11, 13, 17];
    expectClose(await W(x), await W(x.map((v) => 3 * v + 10)), 1e-9);
  });

  it('reflection invariant: W(x) = W(−x)', async () => {
    const x = [2, 3, 5, 7, 11, 13, 17];
    expectClose(await W(x), await W(x.map((v) => -v)), 1e-9);
  });

  it('range (0, 1] and discriminates near-normal from a heavy outlier', async () => {
    const linear = await W([1, 2, 3, 4, 5, 6, 7]); // ~evenly spaced ⇒ near-normal
    const outlier = await W([1, 2, 3, 4, 5, 6, 100]); // one extreme value
    expect(linear).toBeGreaterThan(0);
    expect(linear).toBeLessThanOrEqual(1);
    expect(linear).toBeGreaterThan(0.95); // near-linear ⇒ W close to 1
    expect(outlier).toBeLessThan(0.6); // heavy departure ⇒ low W
    expect(linear).toBeGreaterThan(outlier);
  });
});
