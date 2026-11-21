/**
 * The entry rule of a matrix argument: the implicit to-number rule of mathjs 15.2.0. The
 * decomposition reader (`as-packed.ts`) and the right-hand-side reader (`right-hand-side.ts`)
 * use it, so `A` and `b` of a solver follow one rule.
 */

import {
  convertToNumber,
  isBigNumber,
  isComplex,
  isFraction,
} from '@danielsimonjr/mathts-core/internal';

/**
 * Read an entry with the implicit to-number rule of mathjs: a number as it is; a numeric string,
 * a boolean and a bigint through their conversion (`convertToNumber`); `null` and `undefined` (a
 * hole of a sparse array) as 0, as mathjs `lusolve` reads them.
 *
 * @param value - The entry.
 * @returns The number, or `undefined` when the rule has no conversion (a BigNumber, Fraction or
 *   Complex keeps its type in mathjs; an array or an object has no conversion).
 * @throws An `Error` `Cannot convert "..." to a number` for a string that is not a number.
 */
export function implicitNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return 0;
  return convertToNumber(value);
}

/**
 * True for a BigNumber, a Fraction or a Complex: a scalar that mathjs computes with in its own
 * type instead of converting it to a number.
 *
 * @param value - Any value.
 * @returns `true` for one of the three types.
 */
export function isTypedScalar(value: unknown): boolean {
  return isBigNumber(value) || isFraction(value) || isComplex(value);
}
