/**
 * Rules for reading a value as number data: which typed arrays hold numbers, and how a scalar
 * converts to a number. The typed-function conversions (`MATHTS_CONVERSIONS` in
 * `mathts-typed.ts`) and the readers of numeric functions (`convertToNumber`) use the same rules.
 * This module has no imports, so `@danielsimonjr/mathts-core/internal` carries it without the
 * numeric classes.
 */

/**
 * True for a typed array with number elements: Float64Array, Float32Array, Int32Array, Int16Array,
 * Uint8ClampedArray and the other kinds. BigInt64Array and BigUint64Array hold bigint elements,
 * and a DataView has no elements, so this test excludes them. This is the one rule for "a typed
 * array of numbers" (a vector argument of a numeric function).
 *
 * @param x - Any value.
 * @returns `true` when `x` is a typed array with number elements.
 */
export const isNumberTypedArray = (x: unknown): x is ArrayLike<number> =>
  ArrayBuffer.isView(x) &&
  !(x instanceof DataView) &&
  !(x instanceof BigInt64Array) &&
  !(x instanceof BigUint64Array);

/**
 * Convert a string to a number. `Number()` reads the whole string (hex, exponent, surrounding
 * space); `parseFloat` would read '3abc' as 3.
 *
 * @param s - The string.
 * @returns The number.
 * @throws An `Error` `Cannot convert "..." to a number` when the string is not a number, as in mathjs.
 */
export function stringToNumber(s: unknown): number {
  const n = Number(s as string);
  if (isNaN(n)) throw new Error(`Cannot convert "${String(s)}" to a number`);
  return n;
}

/** Convert a boolean to 1 or 0. */
export const booleanToNumber = (b: unknown): number => (b ? 1 : 0);

/** Convert a bigint to the nearest number. */
export const bigintToNumber = (n: unknown): number => Number(n as bigint);

/** Convert a core Fraction to the nearest number. */
export const fractionToNumber = (f: unknown): number => (f as { toNumber(): number }).toNumber();

/** Convert a core BigNumber to the nearest number. */
export const bigNumberToNumber = (bn: unknown): number => (bn as { valueOf(): number }).valueOf();

/**
 * Read a scalar as a number with the implicit to-number rule of mathjs: a number as it is; a
 * string, a boolean or a bigint through its conversion. A BigNumber, a Fraction and a Complex are
 * not converted: mathjs keeps their type and computes with it, so a caller that holds one takes
 * its typed path (or refuses the value).
 *
 * @param x - Any value.
 * @returns The number, or `undefined` when the implicit rule has no conversion to number
 *   (BigNumber, Fraction, Complex, an array, an object, `null`, `undefined`).
 * @throws An `Error` for a string that is not a number (see `stringToNumber`).
 */
export function convertToNumber(x: unknown): number | undefined {
  switch (typeof x) {
    case 'number':
      return x;
    case 'string':
      return stringToNumber(x);
    case 'boolean':
      return booleanToNumber(x);
    case 'bigint':
      return bigintToNumber(x);
    default:
      return undefined;
  }
}
