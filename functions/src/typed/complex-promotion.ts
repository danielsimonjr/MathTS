/**
 * mathjs-compatible complex promotion for real scalar kernels in the typed layer.
 * Reads the live factory config (including {@link runWithConfig} overlays).
 */
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { isInteger, isPowZeroAtInfinity } from '../utils/number.js';
import { nthRootNumber, powNumber } from '../plain/number/index.js';
import { factoryScope } from '../factories/scope.js';
import type { ConfigOptions } from '../core/config.js';

function liveConfig(): ConfigOptions {
  return factoryScope.config as ConfigOptions;
}

/** Whether `config.predictable` is set (real-only principal values). */
export function isPredictableMode(): boolean {
  return liveConfig().predictable;
}

/** Natural log for a real scalar — promotes to Complex when allowed. */
export function logReal(x: number): number | Complex {
  if (x === 0) {
    return -Infinity;
  }
  if (x > 0 || isPredictableMode()) {
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

/** Base-10 log. Positive inputs never read config. */
export function log10Real(x: number): number | Complex {
  if (x >= 0 || isPredictableMode()) {
    return Math.log10(x);
  }
  return (logReal(x) as Complex).divide(new Complex(Math.LN10, 0));
}

/** Base-2 log. Positive inputs never read config. */
export function log2Real(x: number): number | Complex {
  if (x >= 0 || isPredictableMode()) {
    return Math.log2(x);
  }
  return (logReal(x) as Complex).divide(new Complex(Math.LN2, 0));
}

/**
 * log(1+x). The real domain is `x >= -1` (log1p(-1) is -Infinity).
 * Values below that are the principal log of `1+x`.
 */
export function log1pReal(x: number): number | Complex {
  if (x >= -1 || isPredictableMode()) {
    return Math.log1p(x);
  }
  const re = x + 1;
  return new Complex(Math.log(Math.abs(re)), Math.atan2(0, re));
}

/** Square root. Non-negative inputs never read config. */
export function sqrtReal(x: number): number | Complex {
  if (x >= 0 || isPredictableMode()) {
    return Math.sqrt(x);
  }
  return new Complex(0, Math.sqrt(-x));
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

/** acsc(x) = asin(1/x). Real for |x| >= 1; those inputs never read config. */
export function acscReal(x: number): number | Complex {
  if (x <= -1 || x >= 1 || isPredictableMode()) {
    return Math.asin(1 / x);
  }
  return new Complex(1 / x, 0).asin();
}

/** asec(x) = acos(1/x). Real for |x| >= 1; those inputs never read config. */
export function asecReal(x: number): number | Complex {
  if (x <= -1 || x >= 1 || isPredictableMode()) {
    return Math.acos(1 / x);
  }
  return new Complex(1 / x, 0).acos();
}
