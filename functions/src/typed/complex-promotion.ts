/**
 * mathjs-compatible complex promotion for real scalar kernels in the typed layer.
 * Reads the live factory config (including {@link runWithConfig} overlays).
 */
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import { isInteger, isPowZeroAtInfinity } from '../utils/number.js';
import { nthRootNumber, powNumber } from '../plain/number/index.js';
import { factoryScope } from '../factories/scope.js';
import type { ConfigOptions } from '../core/config.js';

/** The live factory config, including {@link runWithConfig} overlays. */
export function liveConfig(): ConfigOptions {
  return factoryScope.config as ConfigOptions;
}

/** Whether `config.predictable` is set (real-only principal values). */
export function isPredictableMode(): boolean {
  return liveConfig().predictable;
}

/**
 * Real log stays a number for NaN, non-negative inputs (including 0 → −∞),
 * and every input when `predictable` is set. Shared by the scalar and the
 * element-wise collection fast path.
 */
export function staysRealLog(x: number): boolean {
  return Number.isNaN(x) || x >= 0 || isPredictableMode();
}

/** Natural log for a real scalar — promotes to Complex when allowed. */
export function logReal(x: number): number | Complex {
  if (staysRealLog(x)) {
    return Math.log(x);
  }
  return new Complex(x, 0).log();
}

/** Base-`b` log for real scalars. Both sides promote, matching `log(x)/log(base)`. */
export function logRealBase(x: number, base: number): number | Complex {
  const lnX = logReal(x);
  const lnB = logReal(base);
  if (typeof lnX === 'number' && typeof lnB === 'number') {
    return lnX / lnB;
  }
  const cx = typeof lnX === 'number' ? new Complex(lnX, 0) : lnX;
  const cb = typeof lnB === 'number' ? new Complex(lnB, 0) : lnB;
  return cx.divide(cb);
}

/** Base-10 log. Non-negative inputs and NaN never read config. */
export function log10Real(x: number): number | Complex {
  if (staysRealLog(x)) {
    return Math.log10(x);
  }
  return (logReal(x) as Complex).divide(new Complex(Math.LN10, 0));
}

/** Base-2 log. Non-negative inputs and NaN never read config. */
export function log2Real(x: number): number | Complex {
  if (staysRealLog(x)) {
    return Math.log2(x);
  }
  return (logReal(x) as Complex).divide(new Complex(Math.LN2, 0));
}

/** Real domain of log1p: NaN, `x >= -1`, or predictable mode. */
export function staysRealLog1p(x: number): boolean {
  return Number.isNaN(x) || x >= -1 || isPredictableMode();
}

/**
 * log(1+x). The real domain is `x >= -1` (log1p(-1) is -Infinity).
 * Values below that are the principal log of `1+x`.
 */
export function log1pReal(x: number): number | Complex {
  if (staysRealLog1p(x)) {
    return Math.log1p(x);
  }
  const re = x + 1;
  return new Complex(Math.log(Math.abs(re)), Math.atan2(0, re));
}

/** Real square root: NaN, non-negative, or predictable mode. NaN stays NaN. */
export function staysRealSqrt(x: number): boolean {
  return Number.isNaN(x) || x >= 0 || isPredictableMode();
}

/**
 * Square root of a number, with the `predictable` option given. The typed `sqrt` and the factory
 * `sqrt` share this kernel. NaN, a non-negative value or `predictable` gives `Math.sqrt(x)`. A
 * negative value otherwise gives the Complex `sqrt(-x) i`.
 */
export function sqrtNumberWith(
  x: number,
  predictable: boolean,
  ComplexClass = Complex
): number | Complex {
  if (Number.isNaN(x) || x >= 0 || predictable) {
    return Math.sqrt(x);
  }
  return new ComplexClass(0, Math.sqrt(-x));
}

/**
 * Square root of a BigNumber, with the `predictable` option given. A negative value goes to the
 * number path and gives a Complex, as in mathjs. With `predictable`, the BigNumber square root
 * is the result (NaN for a negative value).
 */
export function sqrtBigNumberWith(
  x: BigNumber,
  predictable: boolean,
  ComplexClass = Complex
): BigNumber | Complex {
  if (!x.isNegative() || predictable) {
    return x.sqrt();
  }
  return new ComplexClass(0, Math.sqrt(-x.toNumber()));
}

/**
 * Raise a BigNumber to a BigNumber power, with the `predictable` option given. The typed `pow`
 * and the factory `pow` share this kernel. An integer exponent, a non-negative base or
 * `predictable` gives the BigNumber power (NaN for a negative base under `predictable`). A
 * negative base with a non-integer exponent otherwise gives the Complex power of the number
 * values, as in mathjs.
 */
export function powBigNumberWith(
  x: BigNumber,
  y: BigNumber,
  predictable: boolean
): BigNumber | Complex {
  if (y.isInteger() || x.gte(0) || predictable) {
    return x.pow(y);
  }
  return new Complex(x.toNumber(), 0).pow(y.toNumber());
}

/**
 * Natural logarithm of a BigNumber, with the `predictable` option given. A non-negative value or
 * `predictable` gives the BigNumber logarithm (NaN for a negative value under `predictable`). A
 * negative value otherwise gives the Complex logarithm of the number value, as in mathjs.
 */
export function logBigNumberWith(x: BigNumber, predictable: boolean): BigNumber | Complex {
  if (!x.isNegative() || predictable) {
    return x.ln();
  }
  return new Complex(x.toNumber(), 0).log();
}

/**
 * log(1 + x) of a BigNumber, with the `predictable` option given. When 1 + x is not negative, or
 * with `predictable`, the result is the BigNumber logarithm of 1 + x. Otherwise the result is the
 * Complex logarithm of the number value 1 + x, as in mathjs.
 */
export function log1pBigNumberWith(x: BigNumber, predictable: boolean): BigNumber | Complex {
  // x.add(1) rounds to the precision (#1118) and loses a small x. The log1p method keeps it.
  if (!x.lessThan(-1) || predictable) {
    return x.log1p();
  }
  return new Complex(x.add(1).toNumber(), 0).log();
}

/** Square root. Non-negative inputs and NaN never read config. */
export function sqrtReal(x: number): number | Complex {
  if (Number.isNaN(x) || x >= 0) {
    return Math.sqrt(x);
  }
  return sqrtNumberWith(x, isPredictableMode());
}

/**
 * Real `pow` with mathjs principal-value / predictable rules (factory parity).
 */
export function powReal(x: number, y: number): number | Complex {
  // Positive bases never promote. Skip the config read on that hot path.
  if (x >= 0 || isInteger(y)) {
    return powNumber(x, y);
  }

  const predictable = isPredictableMode();

  // x < 0 and y is not an integer. Odd-denominator rationals stay real.
  if (predictable) {
    try {
      const yFrac = Fraction.fromNumber(y);
      const yNum = yFrac.valueOf();
      if (y === yNum || Math.abs((y - yNum) / y) < 1e-14) {
        if (yFrac.denominator % 2n === 1n) {
          const sign = yFrac.numerator % 2n === 0n ? 1 : -1;
          return sign * Math.pow(-x, y);
        }
      }
    } catch {
      // fraction() throws for Infinity, etc.
    }

    // (-2)^Infinity is NaN here; Math.pow would return Infinity.
    if ((x < -1 && y === Infinity) || (x > -1 && y === -Infinity)) {
      return NaN;
    }
    return powNumber(x, y);
  }

  if (isPowZeroAtInfinity(x, y)) {
    return 0;
  }

  return new Complex(x, 0).pow(y);
}

/** Real nth root (odd-root sign rule for negative bases). */
export function nthRootReal(a: number, root: number): number {
  return nthRootNumber(a, root);
}

/** Inverse sine/cosine/tangent-h: NaN and |x| <= 1 stay real. */
export function staysRealUnitInterval(x: number): boolean {
  return Number.isNaN(x) || (x >= -1 && x <= 1) || isPredictableMode();
}

/** Inverse hyperbolic cosine: NaN and x >= 1 stay real. */
export function staysRealAcosh(x: number): boolean {
  return Number.isNaN(x) || x >= 1 || isPredictableMode();
}

/** acsc/asec: NaN and |x| >= 1 stay real. */
export function staysRealAbsAtLeastOne(x: number): boolean {
  return Number.isNaN(x) || x <= -1 || x >= 1 || isPredictableMode();
}

/** acsc(x) = asin(1/x). Real for |x| >= 1; those inputs never read config. */
export function acscReal(x: number): number | Complex {
  if (Object.is(x, 0)) {
    return new Complex(0, Infinity);
  }
  if (staysRealAbsAtLeastOne(x)) {
    return Math.asin(1 / x);
  }
  return new Complex(1 / x, 0).asin();
}

/** asec(x) = acos(1/x). Real for |x| >= 1; those inputs never read config. */
export function asecReal(x: number): number | Complex {
  if (Object.is(x, 0)) {
    return new Complex(0, Infinity);
  }
  if (staysRealAbsAtLeastOne(x)) {
    return Math.acos(1 / x);
  }
  return new Complex(1 / x, 0).acos();
}
