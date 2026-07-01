import { describe, it, expect } from 'vitest';
import {
  gmean,
  hmean,
  zscore,
  skewness,
  kurtosis,
  cov,
  logsumexp,
  softmax,
  cumtrapz,
  fTest,
  jarqueBera,
  kruskalWallis,
  wilcoxon,
  tukeyHSD,
  studentizedRangeCDF,
  studentizedRangeQuantile,
  companion,
  slerp,
  quaternionNormalize,
} from '@danielsimonjr/mathts-functions';

/**
 * Degenerate / invalid-input hardening for the 2026-06-30 domain gap-closure
 * functions. A retroactive code-review + silent-failure audit (7 reviewers)
 * found these functions silently returned NaN/Infinity/garbage on structurally
 * invalid or statistically degenerate input instead of failing loudly. Policy:
 * throw a clear Error, matching the scipy/numpy semantics the docstrings claim.
 *
 * Each describe block corresponds to one atomic hardening commit.
 */

describe('descriptive-stats — degenerate input guards', () => {
  it('gmean throws on non-positive entries; empty stays graceful NaN', () => {
    expect(() => gmean([1, 0, 3])).toThrow(/> 0/);
    expect(() => gmean([1, -2, 3])).toThrow(/> 0/);
    expect(gmean([])).toBeNaN(); // empty is undefined, not an error (numpy parity)
    // happy path still works
    expect(gmean([1, 4, 16])).toBeCloseTo(4, 10);
  });

  it('hmean throws on non-positive entries; empty stays graceful NaN', () => {
    expect(() => hmean([2, 0, 4])).toThrow(/> 0/);
    expect(() => hmean([2, -1, 4])).toThrow(/> 0/);
    expect(hmean([])).toBeNaN();
    expect(hmean([1, 2, 4])).toBeCloseTo(12 / 7, 10);
  });

  it('zscore throws on constant (zero-std); empty stays graceful []', () => {
    expect(() => zscore([5, 5, 5])).toThrow(/standard deviation is zero|constant/i);
    expect(zscore([])).toEqual([]);
    const z = zscore([1, 2, 3]);
    expect(z[0]).toBeCloseTo(-1.2247448713915889, 10);
  });

  it('skewness throws on constant input; returns NaN for bias-corrected small n', () => {
    expect(() => skewness([7, 7, 7, 7])).toThrow(/variance is zero|constant/i);
    expect(skewness([])).toBeNaN(); // empty stays graceful
    expect(skewness([1, 2], { bias: false })).toBeNaN(); // n <= 2, correction undefined
    expect(skewness([2, 8, 0, 4, 1, 9, 9, 0])).toBeCloseTo(0.2650554122698573, 8);
  });

  it('kurtosis throws on constant input; returns NaN for bias-corrected small n', () => {
    expect(() => kurtosis([3, 3, 3, 3, 3])).toThrow(/variance is zero|constant/i);
    expect(kurtosis([])).toBeNaN(); // empty stays graceful
    expect(kurtosis([1, 2, 3], { bias: false })).toBeNaN(); // n <= 3, correction undefined
    expect(kurtosis([1, 2, 3, 4, 5])).toBeCloseTo(-1.3, 8);
  });

  it('cov throws when observations do not exceed ddof', () => {
    expect(() => cov([1], [2])).toThrow(/ddof|observations/i); // n=1, ddof=1
    expect(() => cov([[1, 2]])).toThrow(/ddof|observations/i); // 1 observation, ddof=1
    // happy path (sample covariance) still works
    expect(cov([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });
});

describe('numeric-extra — scaling / length guards', () => {
  it('logsumexp handles very large vectors without RangeError (spread-free max)', () => {
    // Math.max(...arr) on a 1e6-element array throws "Maximum call stack size
    // exceeded" — these functions exist precisely for large log-prob vectors.
    const n = 1_000_000;
    const big = new Array(n).fill(0);
    expect(logsumexp(big)).toBeCloseTo(Math.log(n), 6);
  });

  it('softmax handles very large vectors without RangeError', () => {
    const n = 1_000_000;
    const big = new Array(n).fill(0);
    const s = softmax(big);
    expect(s.length).toBe(n);
    expect(s[0]).toBeCloseTo(1 / n, 12);
  });

  it('cumtrapz throws when the abscissa array is shorter than y', () => {
    expect(() => cumtrapz([1, 2, 3, 4], [0, 1])).toThrow(/length|abscissa|x\b/i);
    // happy path (unit and explicit spacing) still works
    expect(cumtrapz([1, 2, 3], [0, 1, 2])).toEqual([0, 1.5, 4]);
  });
});

describe('hypothesis-extra — degenerate input guards', () => {
  it('fTest throws on <2 observations or a zero-variance denominator', () => {
    expect(() => fTest([1], [1, 2, 3])).toThrow(/at least 2|2 observations/i);
    expect(() => fTest([1, 2, 3], [5, 5, 5])).toThrow(/zero variance/i);
    expect(fTest([1, 2, 3, 4], [2, 4, 6, 8]).pValue).toBeGreaterThan(0); // happy path
  });

  it('jarqueBera throws on <2 observations', () => {
    expect(() => jarqueBera([1])).toThrow(/at least 2|observations/i);
  });

  it('kruskalWallis throws on fewer than 2 non-empty groups', () => {
    expect(() => kruskalWallis([1, 2, 3])).toThrow(/2 .*groups|at least 2/i);
    expect(() => kruskalWallis([1, 2], [])).toThrow(/2 .*groups|at least 2/i);
    expect(kruskalWallis([1, 2, 3], [4, 5, 6]).df).toBe(1); // happy path
  });

  it('wilcoxon throws on unequal-length pairs and all-zero differences', () => {
    expect(() => wilcoxon([1, 2, 3], [1, 2])).toThrow(/equal length|length/i);
    expect(() => wilcoxon([3, 3, 3], [3, 3, 3])).toThrow(/differences are zero|zero/i);
  });

  it('tukeyHSD throws on <2 groups or non-positive residual df', () => {
    expect(() => tukeyHSD([[1, 2, 3]])).toThrow(/2 groups|at least 2/i);
    expect(() => tukeyHSD([[1], [2], [3]])).toThrow(/residual df|df/i); // N=3,k=3,dfErr=0
  });

  it('studentizedRangeQuantile validates p in (0,1) and still inverts the CDF', () => {
    expect(() => studentizedRangeQuantile(0, 4, 20)).toThrow(/\(0, 1\)|p must/i);
    expect(() => studentizedRangeQuantile(1, 4, 20)).toThrow(/\(0, 1\)|p must/i);
    expect(() => studentizedRangeQuantile(1.5, 4, 20)).toThrow(/\(0, 1\)|p must/i);
    expect(studentizedRangeQuantile(0.95, 4, 20)).toBeCloseTo(3.9582935609453833, 3);
  });

  it('studentizedRangeCDF validates k>=2 and df>0', () => {
    expect(() => studentizedRangeCDF(3, 1, 20)).toThrow(/k .*2|groups/i);
    expect(() => studentizedRangeCDF(3, 4, 0)).toThrow(/df/i);
  });
});

describe('linalg-extra — degenerate input guards', () => {
  it('companion throws on a zero leading coefficient', () => {
    expect(() => companion([0, 1, 2])).toThrow(/leading coefficient|nonzero/i);
    // happy path: monic-normalization still works
    expect(companion([2, -4, 2])).toEqual([
      [2, -1],
      [1, 0],
    ]);
  });
});

describe('geometry-extra — degenerate input guards', () => {
  it('slerp throws on zero-length input and on antipodal directions', () => {
    expect(() => slerp([0, 0, 0], [1, 0, 0], 0.5)).toThrow(/non-zero|zero/i);
    expect(() => slerp([1, 0, 0], [0, 0, 0], 0.5)).toThrow(/non-zero|zero/i);
    expect(() => slerp([1, 0, 0], [-1, 0, 0], 0.5)).toThrow(/antipodal/i);
    // happy path: orthogonal directions interpolate on the great circle
    const r = slerp([1, 0, 0], [0, 1, 0], 0.5);
    expect(r[0]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(r[1]).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('quaternionNormalize throws on a zero-magnitude quaternion', () => {
    expect(() => quaternionNormalize([0, 0, 0, 0])).toThrow(/zero-magnitude|zero/i);
    expect(quaternionNormalize([1, 1, 1, 1])[0]).toBeCloseTo(0.5, 10);
  });
});
