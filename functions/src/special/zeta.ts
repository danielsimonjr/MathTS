import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber as BigNumberType } from '../types.js';
import { atWorkPrecision, type PrecisionClass } from '../utils/bignumber/work-precision.js';

// Type definitions for zeta function
interface ComplexType {
  re: number;
  im: number;
}

interface ComplexConstructor {
  new (re: number, im?: number): ComplexType;
  (re: number, im?: number): ComplexType;
}

interface BigNumberConstructor extends PrecisionClass {
  new (value: number | string): BigNumberType;
  (value: number | string): BigNumberType;
  piAt(): BigNumberType;
}

/** log10(3 + sqrt(8)): the Borwein series gains this many digits per term. */
const BORWEIN_DIGITS_PER_TERM = Math.log10(3 + Math.sqrt(8));
/** Guard digits of the Borwein series of a BigNumber: once in the term count, twice in the work precision. */
const BORWEIN_GUARD_DIGITS = 10;

type NumericValue = number | BigNumberType | ComplexType;

/** d(k, n) of the Borwein series for an integer k from 0 to n. */
type DFn = (k: NumericValue) => NumericValue;
/** Builds the d(k, n) function for one n, with a faster method than the sum of factorials. */
type DTable = (n: number, createValue: (value: number) => NumericValue) => DFn;

/** A scalar arithmetic op used here within the NumericValue domain. */
type NumericFn = (...args: NumericValue[]) => NumericValue;

interface ZetaDependencies {
  typed: TypedFunction;
  multiply: NumericFn;
  pow: NumericFn;
  divide: NumericFn;
  factorial: NumericFn;
  equal: TypedFunction;
  smallerEq: TypedFunction;
  isBounded: TypedFunction;
  isNegative: TypedFunction;
  gamma: NumericFn;
  sin: NumericFn;
  subtract: NumericFn;
  add: NumericFn;
  Complex?: ComplexConstructor;
  BigNumber?: BigNumberConstructor;
  pi: number | BigNumberType;
}

const name = 'zeta';
const dependencies = [
  'typed',
  'multiply',
  'pow',
  'divide',
  'factorial',
  'equal',
  'smallerEq',
  'isBounded',
  'isNegative',
  'gamma',
  'sin',
  'subtract',
  'add',
  '?Complex',
  '?BigNumber',
  'pi',
];

export const createZeta = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    multiply,
    pow,
    divide,
    factorial,
    equal,
    smallerEq,
    isBounded,
    isNegative,
    gamma,
    sin,
    subtract,
    add,
    Complex,
    BigNumber,
    pi,
  }: ZetaDependencies) => {
    /**
     * Compute the Riemann Zeta function of a value using an infinite series for
     * all of the complex plane using Riemann's Functional equation.
     *
     * Based off the paper by Xavier Gourdon and Pascal Sebah
     * ( http://numbers.computation.free.fr/Constants/Miscellaneous/zetaevaluations.pdf )
     *
     * Implementation and slight modification by Anik Patel
     *
     * Accuracy (GC6, verified 2026-06-29 against mpmath dps=50): ~12-14
     * significant digits for complex arguments, including the critical strip
     * (Re ∈ [0.3, 0.7], |Im| up to ~40). An earlier note here said "about 6
     * digits"; that was pessimistic — the audit harness
     * (tools/math-correctness-audit) measures max rel.err ~1.8e-14.
     *
     * Syntax:
     *
     *    math.zeta(n)
     *
     * Examples:
     *
     *    math.zeta(5)       // returns 1.0369277551433895
     *    math.zeta(-0.5)    // returns -0.2078862249773449
     *    math.zeta(math.i)  // returns 0.0033002236853253153 - 0.4181554491413212i
     *
     * See also:
     *    erf
     *
     * @param {number | Complex | BigNumber} s   A Real, Complex or BigNumber parameter to the Riemann Zeta Function
     * @return {number | Complex | BigNumber}    The Riemann Zeta of `s`
     */
    function zetaNumber(s: number): number {
      return zetaNumeric(
        s,
        (value: number) => value,
        () => 20,
        () => pi as number
      );
    }

    return typed(name, {
      number: zetaNumber,
      BigNumber: (s: BigNumberType): BigNumberType => {
        // The error of n Borwein terms is about (3 + sqrt(8))^-n, so n follows the precision of
        // the BigNumber and not config.relTol: 12 digits of relTol gave 8 correct digits (#1166).
        // The terms d(k, n) are sums of positive numbers and the alternating sum is of the size of
        // its first term, so the series does not cancel: a few guard digits are enough.
        const precision = BigNumber!.precision;
        const digits = Math.ceil((precision + BORWEIN_GUARD_DIGITS) / BORWEIN_DIGITS_PER_TERM);
        return atWorkPrecision(BigNumber!, precision + 2 * BORWEIN_GUARD_DIGITS, () =>
          zetaNumeric(
            s,
            (value: number) => new BigNumber!(value),
            () => digits,
            () => BigNumber!.piAt(),
            borweinD
          )
        );
      },
      Complex: zetaComplex,
    });

    /**
     * Compute the Riemann zeta function of a real number or BigNumber `s`.
     *
     * @param {number | BigNumber} s
     * @param {(value: number) => number | BigNumber} createValue
     * @param {(value: number | BigNumber | Complex) => number} determineDigits
     * @returns {number | BigNumber}
     */
    function zetaNumeric<T extends number | BigNumberType>(
      s: T,
      createValue: (value: number) => T,
      determineDigits: (value: T) => number,
      getPi: () => NumericValue,
      dTable?: DTable
    ): T {
      // NaN is the only value not equal to itself. Without the guard, !isBounded(NaN) gives 1.
      if (!equal(s, s)) {
        return createValue(NaN);
      }
      if (equal(s, 0)) {
        return createValue(-0.5);
      }
      if (equal(s, 1)) {
        return createValue(NaN);
      }
      if (!isBounded(s)) {
        return isNegative(s) ? createValue(NaN) : createValue(1);
      }

      return zeta(s, createValue, determineDigits, (s: T) => s as number, getPi, dTable) as T;
    }

    /**
     * Compute the Riemann zeta function of a complex number `s`.
     *
     * @param {Complex} s
     * @returns {Complex}
     */
    function zetaComplex(s: ComplexType): ComplexType {
      if (s.re === 0 && s.im === 0) {
        return new Complex!(-0.5);
      }
      // The simple pole is only at the POINT s = 1, not the whole line Re = 1.
      // ζ(1 + it) for t ≠ 0 is finite (e.g. ζ(1+i) = 0.5822 − 0.9268i); the old
      // `s.re === 1` guard wrongly returned NaN across the entire vertical line.
      if (s.re === 1 && s.im === 0) {
        return new Complex!(NaN, NaN);
      }
      if (s.re === Infinity && s.im === 0) {
        return new Complex!(1);
      }
      if (s.im === Infinity || s.re === -Infinity) {
        return new Complex!(NaN, NaN);
      }

      return zeta(
        s,
        (value: number) => value,
        (s: ComplexType) => Math.round(1.3 * 15 + 0.9 * Math.abs(s.im)),
        (s: ComplexType) => s.re,
        () => pi as number
      ) as ComplexType;
    }

    /**
     * Compute the zeta function for any numeric type. Use the reflection formula if
     * `Re(s) < 0`, and the Borwein series otherwise.
     *
     * @param {number | BigNumber | Complex} s
     * @param {(value: number) => number | BigNumber | Complex} createValue
     * @param {(value: number | BigNumber | Complex) => number} determineDigits
     * @param {(value: number | BigNumber | Complex) => number} getRe
     * @returns {*|number}
     */
    function zeta<T extends NumericValue>(
      s: T,
      createValue: (value: number) => NumericValue,
      determineDigits: (value: T) => number,
      getRe: (value: T) => number,
      getPi: () => NumericValue,
      dTable?: DTable
    ): NumericValue {
      const n = determineDigits(s);
      // Reflect for the entire left half-plane (Re(s) < 0), not just Re(s) ≤ -(n-1)/2. The direct
      // Borwein series suffers catastrophic cancellation for negative Re — its terms d(k,n)/kˢ grow
      // like k^|Re s| and alternate — so e.g. ζ(-3) came out ~1.5e-7 off its exact value 1/120. The
      // functional equation routes it through ζ(1-s) with Re(1-s) > 1 (where the series is most
      // accurate) times an accurate prefactor. Re(s) ≥ 0 keeps the verified-accurate direct path
      // (critical strip included).
      if (getRe(s) >= 0) {
        return f(s, createValue(n), createValue, dTable?.(n, createValue));
      } else {
        // Function Equation for reflection to x < 1
        const piValue = getPi();
        let c = multiply(pow(2, s), pow(piValue, subtract(s, 1)));
        c = multiply(c, sin(multiply(divide(piValue, 2), s)));
        c = multiply(c, gamma(subtract(1, s)));
        return multiply(
          c,
          zeta(subtract(1, s) as T, createValue, determineDigits, getRe, getPi, dTable)
        );
      }
    }

    /**
     * Calculate a portion of the sum
     * @param {number | BigNumber} k   a positive integer
     * @param {number | BigNumber} n   a positive integer
     * @return {number}    the portion of the sum
     **/
    function d(k: NumericValue, n: NumericValue): NumericValue {
      let S = k;
      for (let j = k; smallerEq(j, n); j = add(j, 1)) {
        const factor = divide(
          multiply(factorial(add(n, subtract(j, 1))), pow(4, j)),
          multiply(factorial(subtract(n, j)), factorial(multiply(2, j)))
        );
        S = add(S, factor);
      }

      return multiply(n, S);
    }

    /**
     * Calculate the positive Riemann Zeta function
     * @param {number} s   a real or complex number with s.re > 1
     * @param {number} n   a positive integer
     * @param {(number) => number | BigNumber | Complex} createValue
     * @return {number}    Riemann Zeta of s
     **/
    function f(
      s: NumericValue,
      n: NumericValue,
      createValue: (value: number) => NumericValue,
      dAt: DFn = (k) => d(k, n)
    ): NumericValue {
      const c = divide(1, multiply(dAt(createValue(0)), subtract(1, pow(2, subtract(1, s)))));
      let S = createValue(0);
      for (let k = createValue(1); smallerEq(k, n); k = add(k, 1)) {
        S = add(S, divide(multiply((-1) ** ((k as number) - 1), dAt(k)), pow(k, s)));
      }
      return multiply(c, S);
    }

    /**
     * The values d(0, n) to d(n, n) at once. The term t(j) = (n + j - 1)! 4^j / ((n - j)! (2j)!)
     * follows t(j - 1) by the ratio 4 (n + j - 1) (n - j + 1) / (2j (2j - 1)), so the table needs
     * n steps and not n^2 factorials. All terms are positive, and d(k, n) = n (k + t(k) + ... +
     * t(n)), so the suffix sums have no cancellation.
     * @param {number} n   the number of terms
     * @param {(number) => number | BigNumber} createValue
     * @returns {(k: number | BigNumber) => number | BigNumber}   d(k, n) for an integer k from 0 to n
     */
    function borweinD(n: number, createValue: (value: number) => NumericValue): DFn {
      const terms: NumericValue[] = [divide(createValue(1), createValue(n))];
      for (let j = 1; j <= n; j++) {
        terms.push(
          divide(multiply(terms[j - 1], 4 * (n + j - 1) * (n - j + 1)), 2 * j * (2 * j - 1))
        );
      }
      const table: NumericValue[] = new Array<NumericValue>(n + 1);
      let suffix = createValue(0);
      for (let k = n; k >= 0; k--) {
        suffix = add(suffix, terms[k]);
        table[k] = multiply(createValue(n), add(suffix, createValue(k)));
      }
      return (k: NumericValue): NumericValue => table[Number(k)];
    }
  }
);
