/**
 * Dogfood relay G09 — studentTTest popmean (#766).
 */
import { describe, it, expect } from 'vitest';
import { studentTTest } from '../src/typed/hypothesis.js';

describe('G09 #766 studentTTest popmean', () => {
  it('exact issue repro: ttest_1samp([1..10], 5.5)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = studentTTest(x, 5.5);
    expect(result.statistic).toBeCloseTo(0, 12);
    expect(result.pValue).toBeCloseTo(1, 12);
    expect(result.degreesOfFreedom).toBe(9);
    expect(Number.isNaN(result.statistic)).toBe(false);
  });

  it('one-sample vs 0 unchanged (SciPy ttest_1samp([1..5], 0))', () => {
    const result = studentTTest([1, 2, 3, 4, 5]);
    expect(result.statistic).toBeCloseTo(4.242640687119285, 10);
    expect(result.pValue).toBeCloseTo(0.01323559956368269, 10);
    expect(result.degreesOfFreedom).toBe(4);
  });

  it('SciPy parity: popmean 2 on [1..5]', () => {
    const result = studentTTest([1, 2, 3, 4, 5], 2);
    // scipy.stats.ttest_1samp([1,2,3,4,5], 2): statistic=√2, p≈0.125, df=4 (two-sided)
    expect(result.statistic).toBeCloseTo(Math.SQRT2, 10);
    expect(result.pValue).toBeCloseTo(0.23019964108049917, 10);
    expect(result.degreesOfFreedom).toBe(4);
  });

  it('SciPy parity: popmean equals sample mean → p=1', () => {
    const result = studentTTest([2, 4, 6, 8], 5);
    expect(result.statistic).toBeCloseTo(0, 12);
    expect(result.pValue).toBeCloseTo(1, 12);
    expect(result.degreesOfFreedom).toBe(3);
  });

  it('two-sample Welch unchanged when second arg is array', () => {
    const result = studentTTest([1, 2, 3], [4, 5, 6]);
    expect(Number.isFinite(result.statistic)).toBe(true);
    expect(result.pValue).toBeGreaterThan(0);
    expect(result.degreesOfFreedom).toBeGreaterThan(0);
  });

  it('throws TypeError for non-finite popmean', () => {
    expect(() => studentTTest([1, 2, 3], NaN)).toThrow(TypeError);
    expect(() => studentTTest([1, 2, 3], Infinity)).toThrow(/popmean|finite/i);
  });

  it('throws TypeError when second argument is not array or popmean', () => {
    expect(() => studentTTest([1, 2, 3], '5.5' as never)).toThrow(TypeError);
    expect(() => studentTTest([1, 2, 3], {} as never)).toThrow(TypeError);
  });
});
