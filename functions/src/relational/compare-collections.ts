import { isDenseMatrix, isSparseMatrix } from '../utils/is.js';

/**
 * Compare mixed matrix/array types, by converting to same-shaped array.
 * This comparator is non-deterministic regarding input types.
 * @param {Array | SparseMatrix | DenseMatrix | *} x
 * @param {Array | SparseMatrix | DenseMatrix | *} y
 * @returns {number} Returns the comparison result: -1, 0, or 1
 */
export function compareMatricesAndArrays(
  compareNatural: (x: unknown, y: unknown) => number,
  x: unknown,
  y: unknown
): number {
  if (isSparseMatrix(x) && isSparseMatrix(y)) {
    return compareArrays(
      compareNatural,
      (x as unknown as { toJSON(): { values: unknown[] } }).toJSON().values,
      (y as unknown as { toJSON(): { values: unknown[] } }).toJSON().values
    );
  }
  if (isSparseMatrix(x)) {
    // note: convert to array is expensive
    return compareMatricesAndArrays(
      compareNatural,
      (x as unknown as { toArray(): unknown[] }).toArray(),
      y
    );
  }
  if (isSparseMatrix(y)) {
    // note: convert to array is expensive
    return compareMatricesAndArrays(
      compareNatural,
      x,
      (y as unknown as { toArray(): unknown[] }).toArray()
    );
  }

  // convert DenseArray into Array
  if (isDenseMatrix(x)) {
    return compareMatricesAndArrays(
      compareNatural,
      (x as unknown as { toJSON(): { data: unknown[] } }).toJSON().data,
      y
    );
  }
  if (isDenseMatrix(y)) {
    return compareMatricesAndArrays(
      compareNatural,
      x,
      (y as unknown as { toJSON(): { data: unknown[] } }).toJSON().data
    );
  }

  // convert scalars to array
  if (!Array.isArray(x)) {
    return compareMatricesAndArrays(compareNatural, [x], y);
  }
  if (!Array.isArray(y)) {
    return compareMatricesAndArrays(compareNatural, x, [y]);
  }

  return compareArrays(compareNatural, x, y);
}

/**
 * Compare two Arrays
 *
 * - First, compares value by value
 * - Next, if all corresponding values are equal,
 *   look at the length: longest array will be considered largest
 *
 * @param {Array} x
 * @param {Array} y
 * @returns {number} Returns the comparison result: -1, 0, or 1
 */
export function compareArrays(
  compareNatural: (x: unknown, y: unknown) => number,
  x: unknown[],
  y: unknown[]
): number {
  // compare each value
  for (let i = 0, ii = Math.min(x.length, y.length); i < ii; i++) {
    const v = compareNatural(x[i], y[i]);
    if (v !== 0) {
      return v;
    }
  }

  // compare the size of the arrays
  if (x.length > y.length) {
    return 1;
  }
  if (x.length < y.length) {
    return -1;
  }

  // both Arrays have equal size and content
  return 0;
}
