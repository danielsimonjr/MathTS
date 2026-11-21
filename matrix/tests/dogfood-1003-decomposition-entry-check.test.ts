import { describe, it, expect } from 'vitest';
// Issue #1003 (code review F2; lead ruling L3). The shared decomposition reader checked the row
// lengths of a nested array and not its entries, and `new DenseMatrix(rows, cols, array)` wrote
// each entry into a Float64Array with no check. A string entry became NaN with no error:
// matrixExpm([['a']]) gave [[NaN]]. The reader now applies the implicit to-number rule of
// mathjs 15.2.0: a numeric string converts (mathjs sqrtm([['4']]) is [[2]]), a non-numeric
// string throws `Cannot convert`, and an entry with no conversion to number (an object, an
// array, a BigNumber in this floating-point package) throws the TypeError of the DenseMatrix
// constructor. The (rows, cols, array) constructor stays strict, as its nested form was.
import {
  DenseMatrix,
  decompositionInputToDenseMatrix,
  decompositionInputToNestedArray,
  lu,
  matrixExpm,
  matrixSqrtm,
} from '../src/index.js';

const CONVERT = /Cannot convert "a" to a number/;
const bad = (x: unknown): never => x as never;

describe('issue #1003: the decomposition reader applies the mathjs entry rule', () => {
  it('a non-numeric string throws Cannot convert (nested and toArray input)', () => {
    expect(() => matrixExpm(bad([['a']]))).toThrow(CONVERT);
    expect(() => matrixExpm(bad({ toArray: () => [['a']] }))).toThrow(CONVERT);
    expect(() =>
      lu(
        bad([
          ['a', 'b'],
          ['c', 'd'],
        ])
      )
    ).toThrow(CONVERT);
    expect(() => decompositionInputToDenseMatrix(bad([['a']]))).toThrow(CONVERT);
  });

  it('a numeric string, a boolean and null convert, as in mathjs', () => {
    expect(matrixSqrtm(bad([['4']])).toArray()).toEqual([[2]]);
    expect(
      decompositionInputToNestedArray(
        bad([
          ['1', true],
          [null, 4],
        ])
      )
    ).toEqual([
      [1, 1],
      [0, 4],
    ]);
  });

  it('an entry with no conversion to number throws the DenseMatrix entry TypeError', () => {
    expect(() =>
      decompositionInputToNestedArray(
        bad([
          [1, 2],
          [3, {}],
        ])
      )
    ).toThrow(/must contain numbers; row 1 column 1 is Object/);
    expect(() => decompositionInputToNestedArray(bad([[1, [2]]]))).toThrow(
      /row 0 column 1 is Array/
    );
  });

  it('the (rows, cols, array) constructor refuses a non-number entry, nested and flat', () => {
    expect(() => new DenseMatrix(1, 1, bad([['a']]))).toThrow(
      /must contain numbers; row 0 column 0 is string/
    );
    expect(() => new DenseMatrix(1, 2, bad([1, '2']))).toThrow(
      /must contain numbers; element 1 is string/
    );
  });

  it('keeps number entries, NaN and Infinity included, the empty matrix, and the input (pin)', () => {
    const rows = [
      [1, NaN],
      [Infinity, 4],
    ];
    expect(decompositionInputToNestedArray(rows)).toBe(rows);
    expect(decompositionInputToNestedArray([])).toEqual([]);
    expect(new DenseMatrix(1, 2, [3, 4]).toArray()).toEqual([[3, 4]]);
  });
});
