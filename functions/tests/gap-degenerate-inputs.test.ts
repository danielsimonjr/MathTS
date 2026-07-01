import { describe, it, expect } from 'vitest';
import {
  gmean,
  hmean,
  zscore,
  skewness,
  kurtosis,
  cov,
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
