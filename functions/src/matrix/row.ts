import { factory } from '../utils/factory.js';
import { isMatrix } from '../utils/is.js';
import { clone } from '../utils/object.js';
import { validateIndex } from '../utils/array.js';

// Type definitions
interface Matrix {
  size(): number[];
  subset(index: unknown): unknown;
  valueOf(): unknown[];
}

type IndexConstructor = new (...ranges: unknown[]) => object;

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface MatrixConstructor {
  (data: unknown[]): Matrix;
}

interface Dependencies {
  typed: TypedFunction;
  Index: IndexConstructor;
  matrix: MatrixConstructor;
  range: TypedFunction;
}

const name = 'row';
const dependencies = ['typed', 'Index', 'matrix', 'range'];

export const createRow = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, Index, matrix, range }: Dependencies) => {
    /**
     * Return a row from a Matrix.
     *
     * Syntax:
     *
     *     math.row(value, index)
     *
     * Example:
     *
     *     // get a row
     *     const d = [[1, 2], [3, 4]]
     *     math.row(d, 1) // returns [[3, 4]]
     *
     * See also:
     *
     *     column
     *
     * @param {Array | Matrix } value   An array or matrix
     * @param {number} row              The index of the row
     * @return {Array | Matrix}         The retrieved row
     */
    return typed(name, {
      'Matrix, number': _row,

      'Array, number': function (value: unknown[], row: number): unknown[] {
        return _row(matrix(clone(value)), row).valueOf() as unknown[];
      },
    });

    /**
     * Retrieve a row of a matrix
     * @param {Matrix } value  A matrix
     * @param {number} row     The index of the row
     * @return {Matrix}        The retrieved row
     */
    function _row(value: Matrix, row: number): Matrix {
      // check dimensions
      if (value.size().length !== 2) {
        throw new Error('Only two dimensional matrix is supported');
      }

      validateIndex(row, value.size()[0]);

      const columnRange = range(0, value.size()[1]);
      const index = new Index([row], columnRange);
      const result = value.subset(index);
      // once config.legacySubset just return result
      return isMatrix(result) ? (result as Matrix) : matrix([[result]]);
    }
  }
);
