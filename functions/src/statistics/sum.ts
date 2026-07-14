import { containsCollections, deepForEach, reduce } from '../utils/collection.js';
import { pairwiseSum } from '@danielsimonjr/mathts-core';
import { factory } from '../utils/factory.js';
import { improveErrorMessage } from './utils/improveErrorMessage.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

// Minimum array length for WASM to be beneficial

/**
 * Check if an array is a flat array of plain numbers
 */
function isFlatNumberArray(arr: unknown[]): arr is number[] {
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      return false;
    }
  }
  return true;
}

// Type definitions for sum
interface MatrixType {
  forEach(callback: (value: unknown) => void, skipZeros: boolean, recurse: boolean): void;
  map(callback: (value: unknown) => unknown, skipZeros: boolean, recurse: boolean): MatrixType;
  size(): number[];
  valueOf(): unknown[] | unknown[][];
  create(data: unknown[], datatype?: string): MatrixType;
  datatype(): string | undefined;
}

interface SumDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  add: TypedFunction;
  numeric: TypedFunction;
  parseNumberWithConfig: (value: string) => unknown;
}

const name = 'sum';
const dependencies = ['typed', 'config', 'add', 'numeric', 'parseNumberWithConfig'];

export const createSum = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, add, numeric, parseNumberWithConfig }: SumDependencies) => {
    /**
     * Compute the sum of a matrix or a list with values.
     * In case of a multidimensional array or matrix, the sum of all
     * elements will be calculated.
     *
     * Syntax:
     *
     *     math.sum(a, b, c, ...)
     *     math.sum(A)
     *     math.sum(A, dimension)
     *
     * Examples:
     *
     *     math.sum(2, 1, 4, 3)               // returns 10
     *     math.sum([2, 1, 4, 3])             // returns 10
     *     math.sum([[2, 5], [4, 3], [1, 7]]) // returns 22
     *
     * See also:
     *
     *    mean, median, min, max, prod, std, variance, cumsum
     *
     * @param {... *} args  A single matrix or multiple scalar values
     * @return {*} The sum of all values
     */
    return typed(name, {
      // sum(string) - single string input
      string: function (x: string): unknown {
        return parseNumberWithConfig(x);
      },

      // sum([a, b, c, d, ...])
      'Array | Matrix': _sum,

      // sum([a, b, c, d, ...], dim)
      'Array | Matrix, number | BigNumber': _nsumDim,

      // sum(a, b, c, d, ...)
      '...': function (args: unknown[]): unknown {
        if (containsCollections(args)) {
          throw new TypeError('Scalar values expected in function sum');
        }

        return _sum(args);
      },
    });

    /**
     * Recursively calculate the sum of an n-dimensional array
     * @param {Array | Matrix} array - Input array or matrix
     * @return {number | BigNumber | Complex | Unit} sum
     * @private
     */
    function _sum(array: unknown[] | MatrixType): unknown {
      // FAST + ACCURATE path for flat arrays of plain numbers: PAIRWISE summation.
      //
      // This replaced a WASM `statsSum` that accumulated naively (`s += x`). Naive accumulation
      // lets the running total grow large while the addends stay small, so error grows as
      // O(n)·eps. Measured on 1e6 copies of 0.1 (exact answer 100000):
      //
      //     naive (what shipped)   relative error 1.3e-11
      //     pairwise (this)        relative error 2.9e-16     <- identical to NumPy's np.sum
      //
      // We were ~46,000x less accurate than NumPy on a bog-standard `sum`, and `mean`, `std`,
      // `var` and every statistic inherit that error. Pairwise costs the same number of additions
      // — there is no trade here, the naive version was simply worse.
      //
      // For catastrophic cancellation (e.g. [1e16, 1, -1e16], which pairwise AND np.sum both
      // annihilate to 0), callers want `fsum` — exported separately.
      if (Array.isArray(array) && isFlatNumberArray(array)) {
        return pairwiseSum(array as number[]);
      }

      // JavaScript fallback for mixed types, BigNumber, Complex, etc.
      let sum: unknown;

      deepForEach(array as Parameters<typeof deepForEach>[0], function (value: unknown) {
        try {
          // Pre-convert string inputs BEFORE addition
          const converted = typeof value === 'string' ? parseNumberWithConfig(value) : value;

          sum = sum === undefined ? converted : add(sum, converted);
        } catch (err) {
          throw improveErrorMessage(err, 'sum', value);
        }
      });

      // Return 0 (in configured type) for empty arrays
      if (sum === undefined) {
        sum = numeric(0, config.number);
      }

      return sum;
    }

    /**
     * Calculate sum along a specified dimension
     * @param {Array | Matrix} array - Input array or matrix
     * @param {number | BigNumber} dim - Dimension to sum along
     * @return {number | BigNumber | Complex | Unit | Array | Matrix} sum
     * @private
     */
    function _nsumDim(array: unknown[] | MatrixType, dim: number | { valueOf(): number }): unknown {
      try {
        const dimValue = typeof dim === 'number' ? dim : dim.valueOf();
        const sum = reduce(array as Parameters<typeof reduce>[0], dimValue, add);
        return sum;
      } catch (err) {
        throw improveErrorMessage(err, 'sum', undefined);
      }
    }
  }
);
