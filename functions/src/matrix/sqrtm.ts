import { isMatrix } from '../utils/is.js';
import { format } from '../utils/string.js';
import { arraySize } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import { DenseMatrix, matrixSqrtm } from '@danielsimonjr/mathts-matrix';
import {
  ABS_CUTOFF_LO,
  SQUARED,
  allFinite,
  entryRange,
  ldexp,
  withPow2Scale,
  type EntryRange,
} from '@danielsimonjr/mathts-core/internal';

// Type definitions
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by sqrtm */
type Scalar = number | BigNumber | Complex;

/** Matrix data representation */
type MatrixData = Scalar | Scalar[] | Scalar[][];

/** Matrix interface */
export interface Matrix {
  size(): number[];
  clone(): Matrix;
  resize(size: number[]): Matrix;
  valueOf(): MatrixData;
  _data?: MatrixData;
  _size?: number[];
}

/** Typed function interface for math.js functions */
interface TypedFunction<R = Scalar | Matrix> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  // It returns `unknown`, like every typed function, not `R`: `R` covers the
  // dependencies typed here, while `sqrtm` of an array returns a nested array.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => unknown;
  (...args: unknown[]): R;
}

/** Dependencies for sqrtm factory */
interface Dependencies {
  typed: TypedFunction;
  abs: TypedFunction<number | BigNumber>;
  add: TypedFunction<Scalar | Matrix>;
  multiply: TypedFunction<Scalar | Matrix>;
  map: TypedFunction<Matrix>;
  sqrt: TypedFunction<Scalar>;
  subtract: TypedFunction<Scalar | Matrix>;
  inv: TypedFunction<Scalar[][] | Matrix>;
  size: TypedFunction<number[]>;
  max: TypedFunction<number | BigNumber>;
  identity: TypedFunction<Matrix>;
  matrix: TypedFunction<Matrix>;
}

const name = 'sqrtm';
const dependencies = [
  'typed',
  'abs',
  'add',
  'multiply',
  'map',
  'sqrt',
  'subtract',
  'inv',
  'size',
  'max',
  'identity',
  'matrix',
];

export const createSqrtm = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    abs,
    add,
    multiply,
    map,
    sqrt,
    subtract,
    inv,
    size,
    max,
    identity,
    matrix,
  }: Dependencies) => {
    const _maxIterations = 1e3;
    const _tolerance = 1e-6;
    // The largest `_residual` of a root. The worst value over 3,000 random matrices that
    // Denman-Beavers solved is 1.3e-10; a value that stopped early (the matrix of #1158) is
    // 2.3e-8, and one that is not a root (the matrix of #1163) is 2.3e-3.
    const _residualTolerance = 1e-9;

    /**
     * Calculate the principal square root matrix using the Denman-Beavers iterative method
     *
     * https://en.wikipedia.org/wiki/Square_root_of_a_matrix#By_Denman-Beavers_iteration
     *
     * @param A   The square matrix `A`
     * @return    The principal square root of matrix `A`
     * @private
     */
    function _denmanBeavers(A: Scalar[][] | Matrix): Scalar[][] | Matrix {
      let error: number;
      let iterations = 0;

      let Y: Scalar[][] | Matrix = A;
      let Z: Scalar[][] | Matrix = identity(size(A));

      do {
        const Yk = Y;
        Y = multiply(0.5, add(Yk, inv(Z))) as Scalar[][] | Matrix;
        Z = multiply(0.5, add(Z, inv(Yk))) as Scalar[][] | Matrix;

        error = max(abs(subtract(Y, Yk))) as number;

        if (error > _tolerance && ++iterations > _maxIterations) {
          throw new Error('computing square root of matrix: iterative method could not converge');
        }
      } while (error > _tolerance);

      return Y;
    }

    /**
     * The residual of `X` as a root of `A` (plain numbers): `max|X·X - A| / (n · max|X|²)`.
     * X and A are scaled by an exact power of 2, so the largest entry of X is in [1, 2) and
     * X·X neither overflows nor underflows. It is 0 when both are zero, and Infinity when X
     * has a non-finite entry or is zero while A is not.
     */
    function _residual(A: number[][], X: number[][]): number {
      const n = A.length;
      let xmax = 0;
      let amax = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (!Number.isFinite(X[i][j])) return Infinity;
          xmax = Math.max(xmax, Math.abs(X[i][j]));
          amax = Math.max(amax, Math.abs(A[i][j]));
        }
      }
      if (xmax === 0) return amax === 0 ? 0 : Infinity;
      const p = -Math.floor(Math.log2(xmax));
      const Xs = X.map((row) => row.map((v) => ldexp(v, p)));
      // 2p can pass 1023, so A is scaled in two steps.
      const As = A.map((row) => row.map((v) => ldexp(ldexp(v, p), p)));
      let diff = 0;
      let top = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) sum += Xs[i][k] * Xs[k][j];
          diff = Math.max(diff, Math.abs(sum - As[i][j]));
          top = Math.max(top, Math.abs(Xs[i][j]));
        }
      }
      return diff / (n * top * top);
    }

    /**
     * `_denmanBeavers` of a matrix of plain numbers, scaled by an even power of 2 when the
     * largest entry is outside [2^-20, 2^400]. The stop test `_tolerance` is absolute, so a
     * tiny matrix stops at once, and a huge one often does not converge. The scaled matrix
     * has its largest entry in [1, 4); when that scale would push a nonzero entry below
     * 2^-1022, the window scale of `withPow2Scale` is used. Above 2^400 the unscaled run
     * is tried first and kept when it is finite: it stops only at a fixed point, so it is
     * more accurate than the scaled run. A scaled run that is not finite throws.
     * sqrtm(2^e A) = 2^(e/2) sqrtm(A) (#1122).
     * An ordinary matrix is not scaled.
     */
    function _sqrtmWindowed(A: Scalar[][] | Matrix, range: EntryRange): Scalar[][] | Matrix {
      // True after the unscaled run failed once, so it is not made a second time.
      let unscaledFailed = false;
      return withPow2Scale(
        range,
        ABS_CUTOFF_LO,
        SQUARED,
        (windowE) => {
          if (windowE === 0) {
            unscaledFailed = true;
            const unscaled = _denmanBeavers(A);
            unscaledFailed = !allFinite(unscaled);
            return unscaled;
          }
          if (windowE < 0 && !unscaledFailed) {
            try {
              const unscaled = _denmanBeavers(A);
              if (allFinite(unscaled)) return unscaled;
            } catch {
              // No convergence: take the scaled run.
            }
          }
          const unit = -2 * Math.floor(Math.floor(Math.log2(range.amax)) / 2);
          const e = ldexp(range.amin, unit) >= 2 ** -1022 ? unit : windowE;
          const root = _denmanBeavers(
            map(A, (v: unknown) => ldexp(v as number, e)) as Scalar[][] | Matrix
          );
          // The stop test passes a NaN error, so a scaled run that overflowed returns NaN.
          if (!allFinite(root)) {
            throw new Error('computing square root of matrix: iterative method could not converge');
          }
          return map(root, (v: unknown) => ldexp(v as number, -e / 2)) as Scalar[][] | Matrix;
        },
        true
      );
    }

    /**
     * The principal square root of a square matrix. For plain numbers, a result is kept only
     * when it is a root: `_residual` is at most `_residualTolerance`. The stop test of
     * Denman-Beavers is an absolute step size, so it does not tell a root from a value that
     * stopped early or at a wrong point (#1158, #1163). The paths, in order:
     *
     * 1. `_sqrtmWindowed`, the run of #1122 (an ordinary matrix keeps its value bit for bit).
     * 2. A run on the matrix scaled to a largest entry in [1, 4) (a tiny matrix stops at once,
     *    and a huge one does not converge on the absolute stop test).
     * 3. The Schur method of `matrixSqrtm`, which does not invert an iterate: a singular
     *    matrix with a real root, such as the zero matrix or a rank-1 matrix, has a root (#1170).
     * 4. An error: no path found a root.
     *
     * A matrix with a NaN or infinite entry is not checked: it keeps the result of path 1.
     * Entries that are not plain numbers (BigNumber, Complex) take `_denmanBeavers` as before.
     */
    function _sqrtmScaled(A: Scalar[][] | Matrix): Scalar[][] | Matrix {
      const data = (isMatrix(A) ? (A as Matrix).valueOf() : A) as Scalar[][];
      if (!data.every((row) => row.every((v) => typeof v === 'number'))) {
        return _denmanBeavers(A);
      }
      const rows = data as unknown as number[][];
      const range = entryRange(rows);
      if (!range.finite) return _sqrtmWindowed(A, range);
      const isRoot = (R: Scalar[][] | Matrix): boolean =>
        _residual(rows, (isMatrix(R) ? (R as Matrix).valueOf() : R) as unknown as number[][]) <=
        _residualTolerance;

      try {
        const root = _sqrtmWindowed(A, range);
        if (isRoot(root)) return root;
      } catch {
        // No convergence: try the next path.
      }

      if (range.amax > 0) {
        const e = -2 * Math.floor(Math.floor(Math.log2(range.amax)) / 2);
        // A scale that pushes the smallest entry below 2^-1022 would lose it.
        if (e !== 0 && ldexp(range.amin, e) >= 2 ** -1022) {
          try {
            const scaled = _denmanBeavers(
              map(A, (v: unknown) => ldexp(v as number, e)) as Scalar[][] | Matrix
            );
            if (allFinite(scaled)) {
              const root = map(scaled, (v: unknown) => ldexp(v as number, -e / 2)) as
                Scalar[][] | Matrix;
              if (isRoot(root)) return root;
            }
          } catch {
            // No convergence: try the next path.
          }
        }
      }

      try {
        const R = matrixSqrtm(DenseMatrix.fromArray(rows)).toArray() as number[][];
        if (_residual(rows, R) <= _residualTolerance) {
          return isMatrix(A)
            ? (map(A, (_v: unknown, index: number[]) => R[index[0]][index[1]]) as Matrix)
            : R;
        }
      } catch {
        // No real root by the Schur method either.
      }

      throw new Error('computing square root of matrix: iterative method could not converge');
    }

    /**
     * Calculate the principal square root of a square matrix.
     * The principal square root matrix `X` of another matrix `A` is such that `X * X = A`.
     *
     * https://en.wikipedia.org/wiki/Square_root_of_a_matrix
     *
     * Syntax:
     *
     *     math.sqrtm(A)
     *
     * Examples:
     *
     *     math.sqrtm([[33, 24], [48, 57]]) // returns [[5, 2], [4, 7]]
     *
     * See also:
     *
     *     sqrt, pow
     *
     * @param  {Array | Matrix} A   The square matrix `A`
     * @return {Array | Matrix}     The principal square root of matrix `A`
     */
    return typed(name, {
      'Array | Matrix': function (A: Scalar[] | Scalar[][] | Matrix): Scalar[][] | Matrix {
        const sizeArray = isMatrix(A)
          ? (A as Matrix).size()
          : arraySize(A as Scalar[] | Scalar[][]);
        switch (sizeArray.length) {
          case 1:
            // Single element Array | Matrix
            if (sizeArray[0] === 1) {
              return map(A, sqrt);
            } else if (sizeArray[0] === 0) {
              // the root of the 0 x 0 matrix is the 0 x 0 matrix, in the same kind (#1233)
              return isMatrix(A) ? (A as Matrix).clone().resize([0, 0]) : [];
            } else {
              throw new RangeError(
                'Matrix must be square ' + '(size: ' + format(sizeArray, {}) + ')'
              );
            }

          case 2: {
            // Two-dimensional Array | Matrix
            const rows = sizeArray[0];
            const cols = sizeArray[1];
            if (rows === cols) {
              if (rows === 0) return (A as Matrix).clone();
              // `identity(size(A))` is an Array, so the iteration can end in an Array. A
              // Matrix in gives a Matrix out (#1278).
              const root = _sqrtmScaled(A as Scalar[][] | Matrix);
              return isMatrix(A) && !isMatrix(root) ? matrix(root) : root;
            } else {
              throw new RangeError(
                'Matrix must be square ' + '(size: ' + format(sizeArray, {}) + ')'
              );
            }
          }
          default:
            // Multi dimensional array
            throw new RangeError(
              'Matrix must be at most two dimensional ' + '(size: ' + format(sizeArray, {}) + ')'
            );
        }
      },
    });
  }
);
