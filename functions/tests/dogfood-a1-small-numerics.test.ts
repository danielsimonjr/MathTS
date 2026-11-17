/**
 * Dogfood a1: three small numeric defects.
 *
 * #1083 - `numberVector` read a number as `Array.from(5)`, which is `[]`. About 25 functions
 *         gave an empty result, NaN or a plausible wrong value for a number. They now throw a
 *         TypeError that names the function.
 * #1082 - `norm(A, 2)` of a matrix with a negative leading entry was the square of the
 *         spectral norm (the SVD was wrong). Oracle: NumPy 2.3.5 and mathjs 15.2.0.
 * #995  - The default `norm` of a matrix is the spectral norm (p = 2), as in mathjs.
 */
import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';
import { norm } from '../src/typed/arithmetic.js';
import { singularValues } from '../src/typed/matrix-ops.js';
import { numberVector } from '../src/typed/number-matrix.js';

const V = [1, 2, 3, 4, 5, 6];
const fn = (name: string): ((...a: unknown[]) => unknown) =>
  (F as unknown as Record<string, (...a: unknown[]) => unknown>)[name];

// Each entry calls the function with the scalar 5 in the data slot.
const SCALAR_FIRST: Array<[string, unknown[]]> = [
  ['zscore', [5]],
  ['rankdata', [5]],
  ['softmax', [5]],
  ['cumprod', [5]],
  ['cummax', [5]],
  ['cummin', [5]],
  ['cumtrapz', [5]],
  ['movingAverage', [5, 3]],
  ['detrend', [5]],
  ['vander', [5]],
  ['toeplitz', [5]],
  ['circulant', [5]],
  ['wiener', [5]],
  ['skewness', [5]],
  ['kurtosis', [5]],
  ['sem', [5]],
  ['ptp', [5]],
  ['trapz', [5]],
  ['signTest', [5]],
  ['kruskalWallis', [5, V, V]],
  ['lfilter', [5, V, V]],
];
const SCALAR_SECOND: Array<[string, unknown[]]> = [
  ['toeplitz', [V, 5]],
  ['bilinear', [V, 5, 2]],
  ['etaSquared', [[V, 5]]],
  ['moodMedianTest', [[V, 5]]],
  ['lfilter', [V, 5, V]],
  ['lfilter', [V, V, 5]],
];

describe('numberVector rejects a scalar (#1083)', () => {
  it.each([5, 0, null, undefined, true, {}])(
    'numberVector(%j) throws a TypeError with the name',
    (x) => {
      expect(() => numberVector('myFn', x as never)).toThrow(TypeError);
      expect(() => numberVector('myFn', x as never)).toThrow(/myFn/);
    }
  );
  it('still copies arrays, typed arrays and array-likes', () => {
    expect(numberVector('f', [1, 2])).toEqual([1, 2]);
    expect(numberVector('f', new Float64Array([1, 2]))).toEqual([1, 2]);
    expect(numberVector('f', { length: 2, 0: 7, 1: 8 })).toEqual([7, 8]);
    expect(numberVector('f', [])).toEqual([]);
  });
  it.each(SCALAR_FIRST)('%s(scalar) throws a TypeError that names it', (name, args) => {
    expect(() => fn(name)(...args)).toThrow(TypeError);
    expect(() => fn(name)(...args)).toThrow(new RegExp(name));
  });
  it.each(SCALAR_SECOND)('%s with a scalar in a later slot throws a TypeError', (name, args) => {
    expect(() => fn(name)(...args)).toThrow(TypeError);
    expect(() => fn(name)(...args)).toThrow(new RegExp(name));
  });
  it('keeps the result for array input', () => {
    expect(F.zscore([1, 2, 3])).toHaveLength(3);
    expect(F.trapz([1, 2, 3])).toBe(4);
    expect(F.skewness([1, 2, 3])).toBe(0);
  });
});

describe('norm of a matrix with a negative entry (#1082, #995)', () => {
  const A = [
    [-3, 0],
    [0, 1],
  ];
  it('the singular values of A are [3, 1] (NumPy)', () => {
    const sv = singularValues(A) as number[];
    expect(sv[0]).toBeCloseTo(3, 12);
    expect(sv[1]).toBeCloseTo(1, 12);
  });
  it('norm(A, 2) is 3', () => {
    expect(norm(A, 2)).toBeCloseTo(3, 12);
  });
  it('norm(A) uses p = 2 by default and is 3 (mathjs)', () => {
    expect(norm(A)).toBeCloseTo(3, 12);
  });
  it('norm(A, "fro") is sqrt(10)', () => {
    expect(norm(A, 'fro')).toBeCloseTo(Math.sqrt(10), 12);
  });
  it('norm(A, 1) and norm(A, Infinity) are 3', () => {
    expect(norm(A, 1)).toBe(3);
    expect(norm(A, Infinity)).toBe(3);
  });
  it('the default norm of [[1,0],[0,2]] is 2, not Frobenius sqrt(5)', () => {
    expect(
      norm([
        [1, 0],
        [0, 2],
      ])
    ).toBeCloseTo(2, 12);
  });
  it('the factory norm agrees', () => {
    const fnorm = (F as unknown as Record<string, (x: unknown, p?: unknown) => number>)
      .factory_norm;
    if (fnorm) {
      expect(fnorm(A, 2)).toBeCloseTo(3, 12);
      expect(fnorm(A)).toBeCloseTo(3, 12);
    }
  });
});
