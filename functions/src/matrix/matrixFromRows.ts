import { factory } from '../utils/factory.js';
import { matrixFromVectorList, sparseMatrixFromVectors, vectorLength } from './from-vectors.js';

// Type definitions
type NestedArray<T = unknown> = T | NestedArray<T>[];
type MatrixData = NestedArray<unknown>;

interface TypedFunction<T = unknown> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => T;
  (...args: unknown[]): T;
  find(func: unknown, signature: string[]): TypedFunction<T>;
}

interface Matrix {
  type: string;
  storage(): string;
  datatype(): string | undefined;
  size(): number[];
  clone(): Matrix;
  toArray(): MatrixData;
  valueOf(): MatrixData;
  forEach?(cb: (value: unknown, index: number[], matrix: Matrix) => void): void;
  _data?: MatrixData;
  _size?: number[];
  _datatype?: string;
}

interface MatrixConstructor {
  (
    data:
      | unknown[]
      | unknown[][]
      | { values: unknown[]; index: number[]; ptr: number[]; size: number[] },
    storage?: 'dense' | 'sparse'
  ): Matrix;
}

interface FlattenFunction {
  (arr: unknown): unknown[];
}

interface SizeFunction {
  (arr: unknown): number[];
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  flatten: FlattenFunction;
  size: SizeFunction;
}

const name = 'matrixFromRows';
const dependencies = ['typed', 'matrix', 'flatten', 'size'];

export const createMatrixFromRows = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, flatten, size }: Dependencies) => {
    /**
     * Create a dense matrix from vectors as individual rows.
     * If you pass column vectors, they will be transposed (but not conjugated!)
     *
     * Syntax:
     *
     *    math.matrixFromRows(...arr)
     *    math.matrixFromRows(row1, row2)
     *    math.matrixFromRows(row1, row2, row3)
     *
     * Examples:
     *
     *    math.matrixFromRows([1, 2, 3], [[4],[5],[6]])
     *    math.matrixFromRows(...vectors)
     *
     * See also:
     *
     *    matrix, matrixFromColumns, matrixFromFunction, zeros
     *
     * @param {... Array | Matrix} rows  Multiple rows
     * @return { number[][] | Matrix } if at least one of the arguments is an array, an array will be returned
     */
    return typed(name, {
      '...': function (arr: (unknown[] | Matrix)[]): unknown[][] | Matrix {
        return matrixFromVectorList(
          arr,
          'row',
          matrix,
          (rows) => sparseMatrixFromVectors(rows, 'row', size, flatten, matrix),
          _createArray
        );
      },
    });

    function _createArray(arr: unknown[]): unknown[][] {
      if (arr.length === 0)
        throw new TypeError('At least one row is needed to construct a matrix.');
      const N = vectorLength(arr[0], size);

      const result: unknown[][] = [];
      for (const row of arr) {
        const rowLength = vectorLength(row, size);

        if (rowLength !== N) {
          throw new TypeError(
            'The vectors had different length: ' + (N | 0) + ' ≠ ' + (rowLength | 0)
          );
        }

        result.push(flatten(row));
      }

      return result;
    }
  }
);
