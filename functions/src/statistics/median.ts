import { containsCollections } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import { improveErrorMessage } from './utils/improveErrorMessage.js';
import type { TypedFunction } from '../core/function/typed.js';
import { findTypedImpl } from '../utils/typed-impl.js';
import { arrayHasNaN } from '../utils/sort-numbers.js';
import { medianNumbers } from '../utils/median-numbers.js';
import {
  flattenForStatistics,
  finiteNumbers,
  isFloatTyped,
  numberGrid,
  reduceNumericMatrix,
  type FloatTyped,
  type StatReduceOptions,
} from './numeric-data.js';

// Type definitions for median
interface MatrixType {
  valueOf(): unknown[] | unknown[][];
}

interface MedianDependencies {
  typed: TypedFunction;
  add: TypedFunction;
  divide: TypedFunction;
  compare: TypedFunction;
  partitionSelect: TypedFunction;
  mapSlices: TypedFunction;
}

const name = 'median';
const dependencies = ['typed', 'add', 'divide', 'compare', 'partitionSelect', 'mapSlices'];

type NumberCompare = (a: number, b: number) => number;

export const createMedian = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, add, divide, compare, partitionSelect, mapSlices }: MedianDependencies) => {
    let cachedNumberCompare: NumberCompare | null | undefined;

    function getNumberCompare(): NumberCompare | null {
      if (cachedNumberCompare === undefined) {
        cachedNumberCompare = findTypedImpl<[number, number], number>(typed, compare, [
          'number',
          'number',
        ]);
      }
      return cachedNumberCompare;
    }

    function flatAllNumbers(flat: unknown[]): boolean {
      for (let i = 0; i < flat.length; i++) {
        if (typeof flat[i] !== 'number') return false;
      }
      return true;
    }
    function medianOfNumbers(xs: ArrayLike<number>, skipNaN: boolean): unknown {
      const data = skipNaN ? finiteNumbers(xs, true) : xs;
      if (data.length === 0) return NaN;
      return _median(Array.isArray(data) ? data : (copyNumbers(data) as number[]));
    }

    function copyNumbers(xs: ArrayLike<number>): number[] {
      const out = new Array<number>(xs.length);
      for (let i = 0; i < xs.length; i++) out[i] = xs[i];
      return out;
    }

    /** Numeric matrices (nested arrays and DenseMatrix) reduce here; BigNumber falls through to mapSlices. */
    function medianAlong(
      array: unknown[] | MatrixType,
      dim: number | { valueOf(): number },
      skipNaN: boolean
    ): unknown {
      if (numberGrid(array)) {
        return reduceNumericMatrix(
          array,
          dim,
          false,
          (xs) => medianOfNumbers(xs, skipNaN) as number
        );
      }
      try {
        return mapSlices(array, dim, (x: unknown) => {
          if (!skipNaN) return _median(x as unknown[] | MatrixType);
          const flat = flattenForStatistics(x as unknown[] | MatrixType | FloatTyped);
          const kept: number[] = [];
          for (let i = 0; i < flat.length; i++) {
            const v = flat[i];
            if (typeof v !== 'number') return _median(x as unknown[] | MatrixType);
            if (!Number.isNaN(v)) kept.push(v);
          }
          if (kept.length === 0) return NaN;
          return _median(kept);
        });
      } catch (err) {
        throw improveErrorMessage(err, 'median', undefined);
      }
    }

    /**
     * Recursively calculate the median of an n-dimensional array
     * @param {Array | Matrix} array - Input array or matrix
     * @return {number | BigNumber | Complex | Unit} median
     * @private
     */
    function _median(array: unknown[] | MatrixType | FloatTyped): unknown {
      try {
        const flat = flattenForStatistics(array);

        const num = flat.length;
        if (num === 0) {
          return NaN;
        }

        const cmpNum = flatAllNumbers(flat) ? getNumberCompare() : null;
        if (cmpNum && !arrayHasNaN(flat as number[])) {
          return medianNumbers(flat as number[]);
        }

        if (num % 2 === 0) {
          // even: return the average of the two middle values
          const mid = num / 2 - 1;
          const right = partitionSelect(flat, mid + 1);

          // array now partitioned at mid + 1, take max of left part
          let left = flat[mid];
          for (let i = 0; i < mid; ++i) {
            if ((compare as (a: unknown, b: unknown) => number)(flat[i], left) > 0) {
              left = flat[i];
            }
          }

          return middle2(left, right);
        } else {
          // odd: return the middle value
          const m = partitionSelect(flat, (num - 1) / 2);

          return middle(m);
        }
      } catch (err) {
        throw improveErrorMessage(err, 'median', undefined);
      }
    }

    // helper function to type check the middle value of the array
    const middle = typed({
      'number | BigNumber | Complex | Unit': function (value: unknown): unknown {
        return value;
      },
    }) as (value: unknown) => unknown;

    // helper function to type check the two middle value of the array
    const middle2 = typed({
      'number | BigNumber | Complex | Unit, number | BigNumber | Complex | Unit': function (
        left: unknown,
        right: unknown
      ): unknown {
        return divide(add(left, right), 2);
      },
    }) as (left: unknown, right: unknown) => unknown;

    /**
     * Compute the median of a matrix or a list with values. The values are
     * sorted and the middle value is returned. In case of an even number of
     * values, the average of the two middle values is returned.
     * Supported types of values are: Number, BigNumber, Unit
     *
     * In case of a (multi dimensional) array or matrix, the median of all
     * elements will be calculated.
     *
     * Syntax:
     *
     *     math.median(a, b, c, ...)
     *     math.median(A)
     *
     * Examples:
     *
     *     math.median(5, 2, 7)        // returns 5
     *     math.median([3, -1, 5, 7])  // returns 4
     *
     * See also:
     *
     *     mean, min, max, sum, prod, std, variance, quantileSeq
     *
     * @param {... *} args  A single matrix or or multiple scalar values
     * @return {*} The median
     */
    return typed(name, {
      // median([a, b, c, d, ...])
      // The return annotations are the public contract: `gen-public-overloads` copies them into
      // the published `.d.ts`. They hold for the types that the overloads name: `number[]`,
      // `number[][]`, `Float64Array` and the public `Matrix` (a `DenseMatrix` or `SparseMatrix`
      // from the matrix package, which store numbers only). At run time these signatures also
      // take BigNumber and Unit elements, and a compat matrix (the `matrix()` result, typed
      // `unknown`), and then return a BigNumber or a Unit. The public types send those inputs
      // to the `unknown` rest overload, so the `as number` casts make no claim about them.
      'Array | Matrix': (array: unknown[] | MatrixType): number => _median(array) as number,
      'Float64Array | Float32Array': (array: FloatTyped): number => _median(array) as number,
      'Array | Matrix, Object': (
        array: unknown[] | MatrixType,
        opts: StatReduceOptions
      ): number => {
        if (opts.skipNaN === true || opts.skipna === true) {
          if (opts.skipNaN === true && opts.skipna === false) {
            throw new TypeError('skipNaN and skipna disagree');
          }
          if (opts.skipNaN === false && opts.skipna === true) {
            throw new TypeError('skipNaN and skipna disagree');
          }
          const finite = finiteNumbers(
            isFloatTyped(array) ? array : (flattenForStatistics(array) as number[]),
            true
          );
          if (finite.length === 0) return NaN;
          return _median(finite) as number;
        }
        return _median(array) as number;
      },
      'Float64Array | Float32Array, Object': (
        array: FloatTyped,
        opts: StatReduceOptions
      ): number => {
        if (opts.skipNaN === true || opts.skipna === true) {
          const finite = finiteNumbers(array, true);
          if (finite.length === 0) return NaN;
          return _median(finite) as number;
        }
        return _median(array) as number;
      },

      // median([a, b, c, d, ...], dim)
      'Array | Matrix, number | BigNumber': (
        _array: unknown[] | MatrixType,
        _dim: number | { valueOf(): number }
      ): number | number[] => medianAlong(_array, _dim, false) as number | number[],

      // median(A, dim, { skipNaN }) — NaNs omitted per slice (NumPy nanmedian axis)
      'Array | Matrix, number | BigNumber, Object': (
        _array: unknown[] | MatrixType,
        _dim: number | { valueOf(): number },
        opts: StatReduceOptions
      ): number | number[] => {
        const skip = opts.skipNaN === true || opts.skipna === true;
        if (
          (opts.skipNaN === true && opts.skipna === false) ||
          (opts.skipNaN === false && opts.skipna === true)
        ) {
          throw new TypeError('skipNaN and skipna disagree');
        }
        return medianAlong(_array, _dim, skip) as number | number[];
      },

      // median(a, b, c, d, ...)
      '...': function (args: unknown[]): unknown {
        if (containsCollections(args)) {
          throw new TypeError('Scalar values expected in function median');
        }

        return _median(args);
      },
    });
  }
);
