import { factory } from '../utils/factory.js';
import { gammaG, gammaNumber, gammaP } from '../plain/number/index.js';
import { cosPiScalar, sinPiScalar } from '../wasm/special/scalars.js';
import type { TypedFunction } from '../core/function/typed.js';
import { atWorkPrecision, type PrecisionClass } from '../utils/bignumber/work-precision.js';

// Type definitions for gamma
interface ComplexType {
  re: number;
  im: number;
  add(n: number | ComplexType): ComplexType;
  sub(n: number | ComplexType): ComplexType;
  div(n: ComplexType): ComplexType;
  mul(n: number | ComplexType): ComplexType;
  neg(): ComplexType;
  exp(): ComplexType;
  sin(): ComplexType;
  pow(n: ComplexType): ComplexType;
  log(): ComplexType;
}

interface ComplexConstructor {
  new (re: number, im?: number): ComplexType;
}

interface BigNumberType {
  isInteger(): boolean;
  isNegative(): boolean;
  isZero(): boolean;
  isFinite(): boolean;
  isNaN(): boolean;
  abs(): BigNumberType;
  round(): BigNumberType;
  sin(): BigNumberType;
  sub(n: number | BigNumberType): BigNumberType;
  mul(n: number | BigNumberType): BigNumberType;
  add(n: number | BigNumberType): BigNumberType;
  div(n: number | BigNumberType): BigNumberType;
  ln(): BigNumberType;
  exp(): BigNumberType;
  /** The decimal exponent of the leading digit. */
  readonly e: number;
  toNumber(): number;
  toSignificantDigits(digits: number): BigNumberType;
}

interface BigNumberConstructor extends PrecisionClass {
  fromNumber(n: number): BigNumberType;
  fromBigInt(n: bigint): BigNumberType;
  piAt(): BigNumberType;
}

/** The extra digits that the Stirling series keeps below the last digit of the result. */
const STIRLING_GUARD_DIGITS = 10;
/** n! of a BigNumber above this has the Stirling series. Below it the exact product is cheaper. */
const STIRLING_MIN = 10000;
/** The Stirling series also needs n above this number times the precision (its terms must shrink). */
const STIRLING_PER_DIGIT = 100;

/**
 * The tangent numbers T(1) to T(count) (1, 2, 16, 272, 7936, ...), by the integer algorithm of
 * Brent and Harvey. The Bernoulli numbers follow: B(2k) = (-1)^(k-1) * 2k * T(k) / (4^k (4^k - 1)).
 */
function tangentNumbers(count: number): bigint[] {
  const t: bigint[] = new Array<bigint>(count + 1).fill(0n);
  t[1] = 1n;
  for (let k = 2; k <= count; k++) t[k] = BigInt(k - 1) * t[k - 1];
  for (let k = 2; k <= count; k++) {
    for (let j = k; j <= count; j++) t[j] = BigInt(j - k) * t[j - 1] + BigInt(j - k + 2) * t[j];
  }
  return t;
}

interface GammaDependencies {
  typed: TypedFunction;
  multiplyScalar: TypedFunction;
  pow: TypedFunction;
  BigNumber: BigNumberConstructor;
  Complex: ComplexConstructor;
}

const name = 'gamma';
const dependencies = ['typed', 'multiplyScalar', 'pow', 'BigNumber', 'Complex'];

export const createGamma = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    multiplyScalar: _multiplyScalar,
    pow: _pow,
    BigNumber,
    Complex,
  }: GammaDependencies) => {
    /**
     * Compute the gamma function of a value using Lanczos approximation for
     * small values, and an extended Stirling approximation for large values.
     *
     * To avoid confusion with the matrix Gamma function, this function does
     * not apply to matrices.
     *
     * Syntax:
     *
     *    math.gamma(n)
     *
     * Examples:
     *
     *    math.gamma(5)       // returns 24
     *    math.gamma(-0.5)    // returns -3.5449077018110335
     *    math.gamma(math.i)  // returns -0.15494982830180973 - 0.49801566811835596i
     *
     * See also:
     *
     *    combinations, factorial, permutations
     *
     * @param {number | BigNumber | Complex} n   A real or complex number
     * @return {number | BigNumber | Complex}    The gamma of `n`
     */

    function gammaComplex(n: ComplexType): number | ComplexType {
      if (n.im === 0) {
        return gammaNumber(n.re);
      }

      // Lanczos approximation doesn't work well with real part lower than 0.5
      // So reflection formula is required
      if (n.re < 0.5) {
        // Euler's reflection formula
        // gamma(1-z) * gamma(z) = PI / sin(PI * z)
        // real part of Z should not be integer [sin(PI) == 0 -> 1/0 - undefined]
        // thanks to imperfect sin implementation sin(PI * n) != 0
        // we can safely use it anyway
        const t = new Complex(1 - n.re, -n.im);
        // sin(pi (a + bi)) = sin(pi a) cosh(pi b) + i cos(pi a) sinh(pi b). The real part is
        // reduced exactly (sinPiScalar, cosPiScalar): `r.sin()` of the rounded product pi * a
        // kept only a few digits next to a negative integer.
        const sinPiZ = new Complex(
          sinPiScalar(n.re) * Math.cosh(Math.PI * n.im),
          cosPiScalar(n.re) * Math.sinh(Math.PI * n.im)
        );

        const gammaT = gammaComplex(t);
        return new Complex(Math.PI).div(sinPiZ).div(gammaT as ComplexType);
      }

      // Lanczos approximation
      // z -= 1
      const z = new Complex(n.re - 1, n.im);

      // x = gammaPval[0]
      let x: ComplexType = new Complex(gammaP[0], 0);
      // for (i, gammaPval) in enumerate(gammaP):
      for (let i = 1; i < gammaP.length; ++i) {
        // x += gammaPval / (z + i)
        const gammaPval = new Complex(gammaP[i], 0);
        x = x.add(gammaPval.div(z.add(i)));
      }
      // t = z + gammaG + 0.5
      const t = new Complex(z.re + gammaG + 0.5, z.im);

      // y = sqrt(2 * pi) * t ** (z + 0.5) * exp(-t) * x
      const twoPiSqrt = Math.sqrt(2 * Math.PI);
      if (Math.max(Math.abs(n.re), Math.abs(n.im)) > 100) {
        // Combine the Lanczos factors' logarithms before exponentiating.
        return t.log().mul(z.add(0.5)).sub(t).add(x.log()).add(Math.log(twoPiSqrt)).exp();
      }
      const tpow = t.pow(z.add(0.5));
      const expt = t.neg().exp();

      // y = [x] * [sqrt(2 * pi)] * [t ** (z + 0.5)] * [exp(-t)]
      return x.mul(twoPiSqrt).mul(tpow).mul(expt);
    }

    return typed(name, {
      number: gammaNumber,
      Complex: gammaComplex,
      BigNumber: function (n: BigNumberType): BigNumberType {
        if (n.isNaN()) return n;
        if (n.isInteger()) {
          return n.isNegative() || n.isZero()
            ? BigNumber.fromNumber(Infinity)
            : bigFactorial(exactPredecessor(n));
        }

        if (!n.isFinite()) {
          return BigNumber.fromNumber(n.isNegative() ? NaN : Infinity);
        }

        return n.isNegative() ? reflectedGamma(n) : shiftedGamma(n);
      },
    });

    /**
     * n - 1 for an integer n above zero, with no rounding. `sub` rounds to the precision, so an n
     * with more digits than the precision gave a wrong factorial: at precision 5, gamma(100002)
     * computed 100000! and not 100001!. An n above 2^53 has an n! that is out of range anyway.
     * @param {BigNumber} n
     * @returns {BigNumber} n - 1
     */
    function exactPredecessor(n: BigNumberType): BigNumberType {
      const value = n.toNumber();
      return Number.isSafeInteger(value) ? BigNumber.fromNumber(value - 1) : n.sub(1);
    }

    /**
     * The number of integer digits of ln(Gamma(m + 1)) for an m above 1. ln(Gamma(m + 1)) is
     * below m ln(m) + 1, so the count is at most the digits of m ln(m) plus one.
     * @param {number} m   a number above 1
     * @returns {number} an upper bound of the integer digits
     */
    function lnGammaIntegerDigits(m: number): number {
      return Math.max(1, Math.ceil(Math.log10(m * Math.max(1, Math.log(m))))) + 1;
    }

    /**
     * Gamma(x) of a positive BigNumber x that is not an integer. The Stirling series needs an
     * argument above the precision, so Gamma(x) = Gamma(x + N + 1) / (x (x + 1) ... (x + N)),
     * with N = max(0, ceil(precision + STIRLING_GUARD_DIGITS - x)). The work precision holds the
     * integer digits of ln(Gamma(x + N + 1)) and the rounding error of the N + 1 factors.
     * @param {BigNumber} x   a finite non-integer above 0
     * @returns {BigNumber} Gamma(x) to the precision
     */
    function shiftedGamma(x: BigNumberType): BigNumberType {
      const precision = BigNumber.precision;
      const xNum = x.toNumber();
      const shift = Math.max(0, Math.ceil(precision + STIRLING_GUARD_DIGITS - xNum));
      const m = xNum + shift;
      const workPrecision =
        precision + STIRLING_GUARD_DIGITS + lnGammaIntegerDigits(m) + 2 * String(shift + 1).length;
      return atWorkPrecision(BigNumber, workPrecision, () => {
        let divisor = x;
        for (let k = 1; k <= shift; k++) divisor = divisor.mul(x.add(k));
        const shifted = x.add(shift);
        const numerator = stirlingFactorial(shifted, m);
        // The shifted argument is at least precision + STIRLING_GUARD_DIGITS, so the series
        // converges; a non-convergence is a defect, not a fallback case.
        if (!numerator) throw new Error('gamma: the Stirling series did not converge');
        return numerator.div(divisor);
      });
    }

    /**
     * Gamma(x) of a negative BigNumber x that is not an integer, by the reflection formula
     * Gamma(x) = pi / (sin(pi x) Gamma(1 - x)). sin(pi x) loses the integer digits of x and one
     * digit for each digit of the distance from x to the nearest integer below 1.
     * @param {BigNumber} x   a finite non-integer below 0
     * @returns {BigNumber} Gamma(x) to the precision
     */
    function reflectedGamma(x: BigNumberType): BigNumberType {
      const precision = BigNumber.precision;
      const integerDigits = Math.max(0, x.e + 1);
      const guess = precision + STIRLING_GUARD_DIGITS + integerDigits;
      const distanceExponent = atWorkPrecision(BigNumber, guess + 5, () =>
        x.sub(x.round()).abs()
      ).e;
      const extra = integerDigits + Math.max(0, -distanceExponent);
      return atWorkPrecision(BigNumber, precision + STIRLING_GUARD_DIGITS + extra, () => {
        const pi = BigNumber.piAt();
        const sine = pi.mul(x).sin();
        return pi.div(sine.mul(shiftedGamma(BigNumber.fromNumber(1).sub(x))));
      });
    }

    /**
     * n! from the Stirling series: ln(n!) = n ln(n) - n + ln(2 pi n) / 2 + sum(B(2k) / (2k (2k - 1)
     * n^(2k - 1))), then exp. The sum stops when a term is below the precision. It returns
     * `undefined` when the terms do not shrink that far, and the caller then multiplies. The work
     * precision keeps the integer digits of ln(n!) too, so the absolute error of ln(n!) is below
     * the last digit of the result.
     * The formula is ln(Gamma(n + 1)), so n can also be a real number that is not an integer.
     * @param {BigNumber} n   a number above 8
     * @param {number} nNum   n as a number
     * @returns {BigNumber | undefined} Gamma(n + 1) to the precision, or undefined
     */
    function stirlingFactorial(n: BigNumberType, nNum: number): BigNumberType | undefined {
      const precision = BigNumber.precision;
      const workPrecision = precision + STIRLING_GUARD_DIGITS + lnGammaIntegerDigits(nNum);
      const termLimit = Math.ceil(workPrecision / 2) + 5;
      const tangent = tangentNumbers(termLimit);
      let converged = false;
      const result = atWorkPrecision(BigNumber, workPrecision, () => {
        let lnFactorial = n.mul(n.ln()).sub(n).add(BigNumber.piAt().mul(2).mul(n).ln().div(2));
        const inverse = BigNumber.fromNumber(1).div(n);
        const inverseSquare = inverse.mul(inverse);
        let power = inverse; // n^-(2k - 1)
        for (let k = 1; k <= termLimit; k++) {
          const scale = 4n ** BigInt(k);
          const divisor = scale * (scale - 1n) * BigInt(2 * k - 1);
          const term = BigNumber.fromBigInt(tangent[k])
            .div(BigNumber.fromBigInt(divisor))
            .mul(power);
          lnFactorial = k % 2 === 1 ? lnFactorial.add(term) : lnFactorial.sub(term);
          if (term.e < -(precision + STIRLING_GUARD_DIGITS)) {
            converged = true;
            break;
          }
          power = power.mul(inverseSquare);
        }
        return lnFactorial.exp();
      });
      return converged ? result : undefined;
    }

    /**
     * Calculate factorial for a BigNumber.
     * BigNumber multiply rounds to the precision (#1118), so the product runs with guard digits
     * and the result rounds one time. Each partial product is not larger than the result. Thus a
     * factorial that fits the precision is exact. Uses core's `.mul` (not decimal.js `.times`)
     * and `.fromNumber` (core's constructor is private).
     * @param {BigNumber} n
     * @returns {BigNumber} Returns the factorial of n
     */
    function bigFactorial(n: BigNumberType): BigNumberType {
      const nNum = n.toNumber();
      if (nNum < 8) {
        return BigNumber.fromNumber([1, 1, 2, 6, 24, 120, 720, 5040][nNum]);
      }

      // An n above the range of a number has an n! far above every exponent bound. The loop below
      // would not end, and the Stirling table would have no size.
      if (!Number.isFinite(nNum)) return BigNumber.fromNumber(Infinity);

      // Above the Stirling limit the product of nNum terms is too slow (n = 1e9 never returned,
      // #1115), and the exact product has far more digits than the precision anyway.
      if (nNum > Math.max(STIRLING_MIN, STIRLING_PER_DIGIT * BigNumber.precision)) {
        const approximate = stirlingFactorial(n, nNum);
        if (approximate) return approximate;
      }

      // The guard digits hold the factor of one step and the rounding error of the nNum steps.
      const guardDigits = String(nNum).length + 10;
      return atWorkPrecision(BigNumber, BigNumber.precision + guardDigits, () => {
        let prod = BigNumber.fromNumber(1);
        for (let k = 2; k <= nNum; k++) {
          prod = prod.mul(k);
        }
        return prod;
      });
    }
  }
);
