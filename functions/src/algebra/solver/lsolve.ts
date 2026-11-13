import { densifyForSolver } from '@danielsimonjr/mathts-matrix';
import { factory } from '../../utils/factory.js';
import { createSolveValidation } from './utils/solveValidation.js';
import { findTypedImpl } from '../../utils/typed-impl.js';
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

    type NumberBin = (a: number, b: number) => number;
    type NumberEqual = (a: number, b: number) => boolean;
    type SolveNumberOps = {
      div: NumberBin;
      mul: NumberBin;
      sub: NumberBin;
      equalScalar: NumberEqual;
    };

    let cachedSolveOps: SolveNumberOps | null | undefined;

    function getSolveNumberOps(): SolveNumberOps | null {
      if (cachedSolveOps === undefined) {
        const nn = ['number', 'number'];
        const div = findTypedImpl<[number, number], number>(typed, divideScalar, nn);
        const mul = findTypedImpl<[number, number], number>(typed, multiplyScalar, nn);
        const sub = findTypedImpl<[number, number], number>(typed, subtractScalar, nn);
        const equalNum = findTypedImpl<[number, number], boolean>(typed, equalScalar, nn);
        cachedSolveOps =
          div && mul && sub && equalNum ? { div, mul, sub, equalScalar: equalNum } : null;
      }
      return cachedSolveOps;
    }

    function matrixAllNumbers(data: unknown[][]): boolean {
      for (let r = 0; r < data.length; r++) {
        const row = data[r];
        for (let c = 0; c < row.length; c++) {
          if (typeof row[c] !== 'number') return false;
        }
      }
      return true;
    }

    function columnAllNumbers(data: unknown[][]): boolean {
      for (let i = 0; i < data.length; i++) {
        const v = data[i][0];
        if (v != null && typeof v !== 'number') return false;
      }
      return true;
    }

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
        // A matrix-package SparseMatrix (CSR) has no _index/_ptr/size(): densify it and
        // run the dense forward substitution, which gives the same result as lsolve(dense).
        const dense = densifyForSolver(m);
        if (dense) return _denseForwardSubstitution(matrix(dense.toArray()) as DenseMatrix, b);
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

    /**
     * Forward substitution for number storage. Returns the first column to finish
     * on the generic path (`columns` when the number path completed). A found
     * `number, number` signature does not guarantee a number result; if `div`
     * leaves the number domain, resume generic dispatch from that column so
     * already-updated RHS entries are kept and later columns still dispatch.
     */
    function _denseForwardSubstitutionNumber(
      mdata: number[][],
      bdata: unknown[][],
      x: unknown[][],
      rows: number,
      columns: number,
      ops: SolveNumberOps
    ): number {
      for (let j = 0; j < columns; j++) {
        const bj = (bdata[j][0] as number) || 0;
        let xj: number;
        if (!ops.equalScalar(bj, 0)) {
          const vjj = mdata[j][j];
          if (ops.equalScalar(vjj, 0)) {
            throw new Error('Linear system cannot be solved since matrix is singular');
          }
          const quot = ops.div(bj, vjj);
          if (typeof quot !== 'number') {
            return j;
          }
          xj = quot;
          const updates: number[] = [];
          for (let i = j + 1; i < rows; i++) {
            const next = ops.sub((bdata[i][0] as number) || 0, ops.mul(xj, mdata[i][j]));
            if (typeof next !== 'number') {
              return j;
            }
            updates.push(next);
          }
          for (let k = 0; k < updates.length; k++) {
            bdata[j + 1 + k] = [updates[k]];
          }
        } else {
          xj = 0;
        }
        x[j] = [xj];
      }
      return columns;
    }

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

      const ops = getSolveNumberOps();
      let jStart = 0;
      if (ops && matrixAllNumbers(mdata) && columnAllNumbers(bdata)) {
        jStart = _denseForwardSubstitutionNumber(mdata as number[][], bdata, x, rows, columns, ops);
        if (jStart === columns) {
          return new DenseMatrix({
            data: x,
            size: [rows, 1],
          });
        }
      }

      // loop columns
      for (let j = jStart; j < columns; j++) {
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
