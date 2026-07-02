import { factory } from '../../utils/factory.js';
import { matrixSchur, DenseMatrix as NativeDenseMatrix } from '@danielsimonjr/mathts-matrix';
import type { TypedFunction } from '../../core/function/typed.js';

/**
 * Check if a 2D array contains only plain numbers
 */
function isPlainNumberMatrix(matrix: unknown[][]): boolean {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] !== 'number') {
        return false;
      }
    }
  }
  return true;
}

// Type definitions
type NestedArray<T = unknown> = T | NestedArray<T>[];
type MatrixData = NestedArray;

interface Matrix {
  type: string;
  storage(): string;
  size(): number[];
  toArray(): MatrixData;
  valueOf(): MatrixData;
  toString(): string;
  _data?: MatrixData;
}

interface MatrixConstructor {
  (data: unknown[] | unknown[][], storage?: 'dense' | 'sparse'): Matrix;
}

interface SchurResult {
  U: Matrix;
  T: Matrix;
  toString(): string;
}

interface SchurArrayResult {
  U: unknown[][];
  T: unknown[][];
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
}

const name = 'schur';
const dependencies = ['typed', 'matrix'];

export const createSchur = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix }: Dependencies) => {
    /**
     *
     * Performs a real Schur decomposition of the real matrix A = UTU' where U is orthogonal
     * and T is upper quasi-triangular.
     * https://en.wikipedia.org/wiki/Schur_decomposition
     *
     * Delegates to the maintained, oracle-pinned real-Schur primitive
     * `matrixSchur` in `@danielsimonjr/mathts-matrix` (Francis QR with double
     * shifts + real-2×2 standardization). This is the `native-accel` pattern
     * already used for `eigs`/`det`/`inv`. The previous in-package
     * unshifted-QR-iteration fallback was broken — its convergence check
     * `norm(subtract(A, A0))` routed through the L2 matrix norm's
     * `eigs(...).values.toArray()`, which crashed because the factory
     * `subtract`/`multiply` don't round-trip bridge matrices as `Matrix`es.
     *
     * Syntax:
     *
     *     math.schur(A)
     *
     * Examples:
     *
     *     const A = [[1, 0], [-4, 3]]
     *     math.schur(A) // returns {U, T} with A = U·T·U' and eigenvalues on diag(T)
     *
     * See also:
     *
     *     sylvester, lyap, qr
     *
     * @param {Array | Matrix} A  Real square matrix A
     * @return {{U: Array | Matrix, T: Array | Matrix}} Object containing both matrix U and T of the Schur Decomposition A=UTU'
     */
    return typed(name, {
      Array: function (X: unknown[][]): SchurArrayResult {
        const r = _schur(X);
        return {
          U: r.U.valueOf() as unknown[][],
          T: r.T.valueOf() as unknown[][],
        };
      },

      Matrix: function (X: Matrix): SchurResult {
        return _schur(X.valueOf() as unknown[][]);
      },
    });

    /**
     * Compute the real Schur decomposition of a real square matrix given as a
     * plain 2-D array. Returns U and T wrapped in the factory `matrix` type.
     */
    function _schur(data: unknown[][]): SchurResult {
      if (!isPlainNumberMatrix(data)) {
        throw new TypeError('schur: only real (number) matrices are supported');
      }
      const n = data.length;
      if (n === 0 || (data[0]?.length ?? 0) !== n) {
        throw new Error('schur: matrix must be square (real Schur decomposition)');
      }

      const { Q, T } = matrixSchur(NativeDenseMatrix.fromArray(data as number[][]));
      const U = matrix(Q.toArray() as unknown[][]);
      const Tmatrix = matrix(T.toArray() as unknown[][]);

      return {
        U,
        T: Tmatrix,
        toString: function () {
          return 'U: ' + this.U.toString() + '\nT: ' + this.T.toString();
        },
      };
    }
  }
);
