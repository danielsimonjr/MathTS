const n1 = 'number';
const n2 = 'number, number';

/** Return true if `x` is 0 or NaN. */
export function notNumber(x: number): boolean {
  return !x;
}
notNumber.signature = n1;

/** Return true if `x` or `y` is truthy (not 0 and not NaN). */
export function orNumber(x: number, y: number): boolean {
  return !!(x || y);
}
orNumber.signature = n2;

/** Return true if exactly one of `x` and `y` is truthy (not 0 and not NaN). */
export function xorNumber(x: number, y: number): boolean {
  return !!x !== !!y;
}
xorNumber.signature = n2;

/** Return true if `x` and `y` are both truthy (not 0 and not NaN). */
export function andNumber(x: number, y: number): boolean {
  return !!(x && y);
}
andNumber.signature = n2;
