/**
 * The stable reduction primitives, against exact references.
 * Reference: NumPy 2.3.4 gives relErr 2.9e-16 on sum(1e6 x 0.1); naive gives 1.3e-11.
 */
import { describe, it, expect } from 'vitest';
import { pairwiseSum, neumaierSum, norm2 } from '../src/numeric/stable.js';

const naive = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('pairwiseSum', () => {
  it('beats naive accumulation by orders of magnitude on 1e6 x 0.1', () => {
    const xs = new Array<number>(1_000_000).fill(0.1);
    const errPair = Math.abs(pairwiseSum(xs) - 100_000) / 100_000;
    const errNaive = Math.abs(naive(xs) - 100_000) / 100_000;
    console.log(
      `[stable] pairwise ${errPair.toExponential(2)} vs naive ${errNaive.toExponential(2)}`
    );
    expect(errPair).toBeLessThan(1e-14);
    expect(errPair).toBeLessThan(errNaive / 100); // decisively better, not marginally
  });

  it('is exact on small inputs and handles every length (block boundaries)', () => {
    expect(pairwiseSum([])).toBe(0);
    expect(pairwiseSum([1.5])).toBe(1.5);
    // Lengths straddling the 128-block boundary and the 8-wide unroll tail.
    for (const n of [7, 8, 9, 127, 128, 129, 255, 256, 257, 1000]) {
      const xs = Array.from({ length: n }, (_, i) => i + 1);
      expect(pairwiseSum(xs), `n=${n}`).toBe((n * (n + 1)) / 2);
    }
  });

  it('respects start/end bounds', () => {
    const xs = [100, 1, 2, 3, 100];
    expect(pairwiseSum(xs, 1, 4)).toBe(6);
  });
});

describe('neumaierSum', () => {
  it('recovers a value that naive AND pairwise AND np.sum all annihilate', () => {
    // np.sum([1e16, 1, -1e16]) === 0.0; math.fsum === 1.0
    expect(neumaierSum([1e16, 1, -1e16])).toBe(1);
    expect(pairwiseSum([1e16, 1, -1e16])).toBe(0); // documents the limit of pairwise
  });

  it('is exact on 1e6 x 0.1', () => {
    expect(neumaierSum(new Array<number>(1_000_000).fill(0.1))).toBe(100_000);
  });
});

describe('norm2', () => {
  it('does not overflow where NumPy does (np.linalg.norm([1e200]*4) === inf)', () => {
    expect(norm2([1e200, 1e200, 1e200, 1e200])).toBe(2e200);
  });

  it('does not underflow to zero', () => {
    expect(norm2([1e-200, 1e-200, 1e-200, 1e-200])).toBe(2e-200);
  });

  it('agrees with sqrt(sum of squares) in the safe range', () => {
    const xs = [3, 4];
    expect(norm2(xs)).toBe(5);
    const ys = [1, 2, 3, 4, 5];
    expect(norm2(ys)).toBeCloseTo(Math.sqrt(55), 12);
  });

  it('handles zeros, empties, and NaN', () => {
    expect(norm2([])).toBe(0);
    expect(norm2([0, 0])).toBe(0);
    expect(norm2([0, 3, 0, 4])).toBe(5);
    expect(Number.isNaN(norm2([1, NaN]))).toBe(true);
  });
});
