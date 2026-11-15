/**
 * Shape and entry checks for a 2-D array before a matrix operation picks its path.
 * The numeric backend holds numbers only. A matrix with another scalar type takes the
 * generic path (#1040).
 */

/**
 * Tells if every entry of a 2-D array is a number.
 *
 * @param m - The 2-D array.
 * @returns `true` when every row is an array and every entry is a number.
 */
export function isNumberMatrix(m: readonly unknown[]): m is number[][] {
  return m.every((row) => Array.isArray(row) && row.every((x) => typeof x === 'number'));
}

/**
 * Checks that a 2-D array is rectangular, with the message of the numeric backend.
 *
 * @param m - The 2-D array.
 * @throws A `TypeError` when a row is not an array or has a different length from row 0.
 */
export function assertRectangular(m: readonly unknown[]): asserts m is unknown[][] {
  const width = Array.isArray(m[0]) ? (m[0] as unknown[]).length : 0;
  for (let i = 0; i < m.length; i++) {
    const row = m[i];
    if (!Array.isArray(row)) {
      throw new TypeError(`DenseMatrix nested array must be rectangular; row ${i} is not an array`);
    }
    if (row.length !== width) {
      throw new TypeError(
        `DenseMatrix nested array must be rectangular; row ${i} has length ${row.length}, expected ${width}`
      );
    }
  }
}
