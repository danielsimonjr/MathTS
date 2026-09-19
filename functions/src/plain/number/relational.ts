// Relational operations for plain numbers

const n2 = 'number, number';

/** Return true if `x === y`. The comparison is exact, with no tolerance. */
export function equalNumber(x: number, y: number): boolean {
  return x === y;
}
equalNumber.signature = n2;

/** Return true if `x !== y`. The comparison is exact, with no tolerance. */
export function unequalNumber(x: number, y: number): boolean {
  return x !== y;
}
unequalNumber.signature = n2;

/** Return true if `x < y`. */
export function smallerNumber(x: number, y: number): boolean {
  return x < y;
}
smallerNumber.signature = n2;

/** Return true if `x <= y`. */
export function smallerEqNumber(x: number, y: number): boolean {
  return x <= y;
}
smallerEqNumber.signature = n2;

/** Return true if `x > y`. */
export function largerNumber(x: number, y: number): boolean {
  return x > y;
}
largerNumber.signature = n2;

/** Return true if `x >= y`. */
export function largerEqNumber(x: number, y: number): boolean {
  return x >= y;
}
largerEqNumber.signature = n2;

/**
 * Compare `x` and `y` exactly, with no tolerance.
 *
 * The result is 0 if they are equal, -1 if `x < y`, and 1 in all other cases, which
 * include NaN.
 */
export function compareNumber(x: number, y: number): number {
  if (x === y) return 0;
  if (x < y) return -1;
  return 1;
}
compareNumber.signature = n2;
