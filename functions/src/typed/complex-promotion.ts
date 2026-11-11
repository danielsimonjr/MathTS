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

/** Base-`b` log for real scalars. */
export function logRealBase(x: number, base: number): number | Complex {
  const lnX = logReal(x);
  if (typeof lnX === 'number') {
    return Math.log(x) / Math.log(base);
  }
  return (lnX as Complex).divide(new Complex(Math.log(base), 0));
}

/**
 * Real `pow` with mathjs principal-value / predictable rules (factory parity).
 */
export function powReal(x: number, y: number): number | Complex {
  const predictable = isPredictableMode();

  if (predictable && !isInteger(y) && x < 0) {
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
  }

  if (predictable && ((x < -1 && y === Infinity) || (x > -1 && x < 0 && y === -Infinity))) {
    return NaN;
  }

  if (isInteger(y) || x >= 0 || predictable) {
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
