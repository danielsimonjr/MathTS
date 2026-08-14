import { factory } from '../utils/factory.js';

// Type definitions
type NestedArray<T = unknown> = T | NestedArray<T>[];
type MatrixData = NestedArray<unknown>;

interface TypedFunction<T = unknown> {
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
  (data: unknown[] | unknown[][] | { values: unknown[]; index: number[]; ptr: number[]; size: number[] }, storage?: 'dense' | 'sparse'): Matrix;
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
      // Single variadic handler for arrays, matrices, and mixed types
      '...': function (arr: (unknown[] | Matrix)[]): unknown[][] | Matrix {
        if (arr.length === 0) {
          throw new TypeError('At least one row is needed to construct a matrix.');
        }

        // Check if all arguments are Matrix (none are plain arrays)
        const allMatrix = arr.every(
          (item) => typeof (item as { toArray?: unknown }).toArray === 'function'
        );
        // Check if any argument is a plain array
        const hasArray = arr.some((item) => Array.isArray(item));

        const isSparse =
          allMatrix &&
          !hasArray &&
          arr.some(
            (item) => typeof (item as Matrix).storage === 'function' && (item as Matrix).storage() === 'sparse'
          );

        if (isSparse) {
          return _createSparseMatrixFromRows(arr as Matrix[]);
        }

        // Convert all to arrays for processing
        const arrays = arr.map((item) =>
          typeof (item as { toArray?: unknown }).toArray === 'function'
            ? (item as Matrix).toArray()
            : item
        );

        const result = _createArray(arrays);

        // Return Matrix only if all inputs were Matrix, otherwise return array
        if (allMatrix && !hasArray) {
          return matrix(result, 'dense');
        }
        return result;
      },
    });

    function _createSparseMatrixFromRows(arr: Matrix[]): Matrix {
      const N = arr.length;
      const M = checkVectorTypeAndReturnLength(arr[0]);

      const entries: { row: number; col: number; value: unknown }[] = [];

      for (let i = 0; i < N; i++) {
        const rowVec = arr[i];
        const rowLength = checkVectorTypeAndReturnLength(rowVec);
        if (rowLength !== M) {
          throw new TypeError(
            'The vectors had different length: ' + (M | 0) + ' ≠ ' + (rowLength | 0)
          );
        }

        if (typeof rowVec.forEach === 'function') {
          const s = size(rowVec);
          const is1D = s.length === 1;
          const isCol = s.length === 2 && s[1] === 1;

          rowVec.forEach((val, idx) => {
            let col: number;
            if (is1D) {
              col = idx[0];
            } else if (isCol) {
              col = idx[0];
            } else {
              col = idx[1];
            }
            if (val !== 0) {
              entries.push({ row: i, col, value: val });
            }
          });
        } else {
          const f = flatten(rowVec);
          for (let j = 0; j < M; j++) {
            if (f[j] !== 0) {
              entries.push({ row: i, col: j, value: f[j] });
            }
          }
        }
      }

      entries.sort((a, b) => {
        if (a.col !== b.col) return a.col - b.col;
        return a.row - b.row;
      });

      const values: unknown[] = [];
      const index: number[] = [];
      const ptr: number[] = new Array(M + 1).fill(0);

      for (let i = 0; i < entries.length; i++) {
        ptr[entries[i].col + 1]++;
      }
      for (let j = 1; j <= M; j++) {
        ptr[j] += ptr[j - 1];
      }
      for (let i = 0; i < entries.length; i++) {
        values.push(entries[i].value);
        index.push(entries[i].row);
      }

      return matrix({ values, index, ptr, size: [N, M] }, 'sparse');
    }

    function _createArray(arr: unknown[]): unknown[][] {
      if (arr.length === 0)
        throw new TypeError('At least one row is needed to construct a matrix.');
      const N = checkVectorTypeAndReturnLength(arr[0]);

      const result: unknown[][] = [];
      for (const row of arr) {
        const rowLength = checkVectorTypeAndReturnLength(row);

        if (rowLength !== N) {
          throw new TypeError(
            'The vectors had different length: ' + (N | 0) + ' ≠ ' + (rowLength | 0)
          );
        }

        result.push(flatten(row));
      }

      return result;
    }

    function checkVectorTypeAndReturnLength(vec: unknown): number {
      const s = size(vec);

      if (s.length === 1) {
        // 1D vector
        return s[0];
      } else if (s.length === 2) {
        // 2D vector
        if (s[0] === 1) {
          // row vector
          return s[1];
        } else if (s[1] === 1) {
          // col vector
          return s[0];
        } else {
          throw new TypeError('At least one of the arguments is not a vector.');
        }
      } else {
        throw new TypeError('Only one- or two-dimensional vectors are supported.');
      }
    }
  }
);
