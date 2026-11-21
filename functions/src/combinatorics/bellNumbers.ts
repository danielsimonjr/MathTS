import { factory } from '../utils/factory.js';
import { assertLoopOrder } from '../utils/limits.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';
import { roundedBell } from '../probability/rounded-loop.js';

// Type definitions for combinatorics
type BigNumberType = BigNumber;

type NumericValue = number | BigNumberType;

interface BellNumbersDependencies {
  typed: TypedFunction;
  addScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  isNegative: (x: NumericValue) => boolean;
  isInteger: (x: NumericValue) => boolean;
  stirlingS2: (n: NumericValue, k: NumericValue) => NumericValue;
}

const name = 'bellNumbers';
const dependencies = ['typed', 'addScalar', 'isNegative', 'isInteger', 'stirlingS2'];

export const createBellNumbers = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, addScalar, isNegative, isInteger, stirlingS2 }: BellNumbersDependencies) => {
    /**
     * The Bell Numbers count the number of partitions of a set. A partition is a pairwise disjoint subset of S whose union is S.
     * bellNumbers only takes integer arguments.
     * The following condition must be enforced: n >= 0
     *
     * Syntax:
     *
     *   math.bellNumbers(n)
     *
     * Examples:
     *
     *    math.bellNumbers(3) // returns 5
     *    math.bellNumbers(8) // returns 4140
     *
     * See also:
     *
     *    stirlingS2
     *
     * @param {Number | BigNumber} n    Total number of objects in the set
     * @return {Number | BigNumber}     B(n)
     */
    return typed(name, {
      'number | BigNumber': function (n: NumericValue): NumericValue {
        if (!isInteger(n) || isNegative(n)) {
          throw new TypeError('Non-negative integer value expected in function bellNumbers');
        }

        // B(219) overflows a double, so every larger number saturates.
        if (typeof n === 'number' && n > 218) return Infinity;
        // A BigNumber uses the Bell triangle: O(n^2) additions and O(n) memory.
        if (typeof n !== 'number') {
          const nn = n.toNumber();
          assertLoopOrder('bellNumbers', 'n', nn, 2000);
          // A working-precision triangle with a rounding proof (#1164).
          return roundedBell(nn) as unknown as BigNumberType;
        }

        // Sum (k=0, n) S(n,k).
        let result: NumericValue = 0;
        for (let i = 0; i <= n; i++) {
          result = addScalar(result, stirlingS2(n, i));
        }

        return result;
      },
    });
  }
);
