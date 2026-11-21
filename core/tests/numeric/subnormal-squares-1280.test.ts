/**
 * Dogfood #1280 - the exact power-of-2 scale for a statistic whose squares leave the range.
 *
 * `SQUARES_SAFE_MIN` is the smallest finite sum of squares that keeps all its digits.
 * `powerOfTwoBelow(max)` is the power of 2 `p` with `p <= max < 2 * p`.
 * `stdFromSquaredDeviations` is the root of a sum of squared deviations: the plain root when the
 * sum keeps its digits, else the root of the sum for data divided by an exact power of 2.
 * `scaleForVariance` and `divideByScale` give the scale of the statistics that square a variance.
 */
import { describe, expect, it } from 'vitest';
import {
  squareSumsKeepDigits,
  SQUARES_SAFE_MIN,
  divideByScale,
  powerOfTwoBelow,
  scaleForVariance,
  stdFromSquaredDeviations,
  sumSquaredDeviations,
} from '../../src/index.js';

const EPS4 = 4 * Number.EPSILON;
const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

describe('SQUARES_SAFE_MIN', () => {
  it('is 2^-800 (the value that #1104 uses in three places)', () => {
    expect(SQUARES_SAFE_MIN).toBe(2 ** -800);
  });
});

describe('powerOfTwoBelow', () => {
  it.each([
    [5e-324, 5e-324],
    [2 ** -1074, 2 ** -1074],
    [2 ** -1022, 2 ** -1022],
    [1 - 2 ** -53, 0.5],
    [1, 1],
    [3, 2],
    [2 ** -400 - 2 ** -453, 2 ** -401],
    [Number.MAX_VALUE, 2 ** 1023],
  ])('powerOfTwoBelow(%s) is %s', (max, expected) => {
    expect(powerOfTwoBelow(max)).toBe(expected);
  });
});

describe('stdFromSquaredDeviations', () => {
  it('ordinary data: the plain root, same bits', () => {
    const xs = [2, 4, 6, 8];
    const m2 = sumSquaredDeviations(xs);
    expect(stdFromSquaredDeviations(xs, m2, 3)).toBe(Math.sqrt(m2 / 3));
  });
  it('subnormal squares: exact to EPS4 (5.6e-6 relative error with the plain root)', () => {
    const xs = [1e-160, 3e-160];
    const r = stdFromSquaredDeviations(xs, sumSquaredDeviations(xs), 1);
    expect(rel(r, Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
  });
  it('overflowing squares (Infinity with the plain root)', () => {
    const xs = [1e200, 3e200];
    const r = stdFromSquaredDeviations(xs, sumSquaredDeviations(xs), 1);
    expect(rel(r, Math.SQRT2 * 1e200)).toBeLessThan(EPS4);
  });
  it('constant data: an exact 0', () => {
    const xs = new Array<number>(7).fill(1e-200);
    expect(stdFromSquaredDeviations(xs, sumSquaredDeviations(xs), 6)).toBe(0);
  });
  it('a NaN element: NaN. An infinite element: the plain value', () => {
    const withNaN = [1e-160, NaN, 3e-160];
    expect(stdFromSquaredDeviations(withNaN, sumSquaredDeviations(withNaN), 2)).toBeNaN();
    const withInf = [1, Infinity];
    const m2 = sumSquaredDeviations(withInf);
    expect(stdFromSquaredDeviations(withInf, m2, 1)).toBe(Math.sqrt(m2 / 1));
  });
});

describe('scaleForVariance and divideByScale', () => {
  it('a variance inside [2^-400, 2^400]: scale 1', () => {
    expect(scaleForVariance(2 ** -400, [1e-60])).toBe(1);
    expect(scaleForVariance(2 ** 400, [1e60])).toBe(1);
    expect(scaleForVariance(3, [1, 2, 3])).toBe(1);
  });
  it('a variance outside the window: the power of 2 below the largest absolute value of all arrays', () => {
    expect(scaleForVariance(2 ** -1000, [3 * 2 ** -535], [-5 * 2 ** -536])).toBe(2 ** -534);
    expect(scaleForVariance(Infinity, [3 * 2 ** 600])).toBe(2 ** 601);
    expect(scaleForVariance(2 ** -420, [2 ** -210])).toBe(2 ** -210);
  });
  it('a variance of 0 can be an underflowed sum: the data gets its scale', () => {
    expect(scaleForVariance(0, [3 * 2 ** -570, 2 ** -571])).toBe(2 ** -569);
  });
  it('a value that is not finite, or data that is all 0: scale 1 (nothing to scale)', () => {
    expect(scaleForVariance(NaN, [1e-300, NaN])).toBe(1);
    expect(scaleForVariance(Infinity, [1, Infinity])).toBe(1);
    expect(scaleForVariance(2 ** -1000, [0, 0])).toBe(1);
  });
  it('divideByScale divides each element exactly and returns a new array', () => {
    const xs = [3 * 2 ** -535, 2 ** -536];
    const out = divideByScale(xs, 2 ** -535);
    expect(out).toEqual([3, 0.5]);
    expect(out).not.toBe(xs);
    expect(divideByScale(new Float64Array([4, 8]), 4)).toEqual([1, 2]);
  });
});

describe('squareSumsKeepDigits: the one test of the correlation and regression sums', () => {
  it('is true for sums of order 1', () => {
    expect(squareSumsKeepDigits(2, 3)).toBe(true);
    expect(squareSumsKeepDigits(SQUARES_SAFE_MIN, 1)).toBe(true);
  });
  it('is false for a sum that can hold subnormal squares', () => {
    expect(squareSumsKeepDigits(SQUARES_SAFE_MIN / 2, 2 ** 900)).toBe(false);
    expect(squareSumsKeepDigits(0, 1)).toBe(false);
  });
  it('is false for a product outside the normal range', () => {
    expect(squareSumsKeepDigits(2 ** -700, 2 ** -700)).toBe(false);
    expect(squareSumsKeepDigits(2 ** 600, 2 ** 600)).toBe(false);
    expect(squareSumsKeepDigits(2 ** -511, 2 ** -511)).toBe(true);
    expect(squareSumsKeepDigits(2 ** -511, 2 ** -512)).toBe(false);
  });
  it('is false for NaN and for an infinite sum', () => {
    expect(squareSumsKeepDigits(NaN, 1)).toBe(false);
    expect(squareSumsKeepDigits(Infinity, 1)).toBe(false);
  });
});
