import { isIndex } from '../../utils/is.js';
import { isEmptyIndex, validateIndex, validateIndexSourceSize } from '../../utils/array.js';
import { DimensionError } from '../../error/DimensionError.js';

/** A Range-like dimension within an Index */
interface DimensionRange {
  forEach(callback: (value: number, index: number[]) => void): void;
  size(): number[];
}

/** The runtime Index surface used by subset */
export interface IndexLike {
  isIndex?: boolean;
  isScalar(): boolean;
  size(): number[];
  min(): number[];
  max(): number[];
  dimension(dim: number): number | string | DimensionRange;
}

/**
 * Retrieve a subset of a string
 * @param {string} str            string from which to get a substring
 * @param {IndexLike} index       An index or list of indices (character positions)
 * @returns {string} substring
 */
export function getStringSubset(str: string, index: IndexLike): string {
  if (!isIndex(index)) {
    // TODO: better error message
    throw new TypeError('Index expected');
  }

  if (isEmptyIndex(index)) {
    return '';
  }
  validateIndexSourceSize(Array.from(str), index);

  if (index.size().length !== 1) {
    throw new DimensionError(index.size().length, 1);
  }

  // validate whether the range is out of range
  const strLen = str.length;
  validateIndex(index.min()[0], strLen);
  validateIndex(index.max()[0], strLen);

  const range = index.dimension(0);

  let substr = '';
  function callback(v: number): void {
    substr += str.charAt(v);
  }
  if (Number.isInteger(range)) {
    callback(range as number);
  } else {
    (range as DimensionRange).forEach(callback);
  }

  return substr;
}

/**
 * Replace a substring in a string
 * @param {string} str            string to be replaced
 * @param {IndexLike} index       An index or list of indices (character positions)
 * @param {string} replacement    Replacement string
 * @param {string} [defaultValue] Default value to be used when resizing
 *                                the string. is ' ' by default
 * @returns {string} result
 */
export function setStringSubset(
  str: string,
  index: IndexLike,
  replacement: string,
  defaultValue?: string
): string {
  if (!index || index.isIndex !== true) {
    throw new TypeError('Invalid index: must be an Index or Index-like object');
  }
  // DELIBERATELY not the `isIndex()` guard that getStringSubset above uses, even though
  // that would narrow IndexLike to Index and remove the cast below. The two functions
  // have different callers and different contracts:
  //   getStringSubset <- access.ts, always real Index instances
  //   setStringSubset <- assign.ts, which must accept Index-LIKE objects
  // `isIndex` tests `constructor.prototype.isIndex`, so a duck-typed object literal
  // fails it. Swapping the check in breaks `assign - string assignment via subset`
  // ("replaces a character in a string"), which passes exactly such a literal. Verified
  // by making that substitution and watching the test go red.
  //
  // So the runtime check stays permissive and the narrowing is done once, here. The
  // helpers below only ever touch the structural surface IndexLike declares
  // (size/min/max/isScalar/dimension), and the check above has already established it.
  // The target type is derived from the helper rather than imported by name: `Index` is
  // declared in expression's utils/is.ts AND in core's, and these helpers come from core
  // via utils/array.js, so naming it here risks silently picking the wrong one.
  const idx = index as unknown as Parameters<typeof isEmptyIndex>[0];
  if (isEmptyIndex(idx)) {
    return str;
  }
  validateIndexSourceSize(Array.from(str), idx);
  if (index.size().length !== 1) {
    throw new DimensionError(index.size().length, 1);
  }
  if (defaultValue !== undefined) {
    if (typeof defaultValue !== 'string' || defaultValue.length !== 1) {
      throw new TypeError('Single character expected as defaultValue');
    }
  } else {
    defaultValue = ' ';
  }

  const range = index.dimension(0);
  const len = Number.isInteger(range) ? 1 : (range as DimensionRange).size()[0];

  if (len !== replacement.length) {
    throw new DimensionError((range as DimensionRange).size()[0], replacement.length);
  }

  // validate whether the range is out of range
  const strLen = str.length;
  validateIndex(index.min()[0]);
  validateIndex(index.max()[0]);

  // copy the string into an array with characters
  const chars: string[] = [];
  for (let i = 0; i < strLen; i++) {
    chars[i] = str.charAt(i);
  }

  function callback(v: number, i: number[]): void {
    chars[v] = replacement.charAt(i[0]);
  }

  if (Number.isInteger(range)) {
    callback(range as number, [0]);
  } else {
    (range as DimensionRange).forEach(callback);
  }

  // initialize undefined characters with a space
  if (chars.length > strLen) {
    for (let i = strLen - 1, len = chars.length; i < len; i++) {
      if (!chars[i]) {
        chars[i] = defaultValue;
      }
    }
  }

  return chars.join('');
}
