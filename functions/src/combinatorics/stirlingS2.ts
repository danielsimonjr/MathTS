import { factory } from '../utils/factory.js';
import { isNumber } from '../utils/is.js';
import { assertAllocSize, assertLoopOrder } from '../utils/limits.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';

// Type definitions for combinatorics
type BigNumberType = BigNumber;

type NumericValue = number | BigNumberType;

interface StirlingS2Dependencies {
  typed: TypedFunction;
  addScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  subtractScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  multiplyScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  divideScalar: (x: NumericValue, y: NumericValue) => NumericValue;
  pow: (x: NumericValue, y: NumericValue) => NumericValue;
  factorial: (x: NumericValue) => NumericValue;
  combinations: (n: NumericValue, k: NumericValue) => NumericValue;
  isNegative: (x: NumericValue) => boolean;
  isInteger: (x: NumericValue) => boolean;
  number: (x: NumericValue) => number;
  bignumber?: (x: NumericValue) => BigNumberType;
  larger: (x: NumericValue, y: NumericValue) => boolean;
}

/** Largest table (rows times columns) that the call keeps in the shared cache. */
const CACHE_MAX_ENTRIES = 1_000_000;

/** Largest BigNumber table (rows times columns) that the call keeps in the shared cache. */
const BIG_CACHE_MAX_ENTRIES = 10_000;

/** Largest BigNumber table (rows times columns) that the call computes. */
const BIG_MAX_ENTRIES = 300_000;

const name = 'stirlingS2';
const dependencies = [
  'typed',
  'addScalar',
  'subtractScalar',
  'multiplyScalar',
  'divideScalar',
  'pow',
  'factorial',
  'combinations',
  'isNegative',
  'isInteger',
  'number',
  '?bignumber',
  '?bigint',
  'larger',
  'typeOf',
];

export const createStirlingS2 = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    addScalar,
    subtractScalar: _subtractScalar,
    multiplyScalar,
    divideScalar: _divideScalar,
    pow: _pow,
    factorial: _factorial,
    combinations: _combinations,
    isNegative,
    isInteger,
    number,
    bignumber,
    larger,
  }: StirlingS2Dependencies) => {
    const smallCache: NumericValue[][] = [];
    const bigCache: NumericValue[][] = [];
    /**
     * The Stirling numbers of the second kind, counts the number of ways to partition
     * a set of n labelled objects into k nonempty unlabelled subsets.
     * stirlingS2 only takes integer arguments.
     * The following condition must be enforced: k <= n.
     *
     *  If n = k or k = 1 <= n, then s(n,k) = 1
     *  If k = 0 < n, then s(n,k) = 0
     *
     * Note that if either n or k is supplied as a BigNumber, the result will be
     * as well.
     *
     * Syntax:
     *
     *   math.stirlingS2(n, k)
     *
     * Examples:
     *
     *    math.stirlingS2(5, 3) //returns 25
     *
     * See also:
     *
     *    bellNumbers
     *
     * @param {Number | BigNumber} n    Total number of objects in the set
     * @param {Number | BigNumber} k    Number of objects in the subset
     * @return {Number | BigNumber}     S(n,k)
     */
    /**
     * BigNumber add and multiply round to the precision (#1118). The table runs with enough digits
     * to be exact (S(n, k) <= k^n), so the cache holds exact values for every precision. The result
     * rounds to the precision of the call.
     */
    function exactBig(nn: number, nk: number, compute: () => NumericValue): NumericValue {
      const C = bignumber!(1).constructor as unknown as {
        precision: number;
        config(options: { precision: number }): unknown;
      };
      const precision = C.precision;
      const digits = Math.ceil(nn * Math.log10(Math.max(nk, 2))) + 10;
      C.config({ precision: Math.max(precision, digits) });
      let value: NumericValue;
      try {
        value = compute();
      } finally {
        C.config({ precision });
      }
      return (value as BigNumberType).toSignificantDigits(precision) as unknown as NumericValue;
    }

    return typed(name, {
      'number | BigNumber, number | BigNumber': function (
        n: NumericValue,
        k: NumericValue
      ): NumericValue {
        if (!(isNumber(n) && isNumber(k)) && isInteger(n) && isInteger(k)) {
          if (!isNegative(n) && !isNegative(k) && !larger(k, n)) {
            return exactBig(number(n), number(k), () => table(n, k));
          }
        }
        return table(n, k);
      },
    });

    function table(n: NumericValue, k: NumericValue): NumericValue {
      {
        if (!isInteger(n) || isNegative(n) || !isInteger(k) || isNegative(k)) {
          throw new TypeError('Non-negative integer value expected in function stirlingS2');
        } else if (larger(k, n)) {
          throw new TypeError('k must be less than or equal to n in function stirlingS2');
        }

        const big = !(isNumber(n) && isNumber(k));
        const cache = big ? bigCache : smallCache;
        const make = big ? bignumber! : number;
        const nn = number(n);
        const nk = number(k);
        /* See if we already have the value: */
        if (cache[nn] && cache[nn].length > nk) {
          return cache[nn][nk];
        }
        if (big) {
          assertLoopOrder('stirlingS2', '(n + 1) * (k + 1)', (nn + 1) * (nk + 1), BIG_MAX_ENTRIES);
        }
        assertAllocSize('stirlingS2', [nn + 1, nk + 1]);
        /* A large table is computed row by row and is not kept, so memory stays O(k). */
        if ((nn + 1) * (nk + 1) > (big ? BIG_CACHE_MAX_ENTRIES : CACHE_MAX_ENTRIES)) {
          let prev: NumericValue[] = [make(1)];
          for (let m = 1; m <= nn; ++m) {
            const row: NumericValue[] = [make(0)];
            for (let i = 1; i <= m && i <= nk; ++i) {
              row[i] = i === m ? make(1) : addScalar(multiplyScalar(make(i), prev[i]), prev[i - 1]);
            }
            prev = row;
            /* S(m, k) does not decrease in m, so an Infinity stays Infinity. */
            if (!big && m >= nk && row[nk] === Infinity) return Infinity;
          }
          return prev[nk];
        }
        /* Fill the cache */
        for (let m = 0; m <= nn; ++m) {
          if (!cache[m]) {
            cache[m] = [m === 0 ? make(1) : make(0)];
          }
          if (m === 0) continue;
          const row = cache[m];
          const prev = cache[m - 1];
          for (let i = row.length; i <= m && i <= nk; ++i) {
            if (i === m) {
              row[i] = make(1);
            } else {
              row[i] = addScalar(multiplyScalar(make(i), prev[i]), prev[i - 1]);
            }
          }
        }
        return cache[nn][nk];
      }
    }
  }
);
