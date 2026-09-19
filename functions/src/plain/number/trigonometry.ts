import { acosh, asinh, atanh, cosh, sign, sinh, tanh } from '../../utils/number.js';

const n1 = 'number';
const n2 = 'number, number';

/** Return the inverse cosine of `x`, in radians (`Math.acos`). */
export function acosNumber(x: number): number {
  return Math.acos(x);
}
acosNumber.signature = n1;

/** Return the inverse hyperbolic cosine of `x`. */
export function acoshNumber(x: number): number {
  return acosh(x);
}
acoshNumber.signature = n1;

/** Return the inverse cotangent of `x`, computed as `atan(1 / x)`. */
export function acotNumber(x: number): number {
  return Math.atan(1 / x);
}
acotNumber.signature = n1;

/**
 * Return the inverse hyperbolic cotangent of `x`.
 *
 * For a value of `x` that is not finite, the result is 0.
 */
export function acothNumber(x: number): number {
  return Number.isFinite(x) ? (Math.log((x + 1) / x) + Math.log(x / (x - 1))) / 2 : 0;
}
acothNumber.signature = n1;

/** Return the inverse cosecant of `x`, computed as `asin(1 / x)`. */
export function acscNumber(x: number): number {
  return Math.asin(1 / x);
}
acscNumber.signature = n1;

/** Return the inverse hyperbolic cosecant of `x`, computed from `1 / x`. */
export function acschNumber(x: number): number {
  const xInv = 1 / x;
  return Math.log(xInv + Math.sqrt(xInv * xInv + 1));
}
acschNumber.signature = n1;

/** Return the inverse secant of `x`, computed as `acos(1 / x)`. */
export function asecNumber(x: number): number {
  return Math.acos(1 / x);
}
asecNumber.signature = n1;

/** Return the inverse hyperbolic secant of `x`, computed from `1 / x`. */
export function asechNumber(x: number): number {
  const xInv = 1 / x;
  const ret = Math.sqrt(xInv * xInv - 1);
  return Math.log(ret + xInv);
}
asechNumber.signature = n1;

/** Return the inverse sine of `x`, in radians (`Math.asin`). */
export function asinNumber(x: number): number {
  return Math.asin(x);
}
asinNumber.signature = n1;

/** Return the inverse hyperbolic sine of `x`. */
export function asinhNumber(x: number): number {
  return asinh(x);
}
asinhNumber.signature = n1;

/** Return the inverse tangent of `x`, in radians (`Math.atan`). */
export function atanNumber(x: number): number {
  return Math.atan(x);
}
atanNumber.signature = n1;

/** Return the angle, in radians, of the point (`x`, `y`) (`Math.atan2(y, x)`). */
export function atan2Number(y: number, x: number): number {
  return Math.atan2(y, x);
}
atan2Number.signature = n2;

/** Return the inverse hyperbolic tangent of `x`. */
export function atanhNumber(x: number): number {
  return atanh(x);
}
atanhNumber.signature = n1;

/** Return the cosine of `x`, where `x` is in radians (`Math.cos`). */
export function cosNumber(x: number): number {
  return Math.cos(x);
}
cosNumber.signature = n1;

/** Return the hyperbolic cosine of `x`. */
export function coshNumber(x: number): number {
  return cosh(x);
}
coshNumber.signature = n1;

/** Return the cotangent of `x`, computed as `1 / tan(x)`. */
export function cotNumber(x: number): number {
  return 1 / Math.tan(x);
}
cotNumber.signature = n1;

/** Return the hyperbolic cotangent of `x`, computed from `exp(2 * x)`. */
export function cothNumber(x: number): number {
  const e = Math.exp(2 * x);
  return (e + 1) / (e - 1);
}
cothNumber.signature = n1;

/** Return the cosecant of `x`, computed as `1 / sin(x)`. */
export function cscNumber(x: number): number {
  return 1 / Math.sin(x);
}
cscNumber.signature = n1;

/**
 * Return the hyperbolic cosecant of `x`.
 *
 * For `x` equal to 0, the result is positive infinity.
 */
export function cschNumber(x: number): number {
  // consider values close to zero (+/-)
  if (x === 0) {
    return Number.POSITIVE_INFINITY;
  } else {
    return Math.abs(2 / (Math.exp(x) - Math.exp(-x))) * sign(x);
  }
}
cschNumber.signature = n1;

/** Return the secant of `x`, computed as `1 / cos(x)`. */
export function secNumber(x: number): number {
  return 1 / Math.cos(x);
}
secNumber.signature = n1;

/** Return the hyperbolic secant of `x`, computed as `2 / (exp(x) + exp(-x))`. */
export function sechNumber(x: number): number {
  return 2 / (Math.exp(x) + Math.exp(-x));
}
sechNumber.signature = n1;

/** Return the sine of `x`, where `x` is in radians (`Math.sin`). */
export function sinNumber(x: number): number {
  return Math.sin(x);
}
sinNumber.signature = n1;

/** Return the hyperbolic sine of `x`. */
export function sinhNumber(x: number): number {
  return sinh(x);
}
sinhNumber.signature = n1;

/** Return the tangent of `x`, where `x` is in radians (`Math.tan`). */
export function tanNumber(x: number): number {
  return Math.tan(x);
}
tanNumber.signature = n1;

/** Return the hyperbolic tangent of `x`. */
export function tanhNumber(x: number): number {
  return tanh(x);
}
tanhNumber.signature = n1;
