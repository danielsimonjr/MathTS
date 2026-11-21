import { deepMap } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import { modPow } from '../numbertheory/modular.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for isPrime.
// Uses MathTS core's BigNumber method names (lessThanOrEqual/lessThan/equals/toBigInt), not
// decimal.js's (lte/lt/eq). A BigNumber of 2^32 or more runs the Miller-Rabin test on bigint, so
// no product rounds to the configured precision (#1118, #1164).
interface BigNumberType {
  lessThanOrEqual(n: number): boolean;
  gt(n: number): boolean;
  lessThan(n: number): boolean;
  mod(n: number): BigNumberType;
  equals(n: number): boolean;
  isInteger(): boolean;
  toNumber(): number;
  toBigInt(): bigint;
}

interface IsPrimeDependencies {
  typed: TypedFunction;
}

/** Defines typed zero and small-integer literals for the trial-division primality test. */
export type TrialPrimeConsts<T extends number | bigint> = {
  zero: T;
  one: T;
  two: T;
  three: T;
  five: T;
  six: T;
};

/**
 * Trial-division primality test. `c` supplies typed literals so the loop
 * never mixes `0` with `0n`. Casts are type-only; runtime values stay
 * number or bigint as passed. No `typeof` branch.
 */
export function trialPrime(x: number, c: TrialPrimeConsts<number>): boolean;
export function trialPrime(x: bigint, c: TrialPrimeConsts<bigint>): boolean;
export function trialPrime(x: number | bigint, c: TrialPrimeConsts<number | bigint>): boolean {
  const zero = c.zero as number;
  const one = c.one as number;
  const two = c.two as number;
  const three = c.three as number;
  const five = c.five as number;
  const six = c.six as number;
  const xv = x as number;
  // NaN and +-Infinity are not prime. The trial loop never ends on Infinity.
  if (xv !== xv || xv === Infinity || xv === -Infinity) return false;
  if (xv <= three) return xv > one;
  if (xv % two === zero || xv % three === zero) return false;
  for (let i = five; i * i <= xv; i += six) {
    if (xv % i === zero || xv % (i + two) === zero) return false;
  }
  return true;
}

const NUMBER_TRIAL = { zero: 0, one: 1, two: 2, three: 3, five: 5, six: 6 };
const BIGINT_TRIAL = { zero: 0n, one: 1n, two: 2n, three: 3n, five: 5n, six: 6n };

/** The 13 prime bases 2 to 41: a proof of primality below 3317044064679887385961981. */
const MILLER_RABIN_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

/**
 * The least composite number that passes the Miller-Rabin test for the 13 prime bases 2 to 41
 * (Sorenson and Webster, 2015). Below it the 13 bases decide, above it they do not.
 */
const MILLER_RABIN_PROOF_BOUND = 3317044064679887385961981n;

/**
 * Miller-Rabin primality test of an odd integer of 2^32 or more that no small prime divides.
 *
 * Below 3317044064679887385961981 the 13 prime bases 2 to 41 are a proof. At or above that value
 * the test adds the base of mathjs, `floor(2 * (digits * ln 10)^2)`. The result is then
 * probabilistic, as it is in mathjs: a composite number made to pass these bases can pass it. All
 * products are exact, because the arithmetic is bigint.
 */
function isPrimeBigInt(n: bigint): boolean {
  let d = n - 1n;
  let r = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r += 1;
  }
  const bases = MILLER_RABIN_BASES.slice();
  if (n >= MILLER_RABIN_PROOF_BOUND) {
    bases.push(BigInt(Math.floor(2 * (n.toString().length * Math.LN10) ** 2)));
  }
  for (const a of bases) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let witness = true;
    for (let i = 1; i < r; i += 1) {
      x = (x * x) % n;
      if (x === n - 1n) {
        witness = false;
        break;
      }
    }
    if (witness) return false;
  }
  return true;
}

const name = 'isPrime';
const dependencies = ['typed'];

export const createIsPrime = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: IsPrimeDependencies) => {
    /**
     * Test whether a value is prime: has no divisors other than itself and one.
     * The function supports type `number`, `bignumber`.
     *
     * The function is evaluated element-wise in case of Array or Matrix input.
     *
     * Syntax:
     *
     *     math.isPrime(x)
     *
     * Examples:
     *
     *    math.isPrime(3)                     // returns true
     *    math.isPrime(-2)                    // returns false
     *    math.isPrime(0)                     // returns false
     *    math.isPrime(-0)                    // returns false
     *    math.isPrime(0.5)                   // returns false
     *    math.isPrime('2')                   // returns true
     *    math.isPrime([2, 17, 100])           // returns [true, true, false]
     *
     * See also:
     *
     *    isNumeric, isZero, isNegative, isInteger
     *
     * @param {number | BigNumber | bigint | Array | Matrix} x  Value to be tested
     * @return {boolean}  Returns true when `x` is larger than zero.
     *                    Throws an error in case of an unknown data type.
     */
    return typed(name, {
      number: (x: number): boolean => trialPrime(x, NUMBER_TRIAL),

      bigint: (x: bigint): boolean => trialPrime(x, BIGINT_TRIAL),

      BigNumber: function (n: BigNumberType): boolean {
        if (n.lessThanOrEqual(3)) return n.gt(1);
        if (n.mod(2).equals(0) || n.mod(3).equals(0)) return false;
        if (n.lessThan(Math.pow(2, 32))) {
          const x = n.toNumber();
          for (let i = 5; i * i <= x; i += 6) {
            if (x % i === 0 || x % (i + 2) === 0) {
              return false;
            }
          }
          return true;
        }

        // NaN, Infinity and a fraction are not prime. The test below reads an integer.
        if (!n.isInteger()) return false;
        return isPrimeBigInt(n.toBigInt());
      },

      'Array | Matrix': typed.referToSelf(
        (self: TypedFunction) =>
          (x: unknown): unknown =>
            deepMap(x, self)
      ),
    });
  }
);
