import { factory } from '../../utils/factory.js';
import { createSolveValidation } from './utils/solveValidation.js';
import type { TypedFunction } from '../../core/function/typed.js';

// Type definitions
interface MatrixConstructor {
  (data: unknown[] | unknown[][], storage?: 'dense' | 'sparse'): DenseMatrix | SparseMatrix;
}

interface DenseMatrix {
  type: 'DenseMatrix';
  isDenseMatrix: true;
  _data: unknown[][];
  _size: number[];
  _datatype?: string;
  valueOf(): unknown[][];
}

interface SparseMatrix {
  type: 'SparseMatrix';
  isSparseMatrix: true;
  _values?: unknown[];
  _index: number[];
  _ptr: number[];
  _size: number[];
  _datatype?: string;
  valueOf(): unknown[][];
}

interface DenseMatrixConstructor {
  new (data: { data: unknown[][]; size: number[]; datatype?: string }): DenseMatrix;
}

interface SolveValidationFunction {
  (
    matrix: DenseMatrix | SparseMatrix,
    b: unknown[][] | DenseMatrix | SparseMatrix,
    copy: boolean
  ): DenseMatrix;
}

interface ScalarFunction {
  (a: unknown, b: unknown): unknown;
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  divideScalar: ScalarFunction;
  multiplyScalar: ScalarFunction;
  subtractScalar: ScalarFunction;
  equalScalar: ScalarFunction;
  DenseMatrix: DenseMatrixConstructor;
}

const name = 'lsolve';
const dependencies = [
  'typed',
  'matrix',
  'divideScalar',
  'multiplyScalar',
  'subtractScalar',
  'equalScalar',
  'DenseMatrix',
];

export const createLsolve = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    matrix,
    divideScalar,
    multiplyScalar,
    subtractScalar,
    equalScalar,
    DenseMatrix,
  }: Dependencies) => {
    const solveValidation = createSolveValidation({
      DenseMatrix,
    } as unknown as Parameters<
      typeof createSolveValidation
    >[0]) as unknown as SolveValidationFunction;

    /**
     * Finds one solution of a linear equation system by forwards substitution. Matrix must be a lower triangular matrix. Throws an error if there's no solution.
     *
     * `L * x = b`
     *
     * Syntax:
     *
     *    math.lsolve(L, b)
     *
     * Examples:
     *
     *    const a = [[-2, 3], [2, 1]]
     *    const b = [11, 9]
     *    const x = lsolve(a, b)  // [[-5.5], [20]]
     *
     * See also:
     *
     *    lsolveAll, lup, slu, usolve, lusolve
     *
     * @param {Matrix, Array} L       A N x N matrix or array (L)
     * @param {Matrix, Array} b       A column vector with the b values
     *
     * @return {DenseMatrix | Array}  A column vector with the linear system solution (x)
     */
    return typed(name, {
      'SparseMatrix, Array | Matrix': function (
        m: SparseMatrix,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): DenseMatrix {
        return _sparseForwardSubstitution(m, b);
      },

      'DenseMatrix, Array | Matrix': function (
        m: DenseMatrix,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): DenseMatrix {
        return _denseForwardSubstitution(m, b);
      },

      'Array, Array | Matrix': function (
        a: unknown[][],
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): unknown[][] {
        const m = matrix(a) as DenseMatrix;
        const r = _denseForwardSubstitution(m, b);
        return r.valueOf();
      },
    });

    function _denseForwardSubstitution(
      m: DenseMatrix,
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): DenseMatrix {
      // validate matrix and vector, return copy of column vector b
      const bVector = solveValidation(m, b, true);
      const bdata = bVector._data;

      const rows = m._size[0];
      const columns = m._size[1];

      const mdata = m._data;

      // result
      const x: unknown[][] = [];

      // loop columns
      for (let j = 0; j < columns; j++) {
        const bj = bdata[j][0] || 0;
        let xj: unknown;

        if (!equalScalar(bj, 0)) {
          // non-degenerate row, find solution

          const vjj = mdata[j][j];

          if (equalScalar(vjj, 0)) {
            throw new Error('Linear system cannot be solved since matrix is singular');
          }

          xj = divideScalar(bj, vjj);

          // loop rows
          for (let i = j + 1; i < rows; i++) {
            bdata[i] = [subtractScalar(bdata[i][0] || 0, multiplyScalar(xj, mdata[i][j]))];
          }
        } else {
          // degenerate row, we can choose any value
          xj = 0;
        }

        x[j] = [xj];
      }

      return new DenseMatrix({
        data: x,
        size: [rows, 1],
      });
    }

    function _sparseForwardSubstitution(
      m: SparseMatrix,
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): DenseMatrix {
      // validate matrix and vector, return copy of column vector b
      const bVector = solveValidation(m, b, true);

      const bdata = bVector._data;

      const rows = m._size[0];
      const columns = m._size[1];

      const values = m._values;
      const index = m._index;
      const ptr = m._ptr;

      // result
      const x: unknown[][] = [];

      // loop columns
      for (let j = 0; j < columns; j++) {
        const bj = bdata[j][0] || 0;

        if (!equalScalar(bj, 0)) {
          // non-degenerate row, find solution

          let vjj: unknown = 0;
          // matrix values & indices (column j)
          const jValues: unknown[] = [];
          const jIndices: number[] = [];

          // first and last index in the column
          const firstIndex = ptr[j];
          const lastIndex = ptr[j + 1];

          // values in column, find value at [j, j]
          for (let k = firstIndex; k < lastIndex; k++) {
            const i = index[k];

            // check row (rows are not sorted!)
            if (i === j) {
              vjj = values![k];
            } else if (i > j) {
              // store lower triangular
              jValues.push(values![k]);
              jIndices.push(i);
            }
          }

          // at this point we must have a value in vjj
          if (equalScalar(vjj, 0)) {
            throw new Error('Linear system cannot be solved since matrix is singular');
          }

          const xj = divideScalar(bj, vjj);

          for (let k = 0, l = jIndices.length; k < l; k++) {
            const i = jIndices[k];
            bdata[i] = [subtractScalar(bdata[i][0] || 0, multiplyScalar(xj, jValues[k]))];
          }

          x[j] = [xj];
        } else {
          // degenerate row, we can choose any value
          x[j] = [0];
        }
      }

      return new DenseMatrix({
        data: x,
        size: [rows, 1],
      });
    }
  }
);
