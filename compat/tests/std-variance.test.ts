/**
 * mathjs parity: std/variance must default to 'unbiased' (sample, ÷(N-1)),
 * not the functions-package population default (÷N), and must accept a
 * normalization argument. Regression for the compat stats-default gap.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);

describe('compat std/variance — mathjs defaults', () => {
  it('std defaults to sample (unbiased)', () => {
    expect(math.std([2, 4, 6])).toBeCloseTo(2.0, 10);
  });

  it('variance defaults to sample (unbiased)', () => {
    expect(math.variance([2, 4, 6])).toBeCloseTo(4.0, 10);
  });

  it('accepts uncorrected (population) normalization', () => {
    expect(math.variance([2, 4, 6], 'uncorrected')).toBeCloseTo(2.6666666666666665, 10);
    expect(math.std([2, 4, 6], 'uncorrected')).toBeCloseTo(1.632993161855452, 10);
  });

  it('accepts biased normalization (÷(N+1))', () => {
    expect(math.variance([2, 4, 6], 'biased')).toBeCloseTo(8 / 4, 10);
  });

  it('single-element variance is 0 (no divide-by-zero)', () => {
    expect(math.variance([5])).toBe(0);
  });

  it('mean/sum/min/max remain unaffected', () => {
    expect(math.mean([1, 2, 3, 4])).toBe(2.5);
    expect(math.sum([1, 2, 3])).toBe(6);
    expect(math.min([3, 1, 2])).toBe(1);
    expect(math.max([3, 1, 2])).toBe(3);
  });
});
