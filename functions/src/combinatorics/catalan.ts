import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';
import { atWorkPrecision, type PrecisionClass } from '../utils/bignumber/work-precision.js';

// Type definitions for combinatorics
type BigNumberType = BigNumber;

type NumericValue = number | BigNumberType;

interface CatalanDependencies {
  typed: TypedFunction;
  addScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  divideScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  multiplyScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  combinations: (n: NumericValue, k: NumericValue) => NumericValue;
  isNegative: (x: NumericValue) => boolean;
  isInteger: (x: NumericValue) => boolean;
}

const name = 'catalan';
const dependencies = [
  'typed',
  'addScalar',
  'divideScalar',
  'multiplyScalar',
  'combinations',
  'isNegative',
  'isInteger',
];

export const createCatalan = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    addScalar,
    divideScalar,
    multiplyScalar,
    combinations,
    isNegative,
    isInteger,
  }: CatalanDependencies) => {
    /**
     * The Catalan Numbers enumerate combinatorial structures of many different types.
     * catalan only takes integer arguments.
     * The following condition must be enforced: n >= 0
     *
     * Syntax:
     *
     *   math.catalan(n)
     *
     * Examples:
     *
     *    math.catalan(3) // returns 5
     *    math.catalan(8) // returns 1430
     *
     * See also:
     *
     *    bellNumbers
     *
     * @param {Number | BigNumber} n    nth Catalan number
     * @return {Number | BigNumber}     Cn(n)
     */
    return typed(name, {
      'number | BigNumber': function (n: NumericValue): NumericValue {
        if (!isInteger(n) || isNegative(n)) {
          throw new TypeError('Non-negative integer value expected in function catalan');
        }

        const compute = (): NumericValue =>
          divideScalar(combinations(multiplyScalar(n, 2), n), addScalar(n, 1));
        if (typeof n === 'number') return compute();
        // The binomial coefficient is n + 1 times the result. With the digits of n + 1 more, a
        // result that fits the precision has an exact binomial coefficient and an exact quotient
        // (#1118). A longer result rounds one time.
        const C = n.constructor as unknown as PrecisionClass;
        return atWorkPrecision(C, C.precision + n.e + 3, () => compute() as BigNumberType);
      },
    });
  }
);
