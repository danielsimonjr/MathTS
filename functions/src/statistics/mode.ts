import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import { isMatrix, typeOf } from '../utils/is.js';
import { flattenForStatistics, type FloatTyped } from './numeric-data.js';

// Type definitions for mode
interface MatrixType {
  valueOf(): unknown[] | unknown[][];
}

interface ModeDependencies {
  typed: TypedFunction;
  isNaN: TypedFunction;
  isNumeric: (value: unknown) => boolean;
}

const name = 'mode';
const dependencies = ['typed', 'isNaN', 'isNumeric'];

export const createMode = /* #__PURE__ */ factory(name, dependencies, (deps: ModeDependencies) =>
  buildMode(deps, true)
);

export const createMathjsMode = /* #__PURE__ */ factory(
  name,
  dependencies,
  (deps: ModeDependencies) => buildMode(deps, false)
);

function buildMode(
  { typed, isNaN: mathIsNaN, isNumeric }: ModeDependencies,
  includeMathTSExtensions: boolean
) {
  /**
   * Computes the mode of a set of numbers or a list with values(numbers or characters).
   * If there are multiple modes, it returns a list of those values.
   *
   * Syntax:
   *
   *     math.mode(a, b, c, ...)
   *     math.mode(A)
   *
   * Examples:
   *
   *     math.mode(2, 1, 4, 3, 1)                            // returns [1]
   *     math.mode([1, 2.7, 3.2, 4, 2.7])                    // returns [2.7]
   *     math.mode(1, 4, 6, 1, 6)                             // returns [1, 6]
   *     math.mode('a','a','b','c')                           // returns ["a"]
   *     math.mode(1, 1.5, 'abc')                             // returns [1, 1.5, "abc"]
   *
   * `mode` takes no dimension argument: as in mathjs, an extra argument is one more value of
   * the list, so `mode([1, 2], 0)` is `[1, 2, 0]`. A Matrix is no value of the list: `mode(1,
   * matrix)` throws a TypeError. Pass the Matrix alone, or its `toArray()`.
   *
   * See also:
   *
   *     median,
   *     mean
   *
   * @param {... *} args  A single matrix
   * @return {*} The mode of all values
   */
  return typed(name, {
    // A list of modes, or NaN for an empty input. `gen-public-overloads` copies this
    // annotation into the published `.d.ts` for `number[]`, `number[][]`, `Float64Array` and
    // the public `Matrix` (numbers only). A list of BigNumber, Unit or string values, or a
    // compat matrix (typed `unknown`), also reaches this signature and returns a list of those
    // values; the public types send those inputs to the `unknown` rest overload.
    'Array | Matrix': (values: unknown[] | MatrixType): number[] | number =>
      _mode(values) as number[] | number,
    ...(includeMathTSExtensions && {
      'Float64Array | Float32Array': (values: FloatTyped): number[] | number =>
        _mode(values) as number[] | number,
    }),

    '...': function (args: unknown[]): unknown {
      return _mode(args);
    },
  });

  /**
   * Calculates the mode in an 1-dimensional array
   * @param {Array | Matrix} values - Input values
   * @return {Array} mode
   * @private
   */
  function _mode(values: unknown[] | MatrixType | FloatTyped): unknown {
    const flat = flattenForStatistics(values);
    const num = flat.length;
    if (num === 0) {
      if (includeMathTSExtensions) return NaN;
      throw new Error('Cannot calculate mode of an empty array');
    }

    const count: Record<string, number> = {};
    let mode: unknown[] = [];
    let max = 0;
    for (let i = 0; i < flat.length; i++) {
      const value = flat[i];

      // A Matrix value would reach the NaN test below, and `isNaN(matrix)` is a Matrix, which
      // is truthy: the false message "array containing NaN values" (#964).
      if (includeMathTSExtensions && isMatrix(value)) {
        // `.type` is the mathjs type name ('DenseMatrix'); the class name is 'MathJSDenseMatrix'.
        const kind = (value as { type?: unknown }).type;
        throw new TypeError(
          'Cannot calculate mode, unexpected type of argument (type: ' +
            (typeof kind === 'string' ? kind : typeOf(value)) +
            ')'
        );
      }

      if (isNumeric(value) && mathIsNaN(value)) {
        throw new Error('Cannot calculate mode of an array containing NaN values');
      }

      if (!(String(value) in count)) {
        count[String(value)] = 0;
      }

      count[String(value)]++;

      if (count[String(value)] === max) {
        mode.push(value);
      } else if (count[String(value)] > max) {
        max = count[String(value)];
        mode = [value];
      }
    }
    return mode;
  }
}
