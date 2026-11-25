import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';
import { assertLoopOrder, MAX_LOOP_ORDER } from '../utils/limits.js';
import { roundedCatalan } from '../probability/rounded-loop.js';
import type { BigNumber as CoreBigNumber } from '@danielsimonjr/mathts-core';

// Type definitions for combinatorics
type BigNumberType = BigNumber;

type NumericValue = number | BigNumberType;

interface CatalanDependencies {
  typed: TypedFunction;
  isNegative: (x: NumericValue) => boolean;
  isInteger: (x: NumericValue) => boolean;

  multiplyScalar: TypedFunction;

  divideScalar: TypedFunction;

  number: TypedFunction;

  typeOf: TypedFunction;

  bignumber: TypedFunction;

  bigint: TypedFunction;
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
  'multiplyScalar',
  'divideScalar',
  'isNegative',
  'isInteger',
  'number',
  'typeOf',
  '?bignumber',
  '?bigint',
];

export const createCatalan = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, isNegative, isInteger }: CatalanDependencies) => {
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
      'number | BigNumber | bigint': function (
        n: number | BigNumberType | bigint
      ): number | BigNumberType | bigint {
        if (!isInteger(n as NumericValue) || isNegative(n as NumericValue)) {
          throw new TypeError('Non-negative integer value expected in function catalan');
        }

        if (typeof n === 'number') return catalanNumber(n);
        // A bigint input stays exact: the recurrence C(i+1) = C(i) * 2 * (2i+1) / (i+2)
        // divides exactly at every step, so the bigint result is the exact Catalan
        // number (mathjs 15.3.0, #3781; #1564).
        if (typeof n === 'bigint') {
          if (n > BigInt(MAX_LOOP_ORDER)) {
            throw new RangeError(
              `catalan: n = ${n} exceeds the supported maximum of ${MAX_LOOP_ORDER}`
            );
          }
          let c = 1n;
          for (let k = 0n; k < n; k++) c = (c * (4n * k + 2n)) / (k + 2n);
          return c;
        }
        // A working-precision loop with a rounding proof, or the exact bigint loop (#1164).
        assertLoopOrder('catalan', 'n', (n as unknown as CoreBigNumber).toNumber());
        return roundedCatalan(
          (n as unknown as CoreBigNumber).toBigInt()
        ) as unknown as BigNumberType;
      },
    });
  }
);
