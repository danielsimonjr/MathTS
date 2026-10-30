/**
 * Cold array/Matrix-aware collection utilities (mathjs-derived): `deepMap`/
 * `deepForEach` (Matrix-or-array dispatch), dimensional `reduce`, and the
 * sparse-matrix `scatter` primitive.
 *
 * Bucket B slice 2 canonical — consolidated from `expression/src/utils/collection.ts`
 * (240 lines) and `functions/src/utils/collection.ts` (237 lines): the two copies
 * were proven functionally IDENTICAL (the line-count delta is comment-only plus one
 * redundant cast; see `functions/tests/dedup-bucketB-equivalence.test.ts`), so
 * every export here is a straight consolidation with no reconciliation needed.
 *
 * `_switch` (2D transpose) is imported from `./switch.js` — an internal-only copy
 * scoped to this file (see its header); `expression`/`functions`'s own
 * `utils/switch.ts` remain untouched, a future dedup slice.
 */
import { isCollection, isMatrix as isMatrixInstance } from './is.js';
import { DimensionError } from './error/DimensionError.js';
import {
  type NestedArray,
  arraySize,
  deepMap as arrayDeepMap,
  deepForEach as arrayDeepForEach,
} from './array.js';
import { _switch } from './switch.js';

// Type definitions for Matrix interface (local duck-type; distinct from `./is.js` `Matrix`)
interface Matrix<T = unknown> {
  forEach(callback: (value: T) => void, skipZeros: boolean, recurse: boolean): void;
  map<U>(callback: (value: T) => U, skipZeros: boolean, recurse: boolean): Matrix<U>;
  size(): number[];
  valueOf(): T[];
  create(data: T[], datatype?: string): Matrix<T>;
  datatype(): string | undefined;
}

interface SparseMatrix<T = unknown> {
  _values: T[];
  _index: number[];
  _ptr: number[];
}

/**
 * Test whether an array contains collections
 * @param array - Array to test
 * @returns Returns true when the array contains one or multiple
 *          collections (Arrays or Matrices). Returns false otherwise.
 */
export function containsCollections(array: unknown[]): boolean {
  for (let i = 0; i < array.length; i++) {
    if (isCollection(array[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively loop over all elements in a given multi-dimensional array or matrix
 * and invoke the callback on each scalar leaf.
 *
 * Nested arrays are first-class inputs: `deepForEach([[1, 2], 3], fn)` visits `1`, `2`, then `3`.
 * For a matrix argument, recursion follows `forEach` with `recurse: true`.
 *
 * @param array - Nested array or matrix to iterate over
 * @param callback - Invoked once per scalar element
 */
export function deepForEach<T>(
  array: NestedArray<T> | Matrix<T>,
  callback: (value: T) => void
): void {
  if (isMatrixInstance(array)) {
    (array as unknown as Matrix<T>).forEach((x) => callback(x), false, true);
  } else {
    arrayDeepForEach(array as NestedArray<T>, callback, true);
  }
}

/**
 * Map a callback over every scalar in a nested array or matrix, preserving structure.
 *
 * When `skipZeros` is `true`, numeric zero leaves are kept as the original value (`T`);
 * other leaves become `callback(value)` (`U`), so the result type is `NestedArray<T | U>`
 * or `Matrix<T | U>`. When `skipZeros` is omitted or `false`, every leaf is mapped to `U`.
 *
 * @param array - Nested array or matrix to map over
 * @param callback - Applied to each scalar element
 * @param skipZeros - When true, skip the callback for zero values (zeros stay as `T`)
 * @returns A nested array or matrix with the same shape as the input
 */
export function deepMap<T, U>(
  array: Matrix<T>,
  callback: (value: T) => U,
  skipZeros: true
): Matrix<T | U>;
export function deepMap<T, U>(
  array: NestedArray<T>,
  callback: (value: T) => U,
  skipZeros: true
): NestedArray<T | U>;
export function deepMap<T, U>(
  array: Matrix<T>,
  callback: (value: T) => U,
  skipZeros?: false
): Matrix<U>;
export function deepMap<T, U>(
  array: NestedArray<T>,
  callback: (value: T) => U,
  skipZeros?: false
): NestedArray<U>;
export function deepMap<T, U>(
  array: NestedArray<T> | Matrix<T>,
  callback: (value: T) => U,
  skipZeros?: boolean
): NestedArray<U> | Matrix<U> | NestedArray<T | U> | Matrix<T | U> {
  if (!skipZeros) {
    if (isMatrixInstance(array)) {
      return (array as unknown as Matrix<T>).map((x) => callback(x), false, true);
    } else {
      return arrayDeepMap(array as NestedArray<T>, callback, true);
    }
  }
  const skipZerosCallback = (x: T): T | U => (x === 0 ? x : callback(x));
  if (isMatrixInstance(array)) {
    return (array as unknown as Matrix<T>).map((x) => skipZerosCallback(x), false, true) as Matrix<
      T | U
    >;
  } else {
    return arrayDeepMap(array as NestedArray<T>, skipZerosCallback, true);
  }
}

/**
 * Reduce a nested array or matrix along one dimension.
 *
 * For a one-dimensional nested array and `dim === 0`, the result is a **scalar** (`U`), not a
 * one-element array — e.g. `reduce([1, 2, 3], 0, add)` is `6`. Higher-rank inputs return a
 * nested array with one fewer effective dimension; matrices return a new matrix.
 *
 * @param mat - Nested array or matrix to reduce
 * @param dim - Zero-based dimension index (must be in range for `arraySize(mat)`)
 * @param callback - Fold function `(accumulator, value) => newAccumulator`
 * @returns Scalar, nested array, or matrix depending on rank and `dim`
 */
export function reduce<T, U>(
  mat: Matrix<T>,
  dim: number,
  callback: (acc: U | T, val: T) => U
): Matrix<U>;
export function reduce<T, U>(
  mat: NestedArray<T>,
  dim: number,
  callback: (acc: U | T, val: T) => U
): U | NestedArray<U>;
export function reduce<T, U>(
  mat: NestedArray<T> | Matrix<T>,
  dim: number,
  callback: (acc: U | T, val: T) => U
): U | NestedArray<U> | Matrix<U> {
  const size = Array.isArray(mat) ? arraySize(mat) : (mat as unknown as Matrix<T>).size();
  if (dim < 0 || dim >= size.length) {
    throw new DimensionError(dim, size.length, '<');
  }

  if (isMatrixInstance(mat)) {
    const reduced = _reduce((mat as unknown as Matrix<T>).valueOf() as T[], dim, callback);
    return (mat as unknown as Matrix<T>).create(
      reduced as unknown as T[],
      (mat as unknown as Matrix<T>).datatype()
    ) as unknown as Matrix<U>;
  } else {
    return _reduce(mat as T[], dim, callback) as U | NestedArray<U>;
  }
}

/**
 * Recursively reduce a matrix
 * @param mat - Array to reduce
 * @param dim - Dimension to reduce
 * @param callback - Callback function
 * @returns Reduced result
 * @private
 */
function _reduce<T, U>(mat: T[], dim: number, callback: (acc: U | T, val: T) => U): U | U[] {
  let i: number;
  let ret: U[];
  let val: U | T;
  let tran: T[][];

  if (dim <= 0) {
    if (!Array.isArray(mat[0])) {
      val = mat[0];
      for (i = 1; i < mat.length; i++) {
        val = callback(val, mat[i]);
      }
      return val as U;
    } else {
      tran = _switch(mat as unknown as T[][]);
      ret = [];
      for (i = 0; i < tran.length; i++) {
        ret[i] = _reduce(tran[i], dim - 1, callback) as U;
      }
      return ret;
    }
  } else {
    ret = [];
    for (i = 0; i < mat.length; i++) {
      ret[i] = _reduce(mat[i] as unknown as T[], dim - 1, callback) as U;
    }
    return ret;
  }
}

/**
 * Scatter function for sparse matrix operations
 * @param a - Sparse matrix
 * @param j - Column index
 * @param w - Work array for marking visited rows
 * @param x - Work array for storing values
 * @param u - Work array for marking updated rows
 * @param mark - Current mark value
 * @param cindex - Column index array to update
 * @param f - Binary function to apply
 * @param inverse - Whether to inverse the function arguments
 * @param update - Whether to update existing values
 * @param value - Value to use in binary function
 */
export function scatter<T>(
  a: SparseMatrix<T>,
  j: number,
  w: number[],
  x: T[] | null,
  u: number[],
  mark: number,
  cindex: number[],
  f?: (a: T, b: T) => T,
  inverse?: boolean,
  update?: boolean,
  value?: T
): void {
  // a arrays
  const avalues = a._values;
  const aindex = a._index;
  const aptr = a._ptr;

  // vars
  let k: number;
  let k0: number;
  let k1: number;
  let i: number;

  // check we need to process values (pattern matrix)
  if (x) {
    // values in j
    for (k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
      // row
      i = aindex[k];
      // check value exists in current j
      if (w[i] !== mark) {
        // i is new entry in j
        w[i] = mark;
        // add i to pattern of C
        cindex.push(i);
        // x(i) = A, check we need to call function this time
        if (update && f) {
          // copy value to workspace calling callback function.
          // `value` is supplied by callers on the `update && f` path that
          // reaches here, so it is defined where the `T` parameters require it.
          x[i] = inverse ? f(avalues[k], value as T) : f(value as T, avalues[k]);
          // function was called on current row
          u[i] = mark;
        } else {
          // copy value to workspace
          x[i] = avalues[k];
        }
      } else {
        // i exists in C already
        if (f) {
          x[i] = inverse ? f(avalues[k], x[i]) : f(x[i], avalues[k]);
        }
        // function was called on current row
        u[i] = mark;
      }
    }
  } else {
    // values in j
    for (k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
      // row
      i = aindex[k];
      // check value exists in current j
      if (w[i] !== mark) {
        // i is new entry in j
        w[i] = mark;
        // add i to pattern of C
        cindex.push(i);
      } else {
        // indicate function was called on current row
        u[i] = mark;
      }
    }
  }
}
