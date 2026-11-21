import { describe, it, expect } from 'vitest';
// `matrixSize` is the one reader of the size that a matrix reports (#1337). The nested array of a
// matrix does not carry the size of an empty matrix: `toArray()` of a 0 x 3 matrix is `[]`.
// `notSquareError` is the one error of the square rule (RangeError, as in mathjs).
import { matrixSize, notSquareError } from '../src/internal.js';

describe('matrixSize: the size that a matrix reports', () => {
  it('reads size(), then the size property {rows, cols}, then numeric rows and cols', () => {
    expect(matrixSize({ size: () => [0, 3] })).toEqual([0, 3]);
    expect(matrixSize({ size: { rows: 0, cols: 3 } })).toEqual([0, 3]);
    expect(matrixSize({ rows: 2, cols: 4 })).toEqual([2, 4]);
    expect(matrixSize({ size: () => [2] })).toEqual([2]);
  });

  it('returns a new array', () => {
    const reported = [0, 3];
    const out = matrixSize({ size: () => reported });
    expect(out).toEqual([0, 3]);
    expect(out).not.toBe(reported);
  });

  it('refuses a value that reports no valid size', () => {
    expect(matrixSize({ size: () => [-1, 3] })).toBeUndefined();
    expect(matrixSize({ size: () => [1.5] })).toBeUndefined();
    expect(matrixSize({ rows: () => 0, cols: 3 })).toBeUndefined();
    expect(matrixSize([[1, 2]])).toBeUndefined();
    expect(matrixSize(5)).toBeUndefined();
    expect(matrixSize(null)).toBeUndefined();
  });
});

describe('notSquareError: one class for the square rule', () => {
  it('is a RangeError (and so an Error) with the given text', () => {
    const e = notSquareError('Matrix must be square (size: [2, 3])');
    expect(e).toBeInstanceOf(RangeError);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('Matrix must be square (size: [2, 3])');
  });
});
