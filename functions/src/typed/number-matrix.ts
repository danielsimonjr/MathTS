/**
 * Shape and entry checks for a 2-D array before a matrix operation picks its path.
 * The numeric backend holds numbers only. A matrix with another scalar type takes the
 * generic path (#1040).
 */

import { isNumberTypedArray } from '@danielsimonjr/mathts-core/internal';
import {
  decompositionInputToNestedArray,
  densifyForSolver,
  isDenseMatrix as isNativeDenseMatrix,
  type DenseMatrix,
  type SparseMatrix,
} from '@danielsimonjr/mathts-matrix';
import { isMatrix, type Matrix as MathJSMatrix } from '../utils/is.js';

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
  if (isNumberTypedArray(x)) return Array.from(x);
  if (ArrayBuffer.isView(x)) {
    throw new TypeError(`${name}: expects number data, got a ${typeNameOf(x)}`);
  }
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

/** A matrix argument of a function that works on `number[][]`: a nested array or a matrix object. */
export type MatrixArgument = number[][] | DenseMatrix | SparseMatrix | MathJSMatrix;

/**
 * Rows of a matrix argument. A nested array is returned as it is. A matrix-package `DenseMatrix`
 * or `SparseMatrix` is read by the matrix-package reader `decompositionInputToNestedArray` (a
 * `SparseMatrix` keeps the size limit of `densifyForSolver`). A MathJS matrix is read through
 * `toArray`, and the nested result goes through the same reader, which checks the shape and
 * that every entry is a number.
 *
 * @param name - The name of the function, for the error message.
 * @param A - The argument.
 * @returns The rows of `A`.
 * @throws A `TypeError` when `A` is no nested array and no matrix, or a matrix has a jagged row or
 *   an entry that is not a number (the message names the row, the column and the entry type).
 */
export function matrixRows(name: string, A: unknown): number[][] {
  if (Array.isArray(A)) return A as number[][];
  // `densifyForSolver` tests a sparse matrix by its structure, so a second copy of the package
  // passes too, and it keeps the size limit.
  const native = isNativeDenseMatrix(A) ? A : densifyForSolver(A);
  if (native !== undefined) return decompositionInputToNestedArray(native);
  if (isMatrix(A)) {
    const rows: unknown = (A as unknown as { toArray(): unknown }).toArray();
    // A MathJS matrix of size [n] gives a 1-D array, which is no matrix argument.
    if (Array.isArray(rows) && (rows.length === 0 || Array.isArray(rows[0]))) {
      return decompositionInputToNestedArray(rows as number[][]);
    }
  }
  throw new TypeError(
    `${name}: A must be a number[][], DenseMatrix, SparseMatrix or MathJS matrix (got ${typeNameOf(A)})`
  );
}
