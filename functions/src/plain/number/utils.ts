import { isInteger } from '../../utils/number.js';

const n1 = 'number';

/** Return true if `x` is a finite integer. */
export function isIntegerNumber(x: number): boolean {
  return isInteger(x);
}
isIntegerNumber.signature = n1;

/** Return true if `x < 0`. */
export function isNegativeNumber(x: number): boolean {
  return x < 0;
}
isNegativeNumber.signature = n1;

/** Return true if `x > 0`. */
export function isPositiveNumber(x: number): boolean {
  return x > 0;
}
isPositiveNumber.signature = n1;

/** Return true if `x === 0`. */
export function isZeroNumber(x: number): boolean {
  return x === 0;
}
isZeroNumber.signature = n1;

/** Return true if `x` is NaN (`Number.isNaN`). */
export function isNaNNumber(x: number): boolean {
  return Number.isNaN(x);
}
isNaNNumber.signature = n1;
