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

/**
 * The smallest `n` whose Catalan number is above the largest double (C_519 = 1.4e308 is the
 * last finite value).
 */
const CATALAN_OVERFLOW_INDEX = 520;

/**
 * C_n for a number `n`: the product `C_{k+1} = C_k (4k + 2) / (k + 2)`. While the product is a
 * safe integer, the division is exact, so C_n is the exact integer up to C_30. After that the
 * factor is below 4, so nothing overflows before n = 520, and the relative error stays below
 * 1e-15 (the binomial `C(2n, n)` of the factory is `Infinity` from 2n = 282, which lost every
 * value from n = 141, #1102).
 */
function catalanNumber(n: number): number {
  if (n >= CATALAN_OVERFLOW_INDEX) return Infinity;
  let c = 1;
  for (let k = 0; k < n; k++) {
    const product = c * (4 * k + 2);
    c = product <= Number.MAX_SAFE_INTEGER ? product / (k + 2) : c * ((4 * k + 2) / (k + 2));
  }
  return c;
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
        if (typeof n === 'number') return catalanNumber(n);
        // The binomial coefficient is n + 1 times the result. With the digits of n + 1 more, a
        // result that fits the precision has an exact binomial coefficient and an exact quotient
        // (#1118). A longer result rounds one time.
        const C = n.constructor as unknown as PrecisionClass;
        return atWorkPrecision(C, C.precision + n.e + 3, () => compute() as BigNumberType);
      },
    });
  }
);
