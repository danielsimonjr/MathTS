import { isMatrix } from '../utils/is.js';
import { format } from '../utils/string.js';
import { arraySize } from '../utils/array.js';
import { factory } from '../utils/factory.js';
import {
  ABS_CUTOFF_LO,
  SQUARED,
  allFinite,
  entryRange,
  ldexp,
  withPow2Scale,
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
];

export const createSqrtm = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, abs, add, multiply, map, sqrt, subtract, inv, size, max, identity }: Dependencies) => {
    const _maxIterations = 1e3;
    const _tolerance = 1e-6;

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
    function _sqrtmScaled(A: Scalar[][] | Matrix): Scalar[][] | Matrix {
      const data = (isMatrix(A) ? (A as Matrix).valueOf() : A) as Scalar[][];
      if (!data.every((row) => row.every((v) => typeof v === 'number'))) {
        return _denmanBeavers(A);
      }
      const range = entryRange(data as unknown as number[][]);
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
              return _sqrtmScaled(A as Scalar[][] | Matrix);
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
