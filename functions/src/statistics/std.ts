import { factory } from '../utils/factory.js';
import { isBigNumber, isCollection } from '../utils/is.js';
import { deepForEach } from '../utils/collection.js';
import { isDegenerate } from '../utils/real-scale.js';
import { normalizationDivisor, scaledStd } from './utils/scaledStd.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for std
interface MatrixType {
  valueOf(): unknown[] | unknown[][];
}

interface StdDependencies {
  typed: TypedFunction;
  map: TypedFunction;
  mapSlices: TypedFunction;
  sqrt: TypedFunction;
  variance: TypedFunction;
}

const name = 'std';
const dependencies = ['typed', 'map', 'mapSlices', 'sqrt', 'variance'];

export const createStd = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, map, mapSlices, sqrt, variance }: StdDependencies) => {
    /**
     * Compute the standard deviation of a matrix or a  list with values.
     * The standard deviations is defined as the square root of the variance:
     * `std(A) = sqrt(variance(A))`.
     * In case of a (multi dimensional) array or matrix, the standard deviation
     * over all elements will be calculated by default, unless an axis is specified
     * in which case the standard deviation will be computed along that axis.
     *
     * Additionally, it is possible to compute the standard deviation along the rows
     * or columns of a matrix by specifying the dimension as the second argument.
     *
     * Optionally, the type of normalization can be specified as the final
     * parameter. The parameter `normalization` can be one of the following values:
     *
     * - 'unbiased' (default) The sum of squared errors is divided by (n - 1)
     * - 'uncorrected'        The sum of squared errors is divided by n
     * - 'biased'             The sum of squared errors is divided by (n + 1)
     *
     *
     * Syntax:
     *
     *     math.std(a, b, c, ...)
     *     math.std(A)
     *     math.std(A, normalization)
     *     math.std(A, dimension)
     *     math.std(A, dimension, normalization)
     *
     * Examples:
     *
     *     math.std(2, 4, 6)                     // returns 2
     *     math.std([2, 4, 6, 8])                // returns 2.581988897471611
     *     math.std([2, 4, 6, 8], 'uncorrected') // returns 2.23606797749979
     *     math.std([2, 4, 6, 8], 'biased')      // returns 2
     *
     *     math.std([[1, 2, 3], [4, 5, 6]])      // returns 1.8708286933869707
     *     math.std([[1, 2, 3], [4, 6, 8]], 0)    // returns [2.1213203435596424, 2.8284271247461903, 3.5355339059327378]
     *     math.std([[1, 2, 3], [4, 6, 8]], 1)    // returns [1, 2]
     *     math.std([[1, 2, 3], [4, 6, 8]], 1, 'biased') // returns [0.7071067811865476, 1.4142135623730951]
     *
     * See also:
     *
     *    mean, median, max, min, prod, sum, variance
     *
     * @param {Array | Matrix} array
     *                        A single matrix or or multiple scalar values
     * @param {string} [normalization='unbiased']
     *                        Determines how to normalize the variance.
     *                        Choose 'unbiased' (default), 'uncorrected', or 'biased'.
     * @param dimension {number | BigNumber}
     *                        Determines the axis to compute the standard deviation for a matrix
     * @return {*} The standard deviation
     */
    return typed(name, {
      // std([a, b, c, d, ...])
      'Array | Matrix': _std,

      // std([a, b, c, d, ...], normalization)
      'Array | Matrix, string': _std,

      // std([a, b, c, c, ...], dim)
      'Array | Matrix, number | BigNumber': _std,

      // std([a, b, c, c, ...], dim, normalization)
      'Array | Matrix, number | BigNumber, string': _std,

      // std(a, b, c, d, ...)
      '...': function (args: unknown[]): unknown {
        return _std(args);
      },
    });

    /** A result that is NaN, infinite or 0 can come from a square that left the range (#1257). */
    function _degenerate(result: unknown): boolean {
      if (!isCollection(result)) return isDegenerate(result);
      let found = false;
      deepForEach(result as never, (x: unknown) => {
        if (isDegenerate(x)) found = true;
      });
      return found;
    }

    function _leaves(array: unknown): unknown[] {
      const out: unknown[] = [];
      deepForEach(array as never, (x: unknown) => {
        out.push(x);
      });
      return out;
    }

    /**
     * The standard deviation of the values of one slice, with the squares of the deviations
     * scaled by exact powers so that they stay in range. The plain result stays when the scaled
     * formula does not apply (a constant list, a value that is not finite, a Complex value).
     */
    function _scaledSlice(slice: unknown, normalization: string, plain: unknown): unknown {
      if (!isDegenerate(plain)) return plain;
      const divisor = normalizationDivisor(normalization);
      return (divisor && scaledStd(_leaves(slice), divisor)) ?? plain;
    }

    function _scaled(args: unknown[], plainResult: unknown): unknown {
      const normalization = args.find((a) => typeof a === 'string') ?? 'unbiased';
      const dim = args[1];
      const array = args[0];
      if (typeof dim === 'number' || isBigNumber(dim)) {
        return mapSlices(array, dim, (slice: unknown) =>
          _scaledSlice(
            slice,
            normalization as string,
            sqrt((variance as (...a: unknown[]) => unknown)(slice, normalization))
          )
        );
      }
      return _scaledSlice(array, normalization as string, plainResult);
    }

    function _std(...args: unknown[]): unknown {
      const array = args[0] as unknown[] | MatrixType;
      if ((array as unknown[]).length === 0) {
        throw new SyntaxError('Function std requires one or more parameters (0 provided)');
      }

      // std is sqrt(variance) and delegates to it — so it inherits variance's numerically stable
      // corrected two-pass. The former WASM `statsStd` fast path is retired: it used the same
      // one-pass kernel that lost ~7 digits on large-mean data (and was not faster — reductions
      // are memory-bound; see the 2026-07 WASM audit).
      try {
        const v = (variance as (...a: unknown[]) => unknown)(...args);
        const result = isCollection(v) ? map(v, sqrt) : sqrt(v);
        return _degenerate(result) ? _scaled(args, result) : result;
      } catch (err: unknown) {
        if (err instanceof TypeError && err.message.includes(' variance')) {
          throw new TypeError(err.message.replace(' variance', ' std'), { cause: err });
        } else {
          throw err;
        }
      }
    }
  }
);
