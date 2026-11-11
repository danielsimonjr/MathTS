/**
 * Dogfood relay G09 — studentTTest popmean (#766).
 *
 * Oracles are scipy.stats.ttest_1samp / ttest_ind(equal_var=False) / ttest_rel
 * (SciPy 1.18). The test is two-sided only; there is no alternative argument.
 */
import { describe, it, expect } from 'vitest';
import { studentTTest, studentTTestPaired } from '../src/typed/hypothesis.js';

const ABS = 1e-12;

function expectAbs(actual: number, expected: number, tol = ABS): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

describe('G09 #766 studentTTest popmean', () => {
  it('exact issue repro: ttest_1samp([1..10], 5.5)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = studentTTest(x, 5.5);
    expectAbs(result.statistic, 0);
    expectAbs(result.pValue, 1);
    expect(result.degreesOfFreedom).toBe(9);
    expect(Number.isNaN(result.statistic)).toBe(false);
  });

  it('Float64Array sample honors popmean', () => {
    // The published parameter type is number[]; indexed access accepts a typed array at runtime.
    const x = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) as unknown as number[];
    const result = studentTTest(x, 5.5);
    expectAbs(result.statistic, 0);
    expectAbs(result.pValue, 1);
    expect(result.degreesOfFreedom).toBe(9);
  });

  it('one-sample vs 0 unchanged, and explicit 0 / null match the default', () => {
    const sample = [1, 2, 3, 4, 5];
    const omitted = studentTTest(sample);
    const explicit = studentTTest(sample, 0);
    const asNull = studentTTest(sample, null);
    // scipy.stats.ttest_1samp([1,2,3,4,5], 0)
    expectAbs(omitted.statistic, 4.242640687119285);
    expectAbs(omitted.pValue, 0.01323559956368269);
    expect(omitted.degreesOfFreedom).toBe(4);
    expect(explicit).toEqual(omitted);
    expect(asNull).toEqual(omitted);
    expect(studentTTest(sample, -0)).toEqual(omitted);
  });

  it('SciPy parity at several popmeans (two-sided)', () => {
    // ttest_1samp([1,2,3,4,5], 2): statistic = √2, p = 0.2301996410804989, df = 4
    const above = studentTTest([1, 2, 3, 4, 5], 2);
    expectAbs(above.statistic, Math.SQRT2);
    expectAbs(above.pValue, 0.2301996410804989);
    expect(above.degreesOfFreedom).toBe(4);

    // same |t| on the other side of the mean
    const below = studentTTest([1, 2, 3, 4, 5], 4);
    expectAbs(below.statistic, -Math.SQRT2);
    expectAbs(below.pValue, 0.2301996410804989);
    expect(below.degreesOfFreedom).toBe(4);

    // ttest_1samp([-2,-1,0,1,2], -0.5)
    const shifted = studentTTest([-2, -1, 0, 1, 2], -0.5);
    expectAbs(shifted.statistic, 0.7071067811865475);
    expectAbs(shifted.pValue, 0.5185185185185185);
    expect(shifted.degreesOfFreedom).toBe(4);

    // ttest_1samp([1..10], 4)
    const ten = studentTTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expectAbs(ten.statistic, 1.5666989036012806);
    expectAbs(ten.pValue, 0.15162747448768263);
    expect(ten.degreesOfFreedom).toBe(9);

    // far from the sample: tiny two-sided p, still finite
    const far = studentTTest([1, 2, 3, 4, 5], 100);
    expectAbs(far.statistic, -137.17871555019022, 1e-9);
    expectAbs(far.pValue, 1.693754569313269e-8, 1e-15);
    expect(far.degreesOfFreedom).toBe(4);
  });

  it('SciPy parity: popmean equals sample mean → p=1', () => {
    const result = studentTTest([2, 4, 6, 8], 5);
    expectAbs(result.statistic, 0);
    expectAbs(result.pValue, 1);
    expect(result.degreesOfFreedom).toBe(3);
  });

  it('two-sample Welch is unchanged for arrays and typed arrays', () => {
    // scipy.stats.ttest_ind([1,2,3], [4,5,6], equal_var=False)
    const result = studentTTest([1, 2, 3], [4, 5, 6]);
    expectAbs(result.statistic, -3.6742346141747673);
    expectAbs(result.pValue, 0.021311641128756713);
    expectAbs(result.degreesOfFreedom, 4);

    const typed = studentTTest(
      new Float64Array([1, 2, 3]) as unknown as number[],
      new Float64Array([4, 5, 6]) as unknown as number[]
    );
    expect(typed).toEqual(result);

    // a length-1 array is still a sample, not a popmean
    expect(() => studentTTest([1, 2, 3], [9])).toThrow(/sample2/);
  });

  it('paired t-test is unaffected by the popmean overload', () => {
    // scipy.stats.ttest_rel([1,2,3], [1,2,4])
    const paired = studentTTestPaired([1, 2, 3], [1, 2, 4]);
    expectAbs(paired.statistic, -1);
    expectAbs(paired.pValue, 0.4226497308103743);
    expect(paired.degreesOfFreedom).toBe(2);
    expect(() => studentTTestPaired([1, 2, 3], 0 as never)).toThrow(/same length/);
  });

  it('n < 2 throws before a popmean is applied', () => {
    expect(() => studentTTest([5], 5.5)).toThrow(/at least 2/);
    expect(() => studentTTest([], 0)).toThrow(/at least 2/);
  });

  it('zero variance: NaN when mean equals popmean, ±Inf and p=0 otherwise', () => {
    // scipy.stats.ttest_1samp([3,3,3,3], 3) → nan, nan, df 3
    const same = studentTTest([3, 3, 3, 3], 3);
    expect(Number.isNaN(same.statistic)).toBe(true);
    expect(Number.isNaN(same.pValue)).toBe(true);
    expect(same.degreesOfFreedom).toBe(3);

    // ttest_1samp([3,3,3,3], 0) → +inf, p=0, df 3
    const above = studentTTest([3, 3, 3, 3], 0);
    expect(above.statistic).toBe(Number.POSITIVE_INFINITY);
    expect(above.pValue).toBe(0);
    expect(above.degreesOfFreedom).toBe(3);

    const below = studentTTest([3, 3, 3, 3], 9);
    expect(below.statistic).toBe(Number.NEGATIVE_INFINITY);
    expect(below.pValue).toBe(0);
    expect(below.degreesOfFreedom).toBe(3);
  });

  it('non-finite sample values propagate to a NaN statistic (df stays n−1)', () => {
    const result = studentTTest([1, 2, Number.NaN, 4], 2);
    expect(Number.isNaN(result.statistic)).toBe(true);
    expect(Number.isNaN(result.pValue)).toBe(true);
    expect(result.degreesOfFreedom).toBe(3);
  });

  it('throws TypeError for non-finite popmean', () => {
    expect(() => studentTTest([1, 2, 3], Number.NaN)).toThrow(TypeError);
    expect(() => studentTTest([1, 2, 3], Number.POSITIVE_INFINITY)).toThrow(/popmean|finite/i);
    expect(() => studentTTest([1, 2, 3], Number.NEGATIVE_INFINITY)).toThrow(TypeError);
  });

  it('throws TypeError when second argument is not array or popmean', () => {
    expect(() => studentTTest([1, 2, 3], '5.5' as never)).toThrow(TypeError);
    expect(() => studentTTest([1, 2, 3], {} as never)).toThrow(TypeError);
    expect(() => studentTTest([1, 2, 3], { popmean: 5.5 } as never)).toThrow(TypeError);
  });
});
