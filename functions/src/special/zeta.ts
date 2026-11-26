import { bigintToNumber } from '@danielsimonjr/mathts-core/internal';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { BigNumber as BigNumberType } from '../types.js';
import { atWorkPrecision, type PrecisionClass } from '../utils/bignumber/work-precision.js';
import { cosPiScalar, sinPiScalar } from '../wasm/special/scalars.js';

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

/** The BigNumber methods that the exact checks of `zeta` use. */
interface ExactBigNumber {
  isNaN(): boolean;
  isFinite(): boolean;
  isZero(): boolean;
  isNegative(): boolean;
  isInteger(): boolean;
  equals(n: number): boolean;
  sub(n: number): ExactBigNumber;
  abs(): ExactBigNumber;
  mod(n: number): ExactBigNumber;
  /** The decimal exponent of the leading digit. */
  readonly e: number;
}

/** log10(3 + sqrt(8)): the Borwein series gains this many digits per term. */
const BORWEIN_DIGITS_PER_TERM = Math.log10(3 + Math.sqrt(8));
/** Guard digits of the Borwein series of a BigNumber: once in the term count, twice in the work precision. */
const BORWEIN_GUARD_DIGITS = 10;
/** The Euler-Mascheroni constant: zeta(s) = 1 / (s - 1) + EULER_GAMMA + O(s - 1) next to the pole. */
const EULER_GAMMA = 0.5772156649015329;

// B_(2k)/(2k)! for the Euler–Maclaurin tail of the Dirichlet series.
const eulerMaclaurinCoefficients = [
  1 / 12,
  -1 / 720,
  1 / 30240,
  -1 / 1209600,
  1 / 47900160,
  -691 / 1307674368000,
  1 / 74724249600,
  -3617 / 10670622842880000,
  43867 / 5109094217170944000,
  -174611 / 802857662698291200000,
];

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
  smallerEq: TypedFunction;
  gamma: NumericFn;
  lgamma: NumericFn;
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
  'smallerEq',
  'gamma',
  'lgamma',
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
    smallerEq,
    gamma,
    lgamma,
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
      if (Number.isNaN(s) || s === 1 || s === -Infinity) return NaN;
      if (s === Infinity) return 1;
      if (Math.abs(s) <= 1e-4) {
        // Taylor series at zero. Reflection through 1 - s rounds away part of a small s.
        return (
          -0.5 + s * (-0.9189385332046727 + s * (-1.0031782279542925 - s * 1.0007851944770425))
        );
      }
      // A negative even integer is a trivial zero. The reflection gives sin(pi s / 2) = 0 times a
      // gamma that is Infinity above s = -342: 0 * Infinity is NaN. Every even double of size
      // 2^53 or more is an even integer, so zeta(-1e300) is 0 too.
      if (s < 0 && s % 2 === 0) return 0;
      const value = zeta(
        s,
        (value) => value,
        () => 20,
        (value) => value,
        () => pi as number
      ) as number;
      // Below s = -649 the factor pi^(s - 3/2) is 0 and the gamma above is Infinity, so the
      // product is NaN where the value is out of range. Every factor except the sine is positive:
      // the value is the infinity with the sign of sin(pi s / 2), from the exact reduction.
      // Above s = -1 a NaN is not an overflow, so it stays.
      if (Number.isNaN(value) && s < -1 && Number.isFinite(s)) {
        return sinPiScalar(s / 2) < 0 ? -Infinity : Infinity;
      }
      return value;
    }

    /**
     * sin(pi s / 2) with the argument reduced exactly. Math.sin(Math.PI / 2 * s) rounds the
     * product, so next to a nonzero even integer it kept few digits (zeta(-2.0000001) was 8e-10
     * off), and for an odd integer of 2^52 or more its sign was noise. s / 2 is exact. A Complex
     * s = a + bi gives sin(pi a / 2) cosh(pi b / 2) + i cos(pi a / 2) sinh(pi b / 2). A BigNumber
     * is computed at the work precision, which `reflectedZeta` sets to hold the cancellation.
     * @param {number | BigNumber | Complex} s   the argument
     * @param {number | BigNumber} piValue   pi in the type of the call
     * @returns {number | BigNumber | Complex} sin(pi s / 2)
     */
    function sinHalfPi(s: NumericValue, piValue: NumericValue): NumericValue {
      if (typeof s === 'number') return sinPiScalar(s / 2);
      if (typeof (s as ComplexType).re === 'number') {
        const { re, im } = s as ComplexType;
        return new Complex!(
          sinPiScalar(re / 2) * Math.cosh((Math.PI * im) / 2),
          cosPiScalar(re / 2) * Math.sinh((Math.PI * im) / 2)
        );
      }
      return sin(multiply(divide(piValue, 2), s));
    }

    return typed(name, {
      number: zetaNumber,
      bigint: (s: bigint): number => zetaNumber(bigintToNumber(s)),
      BigNumber: (s: BigNumberType): BigNumberType => {
        const x = s as unknown as ExactBigNumber;
        const createValue = (value: number): BigNumberType => new BigNumber!(value);
        if (x.isNaN()) return createValue(NaN);
        if (!x.isFinite()) return createValue(x.isNegative() ? NaN : 1);
        const negative = x.isNegative() && !x.isZero();
        // A negative even integer is a trivial zero. The reflection formula gives a sin(pi * s / 2)
        // of the size of the work precision there, times a factor of up to (1 - s)!: not 0.
        if (negative && x.isInteger() && x.mod(2).isZero()) return createValue(0);
        // The error of n Borwein terms is about (3 + sqrt(8))^-n, so n follows the precision of
        // the BigNumber and not config.relTol: 12 digits of relTol gave 8 correct digits (#1166).
        // The terms d(k, n) are sums of positive numbers and the alternating sum is of the size of
        // its first term, so the series does not cancel: a few guard digits are enough.
        const precision = BigNumber!.precision;
        const digits = Math.ceil((precision + BORWEIN_GUARD_DIGITS) / BORWEIN_DIGITS_PER_TERM);
        if (negative) return reflectedZeta(s, x, precision, digits);
        // Use exact comparison so nearby inputs retain their significant digits.
        if (x.isZero()) return createValue(-0.5);
        if (x.equals(1)) return createValue(NaN);
        // 1 - 2^(1 - s) loses one digit for each digit of |s - 1| below 1.
        const closeToOne = Math.max(0, -x.sub(1).abs().e);
        // At this distance EULER_GAMMA is at or below the last digit of 1 / (s - 1), and the next
        // term of the Laurent series is closeToOne digits below it. The Borwein series would need
        // closeToOne extra digits: 3000 digits gave no result in 170 s.
        if (closeToOne >= precision) {
          return atWorkPrecision(BigNumber!, precision + BORWEIN_GUARD_DIGITS, () =>
            createValue(1).div(s.minus(1)).plus(createValue(EULER_GAMMA))
          );
        }
        return atWorkPrecision(
          BigNumber!,
          precision + 2 * BORWEIN_GUARD_DIGITS + closeToOne,
          () =>
            zeta(
              s,
              createValue,
              () => digits,
              (value: BigNumberType) => value as unknown as number,
              () => BigNumber!.piAt(),
              borweinD
            ) as BigNumberType
        );
      },
      Complex: zetaComplex,
    });

    /**
     * zeta(s) of a negative BigNumber s that is not an even integer, by the reflection formula
     * of `zeta`. The work precision holds three losses: 1 - 2^s of zeta(1 - s) next to the pole
     * (one digit for each digit of |s| below 1), sin(pi s / 2) next to a trivial zero (one digit
     * for each digit of the distance to the nearest even integer below |s|), and the integer
     * digits of s in the arguments of sin and pow. An infinite factor (gamma(1 - s) above the
     * exponent range) gives NaN; the value is then infinite with the sign of sin(pi s / 2),
     * because the other factors are positive. A BigNumber gamma sets its own work precision, so
     * the two half gammas of the reflection need no term of their own here.
     * @param {BigNumber} s   the argument
     * @param {ExactBigNumber} x   s with the exact methods
     * @param {number} precision   the precision of the result
     * @param {number} digits   the number of Borwein terms
     * @returns {BigNumber} zeta(s) to the precision
     */
    function reflectedZeta(
      s: BigNumberType,
      x: ExactBigNumber,
      precision: number,
      digits: number
    ): BigNumberType {
      const integerDigits = Math.max(0, x.e + 1);
      const guess = precision + 2 * BORWEIN_GUARD_DIGITS + integerDigits;
      // s / 2 minus its nearest integer: the distance to the nearest even integer, halved.
      const evenDistance = atWorkPrecision(BigNumber!, guess + 5, () => {
        const half = s.div(2);
        return half.minus(half.round()).abs();
      });
      const poleDigits = Math.max(0, -x.e);
      const zeroDigits = evenDistance.isZero() ? 0 : Math.max(0, x.e - evenDistance.e) + 1;
      const workPrecision = guess + poleDigits + zeroDigits;
      return atWorkPrecision(BigNumber!, workPrecision, () => {
        const value = zeta(
          s,
          (v: number): BigNumberType => new BigNumber!(v),
          () => digits,
          (v: BigNumberType) => v as unknown as number,
          () => BigNumber!.piAt(),
          borweinD
        ) as BigNumberType;
        if (!value.isNaN()) return value;
        const sine = BigNumber!.piAt().mul(s).div(2).sin();
        return new BigNumber!(sine.isNegative() ? -Infinity : Infinity);
      });
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
      if (!Number.isFinite(s.im) || !Number.isFinite(s.re)) {
        return new Complex!(NaN, NaN);
      }

      if (s.im === 0) return new Complex!(zetaNumber(s.re), 0);
      // The direct symmetric reflection is accurate until its gamma factors get too large.
      if (Math.abs(s.im) > 100 || s.re < -224) {
        return s.re < 0 ? zetaComplexReflected(s) : zetaComplexEulerMaclaurin(s);
      }

      return zeta(
        s,
        (value: number) => value,
        (s: ComplexType) => Math.round(1.3 * 15 + 0.9 * Math.abs(s.im)),
        (s: ComplexType) => s.re,
        () => pi as number
      ) as ComplexType;
    }

    function zetaComplexEulerMaclaurin({ re, im }: ComplexType): ComplexType {
      if (re > 54) return new Complex!(1, 0);
      // With N >= |s|, the correction terms shrink by about 1/(2*pi)^2.
      const n = Math.max(32, Math.ceil(Math.hypot(re, im)));
      if (n > 1_000_000) throw new RangeError('zeta: complex argument exceeds the supported range');
      let real = 0;
      let imaginary = 0;
      for (let k = 1; k < n; k++) {
        const log = Math.log(k);
        const radius = Math.exp(-re * log);
        real += radius * Math.cos(im * log);
        imaginary -= radius * Math.sin(im * log);
      }
      const s = new Complex!(re, im);
      const tail = pow(n, subtract(0, s));
      let result = add(
        new Complex!(real, imaginary),
        multiply(tail, add(0.5, divide(n, subtract(s, 1))))
      );
      let correction = multiply(tail, divide(s, n));
      for (let k = 0; k < eulerMaclaurinCoefficients.length; k++) {
        result = add(result, multiply(eulerMaclaurinCoefficients[k], correction));
        const j = 2 * k + 1;
        correction = multiply(correction, divide(add(s, j), n), divide(add(s, j + 1), n));
      }
      return result as ComplexType;
    }

    function zetaComplexReflected(s: ComplexType): ComplexType {
      // Combine the magnitude and phase of the functional equation before exponentiating.
      const halfReal = s.re / 2;
      const halfImaginary = Math.PI * (s.im / 2);
      const magnitude = Math.abs(halfImaginary);
      const sineReal = sinPiScalar(halfReal) * (1 + Math.exp(-2 * magnitude));
      const sineImaginary =
        Math.sign(halfImaginary) * cosPiScalar(halfReal) * -Math.expm1(-2 * magnitude);
      const reflected = new Complex!(1 - s.re, -s.im);
      const value = zetaComplexEulerMaclaurin(reflected);
      const gammaLog = lgamma(reflected) as ComplexType;
      const logTwoPi = Math.log(2 * Math.PI);
      const radiusLog =
        s.re * logTwoPi -
        Math.log(Math.PI) +
        magnitude -
        Math.LN2 +
        Math.log(Math.hypot(sineReal, sineImaginary)) +
        gammaLog.re +
        Math.log(Math.hypot(value.re, value.im));
      const phase =
        s.im * logTwoPi +
        Math.atan2(sineImaginary, sineReal) +
        gammaLog.im +
        Math.atan2(value.im, value.re);
      const component = (part: number): number =>
        Math.sign(part) * Math.exp(radiusLog + Math.log(Math.abs(part)));
      return new Complex!(component(Math.cos(phase)), component(Math.sin(phase)));
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
        return f(
          s,
          createValue(n),
          createValue,
          dTable?.(n, createValue),
          dTable ? integerPowers(s, n, createValue) : undefined
        );
      } else {
        // Symmetric functional equation, with the duplication formula Gamma(1 - s) =
        // 2^-s pi^(-1/2) Gamma((1 - s) / 2) Gamma(1 - s / 2) applied to the usual one:
        //   zeta(s) = pi^(s - 3/2) sin(pi s / 2) Gamma((1 - s) / 2) Gamma(1 - s / 2) zeta(1 - s).
        // The usual form multiplies 2^s pi^(s - 1) sin(pi s / 2) by Gamma(1 - s). Gamma(1 - s)
        // overflows at s = -170.5, where the value of zeta is 1.7e171: zeta(-170.5) was Infinity.
        // Here every partial product stays below the final magnitude over the whole finite range,
        // and for Re(s) < 0 both gamma arguments have a real part above 1/2 (no pole).
        const piValue = getPi();
        let c = multiply(
          pow(piValue, subtract(s, createValue(1.5))),
          gamma(divide(subtract(1, s), 2))
        );
        c = multiply(c, sinHalfPi(s, piValue));
        c = multiply(c, gamma(subtract(1, divide(s, 2))));
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
      dAt: DFn = (k) => d(k, n),
      powAt: DFn = (k) => pow(k, s)
    ): NumericValue {
      // expm1 retains the small difference in Borwein's denominator at the pole.
      const etaFactor =
        typeof s === 'number'
          ? -Math.expm1((1 - s) * Math.LN2)
          : subtract(1, pow(2, subtract(1, s)));
      const c = divide(1, multiply(dAt(createValue(0)), etaFactor));
      let S = createValue(0);
      for (let k = createValue(1); smallerEq(k, n); k = add(k, 1)) {
        S = add(S, divide(multiply((-1) ** ((k as number) - 1), dAt(k)), powAt(k)));
      }
      return multiply(c, S);
    }

    /**
     * The values k^s for k = 1 to n. The power is completely multiplicative, so only a prime k
     * needs a `pow` (an exp and a ln at the work precision when s is not an integer): a composite
     * k is the product of its smallest prime factor and the quotient. A table of n = 275 terms
     * (precision 200) then needs 58 powers and not 275.
     * @param {number | BigNumber} s
     * @param {number} n   the number of terms
     * @param {(number) => number | BigNumber} createValue
     * @returns {(k: number | BigNumber) => number | BigNumber}   k^s for an integer k from 1 to n
     */
    function integerPowers(
      s: NumericValue,
      n: number,
      createValue: (value: number) => NumericValue
    ): DFn {
      const smallestFactor = new Array<number>(n + 1).fill(0);
      const table: NumericValue[] = new Array<NumericValue>(n + 1);
      table[1] = createValue(1);
      for (let k = 2; k <= n; k++) {
        if (smallestFactor[k] === 0) {
          for (let m = k; m <= n; m += k) if (smallestFactor[m] === 0) smallestFactor[m] = k;
          table[k] = pow(createValue(k), s);
        } else {
          table[k] = multiply(table[smallestFactor[k]], table[k / smallestFactor[k]]);
        }
      }
      return (k: NumericValue): NumericValue => table[Number(k)];
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
