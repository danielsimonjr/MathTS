/**
 * #1007 and #975 edge shapes: an empty axis in `multiply`, and `divide(scalar, [x])`.
 * Each expected value or error class is the result of mathjs 15.2.0.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

type Fn = (...a: unknown[]) => unknown;
const multiply = math.multiply as unknown as Fn;
const divide = math.divide as unknown as Fn;
const plain = (x: unknown): unknown =>
  typeof (x as { toArray?: unknown })?.toArray === 'function'
    ? (x as { toArray(): unknown }).toArray()
    : x;

describe('multiply with an empty axis', () => {
  it('[2 x 0] times an empty vector throws (mathjs: TypeError)', () => {
    expect(() => multiply([[], []], [])).toThrow(TypeError);
  });
  it('[2 x 1] times [1 x 0] is [[], []] (mathjs)', () => {
    expect(multiply([[1], [2]], [[]])).toEqual([[], []]);
    expect(plain(multiply(DenseMatrix.fromArray([[1], [2]]), [[]]))).toEqual([[], []]);
  });
  it('a mismatch with an empty axis still throws', () => {
    // The 2-D mismatch text of MathTS (mathjs throws a RangeError with its own text).
    expect(() => multiply([[]], [[], []])).toThrow('Cannot multiply 1×0 matrix with 2×0 matrix');
    expect(() => multiply([], [[], []])).toThrow(RangeError);
  });
});

describe('divide(scalar, vector of length 1)', () => {
  it('is the vector of the quotient (mathjs)', () => {
    expect(divide(4, [-2])).toEqual([-2]);
    expect(divide(-1, [0])).toEqual([-Infinity]);
    expect(plain(divide(4, math.matrix([2])))).toEqual([2]);
  });
  it('a longer vector still throws the square-matrix RangeError', () => {
    expect(() => divide(4, [1, 2])).toThrow(RangeError);
  });
});
