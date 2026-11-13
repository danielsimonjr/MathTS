import {
  decompositionInputToNestedArray,
  isPackedMatrixDescriptor,
  lu,
  luSolve,
  densifyForSolver,
} from '@danielsimonjr/mathts-matrix';
import type { PackedMatrixDescriptor } from '@danielsimonjr/mathts-matrix';
import { isArray, isDenseMatrix, isMatrix, isSparseMatrix } from '../../utils/is.js';
import { factory } from '../../utils/factory.js';
import { createSolveValidation } from './utils/solveValidation.js';
import { csIpvec } from '../sparse/csIpvec.js';
import type { TypedFunction } from '../../core/function/typed.js';
import { MathJSSparseMatrix } from '../../factories/matrix-bridge.js';
import { LUSOLVE_SINGULAR_MESSAGE } from './pivot-tolerance.js';
import {
  validatePackedUpperTriangularPivots,
  validateUpperTriangularPivots,
} from './validate-u-pivots.js';

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
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  _data?: unknown;
  valueOf(): unknown[][];
}

interface DenseMatrixConstructor {
  new (data: { data: unknown[][]; size: number[]; datatype?: string }): DenseMatrix;
}

interface LUPDecomposition {
  L: DenseMatrix | SparseMatrix | unknown[][];
  U: DenseMatrix | SparseMatrix | unknown[][];
  p: number[] | null;
  q?: number[] | null;
}

interface SolveValidationFunction {
  (
    matrix: DenseMatrix | SparseMatrix,
    b: unknown[][] | DenseMatrix | SparseMatrix,
    copy: boolean
  ): DenseMatrix;
}

interface LupFunction {
  (matrix: DenseMatrix | SparseMatrix | unknown[][]): LUPDecomposition;
}

interface SluFunction {
  (matrix: SparseMatrix, order: number, threshold: number): LUPDecomposition;
}

interface LsolveFunction {
  (L: DenseMatrix | SparseMatrix, b: DenseMatrix): DenseMatrix;
}

interface UsolveFunction {
  (U: DenseMatrix | SparseMatrix, b: DenseMatrix): DenseMatrix;
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  lup: LupFunction;
  slu: SluFunction;
  usolve: UsolveFunction;
  lsolve: LsolveFunction;
  DenseMatrix: DenseMatrixConstructor;
}

const name = 'lusolve';
const dependencies = ['typed', 'matrix', 'lup', 'slu', 'usolve', 'lsolve', 'DenseMatrix'];

export const createLusolve = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, lup, slu, usolve, lsolve, DenseMatrix }: Dependencies) => {
    const solveValidation = createSolveValidation({
      DenseMatrix,
    } as unknown as Parameters<
      typeof createSolveValidation
    >[0]) as unknown as SolveValidationFunction;

    function rhsToNumberVector(
      b: unknown[][] | DenseMatrix | SparseMatrix | unknown[],
      n: number
    ): number[] {
      if (isDenseMatrix(b)) {
        const dense = b as DenseMatrix;
        if (dense._size.length === 1) {
          return (dense._data as unknown as number[]).map((v) => v as number);
        }
        return dense._data.map((row) => (row as number[])[0]);
      }
      if (isArray(b)) {
        const arr = b as unknown[];
        if (arr.length !== n) {
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        }
        if (arr.length > 0 && Array.isArray(arr[0])) {
          return (arr as unknown[][]).map((row) => row[0] as number);
        }
        return arr as number[];
      }
      throw new TypeError('Invalid right-hand side for lusolve');
    }

    /**
     * Solve `A x = b` for a nested numeric `A` with the packed matrix-package `lu`.
     * Returns the solution as a plain `n x 1` nested array.
     */
    function lusolveFromNested(
      nested: number[][],
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): number[][] {
      const eq = equilibrateDense(nested, b);
      const aRows = eq.a as number[][];
      const bVec = rhsToNumberVector(eq.b as typeof b, aRows.length);
      let fac;
      try {
        fac = lu(aRows);
      } catch (err) {
        if (err instanceof Error && /singular/i.test(err.message)) {
          throw new Error(LUSOLVE_SINGULAR_MESSAGE);
        }
        throw err;
      }
      validatePackedUpperTriangularPivots(fac.U.toFloat64Array(), aRows.length);
      return luSolve(fac, bVec).map((v) => [v]);
    }

    function isLUPDecomposition(value: unknown): value is LUPDecomposition {
      if (typeof value !== 'object' || value === null) {
        return false;
      }
      const o = value as Record<string, unknown>;
      return 'L' in o && 'U' in o && 'p' in o;
    }

    /**
     * Max |entry| when every entry is a finite number.
     * `NaN` means a non-finite number was seen. `null` means a non-number was seen.
     */
    function maxAbsFinite(rows: unknown[][]): number | null {
      let max = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) return null;
        for (let j = 0; j < row.length; j++) {
          const v = row[j];
          if (typeof v !== 'number') return null;
          if (!Number.isFinite(v)) return Number.NaN;
          const a = Math.abs(v);
          if (a > max) max = a;
        }
      }
      return max;
    }

    function scaleRows(rows: unknown[][], scale: number): number[][] {
      return rows.map((row) => (row as number[]).map((v) => v / scale));
    }

    /** Divide a numeric RHS by `scale`. `null` when `b` is not all finite numbers. */
    function scaleRhs(
      b: unknown[][] | DenseMatrix | SparseMatrix | unknown[],
      scale: number
    ): (unknown[][] | DenseMatrix | SparseMatrix | unknown[]) | null {
      if (isDenseMatrix(b) || isSparseMatrix(b)) {
        const raw = (b as DenseMatrix).valueOf();
        const scaled = scaleRhs(raw as unknown[][], scale);
        if (scaled === null) return null;
        return matrix(scaled as unknown[][]) as DenseMatrix;
      }
      if (!Array.isArray(b)) return null;
      if (b.length === 0) return b;
      if (Array.isArray(b[0])) {
        const rows = b as unknown[][];
        const rhsScale = maxAbsFinite(rows);
        if (Number.isNaN(rhsScale)) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
        if (rhsScale === null) return null;
        return scaleRows(rows, scale);
      }
      for (let i = 0; i < b.length; i++) {
        const v = b[i];
        if (typeof v !== 'number') return null;
        if (!Number.isFinite(v)) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
      }
      return (b as number[]).map((v) => v / scale);
    }

    /**
     * Divide A and b by max|A| when that max is positive and below 1, so the
     * absolute pivot floor matches the matrix's own scale. `A x = b` is unchanged.
     * Non-finite A throws. A zero matrix throws. Non-numeric A is left alone.
     */
    function equilibrateDense(
      rows: unknown[][],
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): { a: unknown[][]; b: unknown[][] | DenseMatrix | SparseMatrix | unknown[] } {
      const scale = maxAbsFinite(rows);
      if (scale === null) return { a: rows, b };
      if (!Number.isFinite(scale) || scale === 0) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
      if (scale >= 1) return { a: rows, b };
      const sb = scaleRhs(b, scale);
      if (sb === null) return { a: rows, b };
      return { a: scaleRows(rows, scale), b: sb };
    }

    function equilibrateSparse(
      a: SparseMatrix,
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): { a: SparseMatrix; b: unknown[][] | DenseMatrix | SparseMatrix | unknown[] } {
      const values = a._values;
      if (!values) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
      let scale = 0;
      for (let k = 0; k < values.length; k++) {
        const v = values[k];
        if (typeof v !== 'number') return { a, b };
        if (!Number.isFinite(v)) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
        const av = Math.abs(v);
        if (av > scale) scale = av;
      }
      if (scale === 0) throw new Error(LUSOLVE_SINGULAR_MESSAGE);
      if (scale >= 1) return { a, b };
      const sb = scaleRhs(b, scale);
      if (sb === null) return { a, b };
      const index = a._index;
      const ptr = a._ptr;
      if (!index || !ptr) return { a, b };
      const copy = new MathJSSparseMatrix({
        values: (values as number[]).map((v) => v / scale),
        index: index.slice(),
        ptr: ptr.slice(),
        size: a._size.slice(),
        datatype: a._datatype,
      });
      return { a: copy as unknown as SparseMatrix, b: sb };
    }

    /** Lift a prefactored numeric U (and b) when every entry is smaller than 1. */
    function liftTinyFactor(
      U: DenseMatrix | SparseMatrix,
      b: DenseMatrix
    ): { U: DenseMatrix | SparseMatrix; b: DenseMatrix } {
      if ((U as { isDenseMatrix?: boolean }).isDenseMatrix === true) {
        const dense = U as DenseMatrix;
        const eq = equilibrateDense(dense._data, b);
        if (eq.a === dense._data) return { U, b };
        return {
          U: new DenseMatrix({
            data: eq.a as unknown[][],
            size: dense._size.slice(),
            datatype: dense._datatype,
          }),
          b: eq.b as DenseMatrix,
        };
      }
      const eq = equilibrateSparse(U as SparseMatrix, b);
      if (eq.a === U) return { U, b };
      return { U: eq.a, b: eq.b as DenseMatrix };
    }

    /**
     * Solves the linear system `A * x = b` where `A` is an [n x n] matrix and `b` is a [n] column vector.
     *
     * Syntax:
     *
     *    math.lusolve(A, b)     // returns column vector with the solution to the linear system A * x = b
     *    math.lusolve(lup, b)   // returns column vector with the solution to the linear system A * x = b, lup = math.lup(A)
     *
     * Examples:
     *
     *    const m = [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 3, 0], [0, 0, 0, 4]]
     *
     *    const x = math.lusolve(m, [-1, -1, -1, -1])        // x = [[-1], [-0.5], [-1/3], [-0.25]]
     *
     *    const f = math.lup(m)
     *    const x1 = math.lusolve(f, [-1, -1, -1, -1])       // x1 = [[-1], [-0.5], [-1/3], [-0.25]]
     *    const x2 = math.lusolve(f, [1, 2, 1, -1])          // x2 = [[1], [1], [1/3], [-0.25]]
     *
     *    const a = [[-2, 3], [2, 1]]
     *    const b = [11, 9]
     *    const x = math.lusolve(a, b)  // [[2], [5]]
     *
     * See also:
     *
     *    lup, slu, lsolve, usolve
     *
     * @param {Matrix | Array | Object} A      Invertible Matrix or the Matrix LU decomposition
     * @param {Matrix | Array} b               Column Vector
     * @param {number} [order]                 The Symbolic Ordering and Analysis order, see slu for details. Matrix must be a SparseMatrix
     * @param {Number} [threshold]             Partial pivoting threshold (1 for partial pivoting), see slu for details. Matrix must be a SparseMatrix.
     *
     * @return {DenseMatrix | Array}           Column vector with the solution to the linear system A * x = b
     *
     * Throws when the factorization is singular or contains non-finite values, including
     * rank-deficient but consistent systems. The pivot cutoff is `1e-15` times the
     * largest absolute entry (the same floor `linsolve` uses on a unit-scale matrix).
     * Numeric systems whose entries are all smaller than 1 are equilibrated first so
     * that cutoff stays relative to the matrix.
     */
    return typed(name, {
      'Array, Array | Matrix': function (
        a: unknown[][],
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): unknown[][] {
        return lusolveFromNested(a as number[][], b);
      },

      'Float64Array, Array | Matrix': function (
        a: Float64Array,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): unknown[][] {
        return lusolveFromNested(decompositionInputToNestedArray(a), b);
      },

      'DenseMatrix, Array | Matrix': function (
        a: DenseMatrix,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): DenseMatrix {
        return _lusolveDense(a, b);
      },

      'SparseMatrix, Array | Matrix': function (
        a: SparseMatrix,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): DenseMatrix {
        // A matrix-package SparseMatrix (CSR) has no _values/_index/_ptr: densify it and
        // use the dense factorization.
        const dense = densifyForSolver(a);
        if (dense) return _lusolveDense(matrix(dense.toArray()) as DenseMatrix, b);
        const eq = equilibrateSparse(a, b);
        const d = lup(eq.a);
        return _lusolve(d.L, d.U, d.p, null, eq.b as typeof b);
      },

      'SparseMatrix, Array | Matrix, number, number': function (
        a: SparseMatrix,
        b: unknown[][] | DenseMatrix | SparseMatrix,
        order: number,
        threshold: number
      ): DenseMatrix {
        const eq = equilibrateSparse(a, b);
        const d = slu(eq.a, order, threshold);
        return _lusolve(d.L, d.U, d.p, d.q, eq.b as typeof b);
      },

      'Object, Array | Matrix': function (
        a: LUPDecomposition | PackedMatrixDescriptor | unknown,
        b: unknown[][] | DenseMatrix | SparseMatrix
      ): DenseMatrix | unknown[][] {
        if (isLUPDecomposition(a)) {
          return _lusolve(a.L, a.U, a.p, a.q, b);
        }
        if (isPackedMatrixDescriptor(a)) {
          return lusolveFromNested(decompositionInputToNestedArray(a), b);
        }
        const candidate = a as Record<string, unknown>;
        if (
          candidate.data instanceof Float64Array &&
          typeof candidate.rows === 'number' &&
          typeof candidate.cols === 'number'
        ) {
          // Same normalizer as svd/lu: length and integer checks throw TypeError.
          decompositionInputToNestedArray(a as PackedMatrixDescriptor);
        }
        throw new TypeError('Invalid Matrix LU decomposition');
      },
    });

    /** LU solve of a dense matrix: equilibrate, factor with partial pivoting, then substitute. */
    function _lusolveDense(
      a: DenseMatrix,
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): DenseMatrix {
      const eq = equilibrateDense(a._data, b);
      const aMatrix = eq.a === a._data ? a : (matrix(eq.a as unknown[][]) as DenseMatrix);
      const d = lup(aMatrix);
      return _lusolve(d.L, d.U, d.p, null, eq.b as typeof b);
    }

    function _toMatrix(a: DenseMatrix | SparseMatrix | unknown[][]): DenseMatrix | SparseMatrix {
      if (isMatrix(a)) {
        return a as DenseMatrix | SparseMatrix;
      }
      if (isArray(a)) {
        return matrix(a);
      }
      throw new TypeError('Invalid Matrix LU decomposition');
    }

    function _lusolve(
      l: DenseMatrix | SparseMatrix | unknown[][],
      u: DenseMatrix | SparseMatrix | unknown[][],
      p: number[] | null | undefined,
      q: number[] | null | undefined,
      b: unknown[][] | DenseMatrix | SparseMatrix
    ): DenseMatrix {
      // verify decomposition
      const L = _toMatrix(l);
      const U = _toMatrix(u);

      // apply row permutations if needed (b is a DenseMatrix)
      let bMatrix: DenseMatrix;
      if (p) {
        bMatrix = solveValidation(L, b, true);
        bMatrix._data = csIpvec(p, bMatrix._data) as unknown[][];
      } else {
        bMatrix = solveValidation(L, b, true);
      }

      const lifted = liftTinyFactor(U, bMatrix);
      validateUpperTriangularPivots(lifted.U);

      // use forward substitution to resolve L * y = b
      const y = lsolve(L, lifted.b);
      // use backward substitution to resolve U * x = y
      const x = usolve(lifted.U, y);

      // apply column permutations if needed (x is a DenseMatrix)
      if (q) {
        x._data = csIpvec(q, x._data) as unknown[][];
      }

      return x;
    }
  }
);
