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

/** The shape and entry access that every sparse matrix kind has. */
export interface SparseLike {
  rows: number;
  cols: number;
  get(i: number, j: number): number;
  toArray?: () => number[][];
}

/**
 * Reads the order of a square matrix from its size. The size of a boxed matrix comes from
 * `size()`, and the size of a native or sparse matrix is `[rows, cols]`. The 1-D empty size
 * `[0]` is the 0 x 0 matrix (the only Array form of an empty matrix is `[]`). A 1-D size `[k]`
 * with k above 0 reads as k x 0.
 *
 * @param name - The name of the function, for the error message.
 * @param size - The size of the matrix.
 * @returns The order n of an n x n matrix. The order of the empty matrix is 0.
 * @throws A `RangeError` (the class that mathjs throws) when the matrix is not 2-D and square.
 */
export function squareOrder(name: string, size: readonly number[]): number {
  if (size.length === 1 && size[0] === 0) return 0;
  if (size.length === 2 && size[0] === size[1]) return size[0];
  const shown = size.length === 1 ? `${size[0]}×0` : size.join('×');
  throw new RangeError(`${name}: matrix must be square (got ${shown})`);
}

/**
 * Reads the entries of a sparse matrix as a nested array of `rows` rows of `cols` entries. A
 * sparse matrix with a `toArray` method gives its own conversion; another one gives its entries
 * by `get`. The size comes from `rows` and `cols`, so a matrix with a zero axis gives the
 * nested form of that axis (`[]` for 0 x n, `rows` empty rows for n x 0).
 *
 * @param A - A sparse matrix of either kind.
 * @returns The nested array of the entries.
 */
export function sparseToArray(A: SparseLike): number[][] {
  if (typeof A.toArray === 'function') return A.toArray();
  return Array.from({ length: A.rows }, (_, i) =>
    Array.from({ length: A.cols }, (_, j) => A.get(i, j))
  );
}

/** The type name of a value, for an error message: the class name of an object. */
function typeNameOf(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  const ctor = (value as { constructor?: { name?: string } }).constructor;
  return ctor?.name || 'object';
}

/**
 * Checks that a number-only function gets a number scalar. A `Complex`, `Fraction` or
 * `BigNumber` has no exact path in such a function, so the function rejects the value (#1042).
 *
 * @param name - The name of the function, for the error message.
 * @param value - The input value.
 * @throws A `TypeError` when `value` is not a number.
 */
export function assertNumberScalar(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}: expects number data, got a ${typeNameOf(value)}`);
  }
}

/**
 * Tells if `x` can be read as a vector: an iterable object, or an array-like whose `length`
 * is a non-negative integer. `Array.from` reads a `length` of NaN or -1 as an empty vector.
 */
function isVectorInput(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  if (Symbol.iterator in x) return true;
  const length = (x as { length?: unknown }).length;
  return Number.isInteger(length) && (length as number) >= 0;
}

/**
 * Tells if `a` holds a NaN. A NaN is the only value that is not equal to itself.
 *
 * @param a - A number array or a typed array.
 * @returns `true` when one element of `a` is NaN.
 */
export function hasNaN(a: ArrayLike<number>): boolean {
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v !== v) return true;
  }
  return false;
}

/**
 * Converts the vector input of a number-only function to a number array. A `Complex`,
 * `Fraction` or `BigNumber` element has no exact path in such a function, so the function
 * rejects the element (#1042). The function does not read the element as a double.
 *
 * @param name - The name of the function, for the error message.
 * @param x - A number array, a typed array, an array-like object or an iterable object.
 * @returns A new array with the elements of `x`. The function does not change `x`.
 * @throws A `TypeError` when `x` is not a vector or an element is not a number.
 */
export function numberVector(name: string, x: ArrayLike<unknown>): number[] {
  // `Array.from(5)` and `Array.from('')` are `[]`, so a number or an empty string would read as
  // an empty vector and give a silent wrong value (#1083).
  if (!isVectorInput(x)) {
    throw new TypeError(`${name}: expects an array of numbers, got a ${typeNameOf(x)}`);
  }
  if (x instanceof BigInt64Array || x instanceof BigUint64Array) {
    throw new TypeError(`${name}: expects number data, got a ${typeNameOf(x)}`);
  }
  if (ArrayBuffer.isView(x)) return Array.from(x as ArrayLike<number>);
  // One pass reads each element once, checks it and copies it. The caller then reads the copy.
  const src: ArrayLike<unknown> = Array.isArray(x) ? x : Array.from(x);
  const out = new Array<number>(src.length);
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (typeof v !== 'number') {
      throw new TypeError(`${name}: expects number data, got a ${typeNameOf(v)} at index ${i}`);
    }
    out[i] = v;
  }
  return out;
}
