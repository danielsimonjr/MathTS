import { describe, it, expect } from 'vitest';
import { mad, parallelStatMAD, parallelStatMeanAD, typedStatistics } from '../src/index.js';

/**
 * Oracle for [1, 2, 3, 4, 5] (odd length so median AD ≠ mean AD):
 * median = 3; |xᵢ − 3| = [2, 1, 0, 1, 2]; median of those = 1.
 * mean = 3; mean of |xᵢ − mean| = 6/5 = 1.2.
 */
const ODD = [1, 2, 3, 4, 5];

/**
 * Even-length oracle [1, 2, 3, 10] (not [1,2,3,4], where both definitions equal 1):
 * even median = (2+3)/2 = 2.5; |xᵢ − 2.5| = [1.5, 0.5, 0.5, 7.5];
 * median of those = (0.5+1.5)/2 = 1.
 * mean = 4; mean of |xᵢ − 4| = (3+2+1+6)/4 = 3.
 */
const EVEN = [1, 2, 3, 10];

describe('mad vs parallelStatMAD (median AD vs mean AD)', () => {
  it('factory mad is median absolute deviation', () => {
    expect(mad(ODD)).toBe(1);
  });

  it('parallelStatMAD is mean absolute deviation', async () => {
    expect(await parallelStatMAD(ODD)).toBeCloseTo(1.2, 10);
  });

  it('parallelStatMeanAD is an alias of parallelStatMAD', () => {
    expect(parallelStatMeanAD).toBe(parallelStatMAD);
    expect(typedStatistics.mad).toBe(parallelStatMAD);
    expect(typedStatistics.meanAD).toBe(parallelStatMeanAD);
  });

  it('even-length sample distinguishes median AD from mean AD', async () => {
    expect(mad(EVEN)).toBe(1);
    expect(await parallelStatMAD(EVEN)).toBeCloseTo(3, 10);
    expect(await parallelStatMeanAD(EVEN)).toBeCloseTo(3, 10);
  });

  it('empty mad throws; empty parallelStatMAD is NaN', async () => {
    expect(() => mad([])).toThrow(/empty array/i);
    expect(Number.isNaN(await parallelStatMAD([]))).toBe(true);
  });
});
