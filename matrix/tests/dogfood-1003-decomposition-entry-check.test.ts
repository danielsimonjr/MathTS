import { describe, it, expect } from 'vitest';
// Issue #1003 (code review F2). The shared decomposition reader checked the row lengths of a
// nested array and not its entries, and `new DenseMatrix(rows, cols, array)` wrote each entry
// into a Float64Array with no check. A string entry became NaN or a number with no error:
// matrixExpm([['a']]) gave [[NaN]], matrixSqrtm([['4']]) gave [[2]]. Every reader now refuses a
// non-number entry with the TypeError of the DenseMatrix constructor.
import {
  DenseMatrix,
  decompositionInputToDenseMatrix,
  decompositionInputToNestedArray,
  lu,
  matrixExpm,
  matrixSqrtm,
} from '../src/index.js';

const ENTRY = /must contain numbers; row 0 column 0 is string/;
const bad = (x: unknown): never => x as never;

describe('issue #1003: a non-number entry of a nested matrix throws a TypeError', () => {
  it('matrixExpm and matrixSqrtm refuse a string entry (nested and toArray input)', () => {
    expect(() => matrixExpm(bad([['a']]))).toThrow(ENTRY);
    expect(() => matrixExpm(bad({ toArray: () => [['a']] }))).toThrow(ENTRY);
    expect(() => matrixSqrtm(bad([['4']]))).toThrow(ENTRY);
  });

  it('lu and both shared readers refuse a string entry', () => {
    expect(() =>
      lu(
        bad([
          ['a', 'b'],
          ['c', 'd'],
        ])
      )
    ).toThrow(ENTRY);
    expect(() => decompositionInputToDenseMatrix(bad([['a']]))).toThrow(ENTRY);
    expect(() => decompositionInputToNestedArray(bad([['a']]))).toThrow(ENTRY);
    expect(() =>
      decompositionInputToNestedArray(
        bad([
          [1, 2],
          [3, null],
        ])
      )
    ).toThrow(/row 1 column 1 is null/);
  });

  it('the (rows, cols, array) constructor refuses a non-number entry, nested and flat', () => {
    expect(() => new DenseMatrix(1, 1, bad([['a']]))).toThrow(ENTRY);
    expect(() => new DenseMatrix(1, 2, bad([1, '2']))).toThrow(
      /must contain numbers; element 1 is string/
    );
  });

  it('keeps number entries, NaN and Infinity included, and the empty matrix (pin)', () => {
    expect(
      decompositionInputToNestedArray([
        [1, NaN],
        [Infinity, 4],
      ])
    ).toEqual([
      [1, NaN],
      [Infinity, 4],
    ]);
    expect(decompositionInputToNestedArray([])).toEqual([]);
    expect(new DenseMatrix(1, 2, [3, 4]).toArray()).toEqual([[3, 4]]);
  });
});
