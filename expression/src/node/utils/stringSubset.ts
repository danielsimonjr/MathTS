import { isIndex } from '../../utils/is.js';
import { isEmptyIndex, validateIndex, validateIndexSourceSize } from '../../utils/array.js';
import { DimensionError } from '../../error/DimensionError.js';

/** A Range-like dimension within an Index */
interface DimensionRange {
  forEach(callback: (value: number, index: number[]) => void): void;
  size(): number[];
}

/** The runtime Index surface used by subset */
interface IndexLike {
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
