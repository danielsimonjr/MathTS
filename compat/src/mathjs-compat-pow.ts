/**
 * complex.js 2.4.3 `pow` for Complex^Complex on the compat instance only (#1589).
 * Port of `complex.js` `pow` + `logHypot` (no runtime `mathjs` import).
 */
import { Complex } from '@danielsimonjr/mathts-core';

function logHypot(a: number, b: number): number {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (a === 0) return Math.log(absB);
  if (b === 0) return Math.log(absA);
  if (absA < 3000 && absB < 3000) {
    return Math.log(a * a + b * b) * 0.5;
  }
  a = a * 0.5;
  b = b * 0.5;
  return 0.5 * Math.log(a * a + b * b) + Math.LN2;
}

/**
 * Raise `base` to `exponent` with complex.js 2.4.3 semantics (quirks included).
 */
export function compatComplexPow(base: Complex, exponent: Complex): Complex {
  const tIsZero = base.re === 0 && base.im === 0;
  const zIsZero = exponent.re === 0 && exponent.im === 0;
  if (zIsZero) return new Complex(1, 0);
  if (exponent.im === 0) {
    if (base.im === 0 && base.re > 0) {
      return new Complex(Math.pow(base.re, exponent.re), 0);
    }
    if (base.re === 0) {
      switch (((exponent.re % 4) + 4) % 4) {
        case 0:
          return new Complex(Math.pow(base.im, exponent.re), 0);
        case 1:
          return new Complex(0, Math.pow(base.im, exponent.re));
        case 2:
          return new Complex(-Math.pow(base.im, exponent.re), 0);
        case 3:
          return new Complex(0, -Math.pow(base.im, exponent.re));
        default:
          break;
      }
    }
  }
  if (tIsZero && exponent.re > 0) return new Complex(0, 0);
  const arg = Math.atan2(base.im, base.re);
  const loh = logHypot(base.re, base.im);
  const re = Math.exp(exponent.re * loh - exponent.im * arg);
  const im = exponent.im * loh + exponent.re * arg;
  return new Complex(re * Math.cos(im), re * Math.sin(im));
}
