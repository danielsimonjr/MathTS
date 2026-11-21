import { factory } from '../utils/factory.js';
import { BigNumber, pairwiseSum, pairwiseDot, SQUARES_SAFE_MIN } from '@danielsimonjr/mathts-core';
import { realScale } from '../utils/real-scale.js';
import type { TypedFunction } from '../core/function/typed.js';
import { typedArrayPairToNumbers } from './numeric-data.js';

// Type definitions for corr
interface MatrixType {
  toArray(): unknown[];
}

/**
 * Check if an array contains only plain numbers
 */
function isPlainNumberArray(arr: unknown[]): arr is number[] {
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      return false;
    }
  }
  return true;
}

/** The smallest positive normal double, 2^-1022. A smaller product has lost digits. */
const MIN_NORMAL = 2 ** -1022;

/**
 * A value above this magnitude can make the sum of the list leave the double range (two values
 * near Number.MAX_VALUE do). 2^500 is far below Number.MAX_VALUE (just under 2^1024) and far
 * above the values that need no scale, so a list of ordinary values is never scaled.
 */
const MEAN_SCALE_LIMIT = 2 ** 500;

/**
 * The values divided by an exact power of 2 when one of them is above MEAN_SCALE_LIMIT in
 * magnitude, else the values. The correlation does not change when a list is multiplied by a
 * positive constant, and a list of values near Number.MAX_VALUE has a mean that overflows (#1285).
 */
function scaledForMean(values: number[]): number[] {
  let top = 0;
  for (const v of values) if (Math.abs(v) > top) top = Math.abs(v);
  if (!(top > MEAN_SCALE_LIMIT)) return values;
  const scale = realScale(values);
  return scale === undefined ? values : values.map((v) => scale.down(v) as number);
}

const name = 'corr';
const dependencies = ['typed', 'matrix', 'sqrt', 'sum', 'subtract', 'multiply', 'divide'];

interface CorrDependencies {
  typed: TypedFunction;
  matrix: (arr: unknown[]) => MatrixType;
  sqrt: TypedFunction;
  sum: TypedFunction;
  subtract: TypedFunction;
  multiply: TypedFunction;
  divide: TypedFunction;
}

export const createCorr = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, sqrt, sum, subtract, multiply, divide }: CorrDependencies) => {
    /**
     * Compute the correlation coefficient of a two list with values, For matrices, the matrix correlation coefficient is calculated.
     *
     * Syntax:
     *
     *     math.corr(A, B)
     *
     * Examples:
     *
     *     math.corr([1, 2, 3, 4, 5], [4, 5, 6, 7, 8])     // returns 1
     *     math.corr([1, 2.2, 3, 4.8, 5], [4, 5.3, 6.6, 7, 8])     //returns 0.9569941688503644
     *     math.corr([[1, 2.2, 3, 4.8, 5], [4, 5.3, 6.6, 7, 8]],[[1, 2.2, 3, 4.8, 5], [4, 5.3, 6.6, 7, 8]])   // returns [1,1]
     *
     * See also:
     *
     *     median, mean, min, max, sum, prod, std, variance
     *
     * @param {Array | Matrix} A The first array or matrix to compute correlation coefficient
     * @param {Array | Matrix} B The second array or matrix to compute correlation coefficient
     * @return {*} The correlation coefficient
     */
    return typed(name, {
      'Array, Array': function (A: unknown[], B: unknown[]): unknown {
        return _corr(A, B);
      },
      'Float64Array, Float64Array': function (A: Float64Array, B: Float64Array): unknown {
        const [a, b] = typedArrayPairToNumbers(A, B);
        return correlation(a, b);
      },
      'Float32Array, Float32Array': function (A: Float32Array, B: Float32Array): unknown {
        const [a, b] = typedArrayPairToNumbers(A, B);
        return correlation(a, b);
      },
      'Matrix, Matrix': function (A: MatrixType, B: MatrixType): unknown {
        const res = _corr(A.toArray(), B.toArray());
        return Array.isArray(res) ? matrix(res) : res;
      },
    });
    /**
     * Calculate the correlation coefficient between two arrays or matrices.
     * @param {Array | Matrix} A
     * @param {Array | Matrix} B
     * @return {*} correlation coefficient
     * @private
     */
    function _corr(A: unknown[], B: unknown[]): unknown {
      const correlations: unknown[] = [];
      if (Array.isArray(A[0]) && Array.isArray(B[0])) {
        if (A.length !== B.length) {
          throw new SyntaxError('Dimension mismatch. Array A and B must have the same length.');
        }
        for (let i = 0; i < A.length; i++) {
          if ((A[i] as unknown[]).length !== (B[i] as unknown[]).length) {
            throw new SyntaxError(
              'Dimension mismatch. Array A and B must have the same number of elements.'
            );
          }
          correlations.push(correlation(A[i] as unknown[], B[i] as unknown[]));
        }
        return correlations;
      } else {
        if (A.length !== B.length) {
          throw new SyntaxError(
            'Dimension mismatch. Array A and B must have the same number of elements.'
          );
        }
        return correlation(A, B);
      }
    }
    /**
     * The correlation of two deviation lists, and the product of their sums of squares.
     * @param {Array} dX   the deviations of the first list
     * @param {Array} dY   the deviations of the second list
     * @returns {{ r: unknown, product: unknown }} the correlation and the product
     */
    function fromDeviations(dX: unknown[], dY: unknown[]): { r: unknown; product: unknown } {
      const sxy = sum(dX.map((dx: unknown, i: number) => multiply(dx, dY[i])));
      const sxx = sum(dX.map((dx: unknown) => multiply(dx, dx)));
      const syy = sum(dY.map((dy: unknown) => multiply(dy, dy)));
      const product = multiply(sxx, syy);
      return { r: divide(sxy, sqrt(product)), product };
    }

    /**
     * `true` when the product of the sums of squares is finite and not 0, or when its type has
     * no range (Complex, Fraction). An infinite product gives a finite r of 0, so r is not the test.
     * @param {unknown} product   the product of the two sums of squares
     * @returns {boolean} whether the product is in the range of its type
     */
    function productInRange(product: unknown): boolean {
      const finite = isFiniteReal(product);
      if (finite === undefined) return true;
      if (!finite) return false;
      return typeof product === 'number' ? product !== 0 : !(product as BigNumber).isZero();
    }

    /** `false` for a number or BigNumber that is NaN or infinite, else `true` or `undefined`. */
    function isFiniteReal(r: unknown): boolean | undefined {
      if (typeof r === 'number') return Number.isFinite(r);
      if (r instanceof BigNumber) return r.isFinite();
      return undefined;
    }

    function correlation(A: unknown[], B: unknown[]): unknown {
      const n = A.length;

      // Numerically stable TWO-PASS Pearson correlation. The previous one-pass "computational
      // formula" (n·ΣXY − ΣX·ΣY over sqrt of the analogous variance terms) catastrophically
      // cancels when the data has a large mean: it subtracts two ~equal ~1e28 quantities, so
      // corr of two ~1e9 series returned 52 (impossible: |corr| ≤ 1) for a true value of −1.
      // Centering by the mean first removes the cancellation entirely. (The old WASM kernel used
      // the same one-pass formula and is retired for correlation.)
      if (isPlainNumberArray(A) && isPlainNumberArray(B)) {
        const x = scaledForMean(A);
        const y = scaledForMean(B);
        const meanX = pairwiseSum(x) / n;
        const meanY = pairwiseSum(y) / n;
        const dX = new Float64Array(n);
        const dY = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          dX[i] = x[i] - meanX;
          dY[i] = y[i] - meanY;
        }
        const sxy = pairwiseDot(dX, dY);
        const sxx = pairwiseDot(dX, dX);
        const syy = pairwiseDot(dY, dY);
        const product = sxx * syy;
        const r = sxy / Math.sqrt(product);
        // Each sum keeps its digits (a sum below SQUARES_SAFE_MIN can hold subnormal squares, also
        // when the product of the two sums is normal: #1280) and the product is a positive normal
        // double: no square left the range.
        if (
          sxx >= SQUARES_SAFE_MIN &&
          syy >= SQUARES_SAFE_MIN &&
          product >= MIN_NORMAL &&
          product <= Number.MAX_VALUE
        ) {
          return r;
        }
        // The squares or their product left the range of a double (#1257, #1280). An infinite
        // product gives a finite r of 0, so r is not the test. The correlation does not change when each
        // deviation list is divided by an exact power of 2. A constant list has no scale and
        // keeps the plain NaN.
        const sx = realScale(Array.from(dX));
        const sy = realScale(Array.from(dY));
        if (sx === undefined || sy === undefined) return r;
        for (let i = 0; i < n; i++) {
          dX[i] = sx.down(dX[i]) as number;
          dY[i] = sy.down(dY[i]) as number;
        }
        return pairwiseDot(dX, dY) / Math.sqrt(pairwiseDot(dX, dX) * pairwiseDot(dY, dY));
      }

      // Generic fallback (BigNumber/Complex/Fraction): the same stable two-pass via typed operators.
      const meanX = divide(sum(A), n);
      const meanY = divide(sum(B), n);
      const dX = A.map((x: unknown) => subtract(x, meanX));
      const dY = B.map((y: unknown) => subtract(y, meanY));
      const plain = fromDeviations(dX, dY);
      if (productInRange(plain.product)) return plain.r;
      // A square left the range of the type (#1257). The correlation does not change when each
      // deviation list is divided by an exact scale.
      const sx = realScale(dX);
      const sy = realScale(dY);
      if (sx === undefined || sy === undefined) return plain.r;
      return fromDeviations(
        dX.map((v: unknown) => sx.down(v as number)),
        dY.map((v: unknown) => sy.down(v as number))
      ).r;
    }
  }
);
