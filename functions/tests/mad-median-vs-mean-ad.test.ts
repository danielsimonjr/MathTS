import { describe, it, expect } from 'vitest';
import { mad, parallelStatMAD, parallelStatMeanAD } from '../src/index.js';

/**
 * Oracle for [1, 2, 3, 4, 5] (odd length so median AD ≠ mean AD):
 * median = 3; |xᵢ − 3| = [2, 1, 0, 1, 2]; median of those = 1.
 * mean = 3; mean of |xᵢ − mean| = 6/5 = 1.2.
 */
const SAMPLE = [1, 2, 3, 4, 5];

describe('mad vs parallelStatMAD (median AD vs mean AD)', () => {
  it('factory mad is median absolute deviation', () => {
    expect(mad(SAMPLE)).toBe(1);
  });

  it('parallelStatMAD is mean absolute deviation', async () => {
    expect(await parallelStatMAD(SAMPLE)).toBeCloseTo(1.2, 10);
  });

  it('parallelStatMeanAD is an alias of parallelStatMAD', () => {
    expect(parallelStatMeanAD).toBe(parallelStatMAD);
  });

  it('empty mad throws; empty parallelStatMAD is NaN', async () => {
    expect(() => mad([])).toThrow(/empty array/i);
    expect(Number.isNaN(await parallelStatMAD([]))).toBe(true);
  });
});
