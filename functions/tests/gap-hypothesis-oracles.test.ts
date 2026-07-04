import { describe, it, expect } from 'vitest';
import {
  studentTTest,
  chiSquareTest,
  anova,
  mannWhitneyTest,
  kolmogorovSmirnovTest,
  principalComponentAnalysis,
} from '@danielsimonjr/mathts-functions';

/**
 * WS-1 P2 — closed-form oracle pins for the hypothesis tests + PCA that the
 * oracle-coverage matrix listed as SELF-REF (their statistics were only checked for
 * sign / range / directional p-value — a systematically-wrong statistic passed).
 *
 * Each test statistic below is computed by hand from its definition on a tiny fixed
 * dataset, independent of the implementation:
 *   - one-sample t of {1..5} vs μ=0: t = mean / (s/√n) = 3 / (√2.5/√5) = 3√2.
 *   - χ² goodness-of-fit {10,20,30,40} vs uniform 25: Σ(o−e)²/e = 500/25 = 20.
 *   - one-way ANOVA of {1,2,3},{4,5,6},{7,8,9}: SSB/df=54/2=27, SSW/df=6/6=1 → F=27.
 *   - Mann-Whitney {1,2,3} vs {4,5,6}: group 1 entirely below group 2 → U=0.
 *   - one-sample KS {0.1,0.5,0.9} vs Uniform(0,1): D = 1/3 − 0.1 = 7/30.
 *   - PCA of the collinear points (1,1),(2,2),(3,3): first PC = (1,1)/√2, 100% variance.
 * See [[feedback-oracle-tests-implementation-independent]].
 */

describe('studentTTest — one-sample t (exact)', () => {
  const r = studentTTest([1, 2, 3, 4, 5]);
  it('t = 3√2 on {1..5} vs μ=0', () => expect(r.statistic).toBeCloseTo(3 * Math.SQRT2, 10));
  it('df = n − 1 = 4', () => expect(r.degreesOfFreedom).toBe(4));
});

describe('chiSquareTest — goodness of fit (exact)', () => {
  it('χ² = 20, df = 3 for {10,20,30,40} vs uniform 25', async () => {
    const r = await chiSquareTest([10, 20, 30, 40], [25, 25, 25, 25]);
    expect(r.statistic).toBeCloseTo(20, 10);
    expect(r.degreesOfFreedom).toBe(3);
  });
});

describe('anova — one-way F (exact)', () => {
  const r = anova([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]);
  it('F = 27 (MSB 27 / MSW 1)', () => expect(r.fStatistic).toBeCloseTo(27, 10));
  it('df = (2, 6)', () => {
    expect(r.dfBetween).toBe(2);
    expect(r.dfWithin).toBe(6);
  });
});

describe('mannWhitneyTest — U statistic (exact)', () => {
  it('U = 0 when {1,2,3} lies entirely below {4,5,6}', async () => {
    const r = await mannWhitneyTest([1, 2, 3], [4, 5, 6]);
    expect(r.uStatistic).toBe(0);
  });
});

describe('kolmogorovSmirnovTest — D statistic (exact)', () => {
  it('D = 7/30 for {0.1,0.5,0.9} vs Uniform(0,1)', async () => {
    const r = await kolmogorovSmirnovTest([0.1, 0.5, 0.9], (x) => x);
    expect(r.statistic).toBeCloseTo(7 / 30, 12);
  });
  it('D = 0.5 for {0} vs standard normal (Φ(0)=½)', async () => {
    const r = await kolmogorovSmirnovTest([0]);
    expect(r.statistic).toBeCloseTo(0.5, 12);
  });
  it('rejects a non-function CDF with a clear error (not "cdf is not a function")', async () => {
    await expect(
      kolmogorovSmirnovTest([1, 2, 3], [1, 2, 3] as unknown as (x: number) => number)
    ).rejects.toThrow(/must be a CDF function/);
  });
});

describe('principalComponentAnalysis — collinear data (exact)', () => {
  const r = principalComponentAnalysis([
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  it('first component is the (1,1)/√2 direction', () => {
    expect(Math.abs(r.components[0][0])).toBeCloseTo(Math.SQRT1_2, 10);
    expect(Math.abs(r.components[0][1])).toBeCloseTo(Math.SQRT1_2, 10);
  });
  it('first component explains ~100% of the variance', () => {
    expect(r.explained[0]).toBeCloseTo(1, 10);
  });
});
