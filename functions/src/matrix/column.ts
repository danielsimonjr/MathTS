import { factory } from '../utils/factory.js';
import { clone } from '../utils/object.js';
import { slice2d } from './slice-2d.js';

// Type definitions
interface Matrix {
  size(): number[];
  subset(index: unknown): unknown;
  valueOf(): unknown[];
}

type IndexConstructor = new (...ranges: unknown[]) => object;

interface TypedFunction<T = unknown> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => T;
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

const name = 'column';
const dependencies = ['typed', 'Index', 'matrix', 'range'];

export const createColumn = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, Index, matrix, range }: Dependencies) => {
    /**
     * Return a column from a Matrix.
     *
     * Syntax:
     *
     *     math.column(value, index)
     *
     * Example:
     *
     *     // get a column
     *     const d = [[1, 2], [3, 4]]
     *     math.column(d, 1) // returns [[2], [4]]
     *
     * See also:
     *
     *     row
     *
     * @param {Array | Matrix } value   An array or matrix
     * @param {number} column           The index of the column
     * @return {Array | Matrix}         The retrieved column
     */
    return typed(name, {
      'Matrix, number': _column,

      'Array, number': function (value: unknown[], column: number): unknown[] {
        return _column(matrix(clone(value)), column).valueOf() as unknown[];
      },
    });

    /**
     * Retrieve a column of a matrix
     * @param {Matrix } value  A matrix
     * @param {number} column  The index of the column
     * @return {Matrix}        The retrieved column
     */
    function _column(value: Matrix, column: number): Matrix {
      return slice2d(value, 1, column, matrix, Index, range) as Matrix;
    }
  }
);
