import { describe, it, expect } from 'vitest';
import * as stats from '../src/index.js';

/**
 * @danielsimonjr/mathts-statistics is a curated re-export of the
 * statistics/probability surface from `@danielsimonjr/mathts-functions`.
 * Numerical correctness is covered by the functions package's oracle-pinned
 * suites; these tests assert the full surface is present and wired, and
 * spot-check a value through this package's entry point.
 */
const s = stats as unknown as Record<string, unknown>;

describe('@danielsimonjr/mathts-statistics surface', () => {
  it('exposes descriptive statistics', () => {
    for (const fn of [
      'mean',
      'median',
      'variance',
      'std',
      'quantileSeq',
      'mad',
      'iqr',
      'sem',
      'zscore',
      'skewness',
      'kurtosis',
      'gmean',
      'hmean',
      'cov',
      'corr',
      'corrcoef',
      'rankdata',
      'spearman',
      'kendallTau',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });

  it('exposes parallel-first reductions & selection', () => {
    for (const fn of [
      'parallelStatMean',
      'parallelStatVariance',
      'parallelStatStd',
      'parallelStatQuantile',
      'parallelStatHistogram',
      'quickSelect',
      'medianSelect',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });

  it('exposes all 14 distribution objects', () => {
    for (const fn of [
      'normalDist',
      'betaDist',
      'binomialDist',
      'chiSquaredDist',
      'exponentialDist',
      'fDist',
      'gammaDist',
      'logNormalDist',
      'poissonDist',
      'tDist',
      'uniformDist',
      'weibullDist',
      'hypergeometricDist',
      'negativeBinomialDist',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });

  it('exposes the hypothesis-test suite', () => {
    for (const fn of [
      'studentTTest',
      'studentTTestPaired',
      'anova',
      'chiSquareTest',
      'kolmogorovSmirnovTest',
      'kolmogorovSmirnov2Test',
      'mannWhitneyTest',
      'shapiroWilkTest',
      'leveneTest',
      'bartlettTest',
      'proportionZTest',
      'binomialTest',
      'fTest',
      'jarqueBera',
      'kruskalWallis',
      'wilcoxon',
      'fisherExact',
      'tukeyHSD',
      'principalComponentAnalysis',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });

  it('exposes probability & combinatorics', () => {
    for (const fn of [
      'combinations',
      'permutations',
      'multinomial',
      'factorial',
      'doubleFactorial',
      'risingFactorial',
      'fallingFactorial',
      'subfactorial',
      'bernoulli',
      'gamma',
      'lgamma',
      'kldivergence',
      'random',
      'randomInt',
      'pickRandom',
      'seedProbabilityRng',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });

  it('computes real values through the package entry point', () => {
    expect(
      (s.kendallTau as (a: number[], b: number[]) => number)([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])
    ).toBeCloseTo(0.6, 10);
    const h = (
      s.hypergeometricDist as (m: number, k: number, n: number) => { pdf: (x: number) => number }
    )(50, 5, 10);
    expect(h.pdf(1)).toBeCloseTo(0.4313371972, 9);
    expect((s.combinations as (n: number, k: number) => number)(10, 3)).toBe(120);
  });
});
