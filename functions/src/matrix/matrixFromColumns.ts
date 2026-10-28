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

const name = 'matrixFromColumns';
const dependencies = ['typed', 'matrix', 'flatten', 'size'];

export const createMatrixFromColumns = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, flatten, size }: Dependencies) => {
    /**
     * Create a dense matrix from vectors as individual columns.
     * If you pass row vectors, they will be transposed (but not conjugated!)
     *
     * Syntax:
     *
     *    math.matrixFromColumns(...arr)
     *    math.matrixFromColumns(col1, col2)
     *    math.matrixFromColumns(col1, col2, col3)
     *
     * Examples:
     *
     *    math.matrixFromColumns([1, 2, 3], [[4],[5],[6]])
     *    math.matrixFromColumns(...vectors)
     *
     * See also:
     *
     *    matrix, matrixFromRows, matrixFromFunction, zeros
     *
     * @param {... Array | Matrix} cols Multiple columns
     * @return { number[][] | Matrix } if at least one of the arguments is an array, an array will be returned
     */
    return typed(name, {
      '...': function (arr: (unknown[] | Matrix)[]): unknown[][] | Matrix {
        return matrixFromVectorList(
          arr,
          'column',
          matrix,
          (cols) => sparseMatrixFromVectors(cols, 'column', size, flatten, matrix),
          _createArray
        );
      },
    });

    function _createArray(arr: unknown[]): unknown[][] {
      if (arr.length === 0)
        throw new TypeError('At least one column is needed to construct a matrix.');
      const N = vectorLength(arr[0], size);

      // create an array with empty rows
      const result: unknown[][] = [];
      for (let i = 0; i < N; i++) {
        result[i] = [];
      }

      // loop columns
      for (const col of arr) {
        const colLength = vectorLength(col, size);

        if (colLength !== N) {
          throw new TypeError(
            'The vectors had different length: ' + (N | 0) + ' ≠ ' + (colLength | 0)
          );
        }

        const f = flatten(col);

        // push a value to each row
        for (let i = 0; i < N; i++) {
          result[i].push(f[i]);
        }
      }

      return result;
    }
  }
);
