/**
 * Normalize decomposition inputs (DenseMatrix, nested arrays, packed f64).
 *
 * Shared by `svd`, `lu`, and (via `decompositionInputToNestedArray`) `lusolve`
 * in `@danielsimonjr/mathts-functions`.
 */

import { DenseMatrix, isDenseMatrix } from '../types/DenseMatrix.js';
import type { SparseMatrix } from '../types/SparseMatrix.js';
import { arraySize } from '@danielsimonjr/mathts-core/internal';
import { densifyForSolver } from './densify.js';
import { denseReader } from '../types/dense/storage.js';

/** Row-major packed matrix given explicitly when length alone is ambiguous. */
export interface PackedMatrixDescriptor {
  data: Float64Array;
  rows: number;
  cols: number;
}

/**
 * Inputs accepted by matrix-package dense decompositions. A `SparseMatrix` is
 * densified with `densifyForSolver` before the factorization runs, so the element
 * limit of that helper applies. The sparse test is structural: a `SparseMatrix` from
 * a second loaded copy of this package is accepted.
 */
export type DecompositionMatrixInput =
  DenseMatrix | SparseMatrix | number[][] | Float64Array | PackedMatrixDescriptor;

const ACCEPTED_TYPES_MSG =
  'DenseMatrix, SparseMatrix, number[][], square Float64Array, or { data: Float64Array, rows, cols }';

function isNestedNumberMatrix(value: unknown): value is number[][] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length === 0) {
    return true;
  }
  return Array.isArray(value[0]);
}

/** True for `{ data, rows, cols }` and not for an LUP result (`L`, `U`, `p`). */
export function isPackedMatrixDescriptor(value: unknown): value is PackedMatrixDescriptor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if ('L' in o || 'U' in o || 'p' in o || 'P' in o) {
    return false;
  }
  return (
    o.data instanceof Float64Array &&
    typeof o.rows === 'number' &&
    typeof o.cols === 'number' &&
    Number.isInteger(o.rows) &&
    Number.isInteger(o.cols) &&
    o.rows >= 0 &&
    o.cols >= 0 &&
    o.data.length === o.rows * o.cols
  );
}

function invalidDecompositionInput(actual: unknown): never {
  const tag =
    actual === null
      ? 'null'
      : actual === undefined
        ? 'undefined'
        : Array.isArray(actual)
          ? 'Array'
          : ((actual as object).constructor?.name ?? typeof actual);
  throw new TypeError(`Matrix decomposition expected ${ACCEPTED_TYPES_MSG}, got ${tag}`);
}

function squareSize(length: number): number {
  if (length === 0) {
    return 0;
  }
  const n = Math.sqrt(length);
  if (n !== Math.floor(n)) {
    throw new TypeError(
      `Matrix decomposition: Float64Array length ${length} is not a perfect square; use ${ACCEPTED_TYPES_MSG}`
    );
  }
  return n;
}

function nestedFromPacked(data: Float64Array, rows: number, cols: number): number[][] {
  if (rows === 0) {
    return [];
  }
  const nested: number[][] = [];
  for (let i = 0; i < rows; i++) {
    nested.push(Array.from(data.subarray(i * cols, (i + 1) * cols)));
  }
  return nested;
}

/**
 * Throw for a nested array that has an Array as an entry. The size comes from `arraySize`, which
 * follows the first entry of each level: a size of three or more is a tensor (a `RangeError`, the
 * message of the `qr` of `@danielsimonjr/mathts-functions`), and a size of two means that only some
 * entries are Arrays (a jagged array, the `TypeError` of the row check).
 */
function rejectArrayEntry(input: number[][], row: number): never {
  const size = arraySize(input);
  if (size.length > 2) {
    throw new RangeError(`Matrix must be two dimensional (size: [${size.join(', ')}])`);
  }
  throw new TypeError(`Matrix decomposition: jagged nested array at row ${row}`);
}

function resolveDimensions(input: DecompositionMatrixInput): {
  rows: number;
  cols: number;
  nested: number[][];
} {
  if (isDenseMatrix(input)) {
    return { rows: input.rows, cols: input.cols, nested: input.toArray() };
  }
  const dense = densifyForSolver(input);
  if (dense) {
    return { rows: dense.rows, cols: dense.cols, nested: dense.toArray() };
  }
  if (isNestedNumberMatrix(input)) {
    const rows = input.length;
    const cols = input[0]?.length ?? 0;
    for (let i = 0; i < rows; i++) {
      const row = input[i];
      if (!Array.isArray(row) || row.length !== cols) {
        throw new TypeError(`Matrix decomposition: jagged nested array at row ${i}`);
      }
      // A row of Arrays is a tensor or a jagged array, not a matrix. Later arithmetic would read
      // `[2]` as 2 and `[1, 2]` as NaN (#1260). An `undefined` entry (a hole, or a value that
      // is missing) is no number of any type and gives a result full of NaN without a sign. The
      // other entry types stay: `lusolve` reads an entry that is a BigNumber, a Complex, a Fraction or
      // a numeric string on its typed path, and asks this function for the shape only.
      for (let j = 0; j < cols; j++) {
        const entry: unknown = row[j];
        if (Array.isArray(entry)) rejectArrayEntry(input, i);
        if (entry === undefined) {
          throw new TypeError(
            `Matrix decomposition: nested array must contain numbers; row ${i} column ${j} is undefined`
          );
        }
      }
    }
    return { rows, cols, nested: input };
  }
  if (input instanceof Float64Array) {
    const size = squareSize(input.length);
    return { rows: size, cols: size, nested: nestedFromPacked(input, size, size) };
  }
  if (isPackedMatrixDescriptor(input)) {
    const { rows, cols, data } = input;
    return { rows, cols, nested: nestedFromPacked(data, rows, cols) };
  }
  return invalidDecompositionInput(input);
}

/**
 * Convert a decomposition input to a nested `number[][]` (for SVD and for
 * mathjs-style solvers that call `matrix(nested)`).
 */
export function decompositionInputToNestedArray(input: DecompositionMatrixInput): number[][] {
  return resolveDimensions(input).nested;
}

/**
 * A decomposition input with its shape known and a way to copy its rows into a
 * kernel's own working storage. Kernels that need a nested working copy use
 * `copyRows`, so a `DenseMatrix` never goes through `toArray()`.
 */
export interface DecompositionSource {
  readonly rows: number;
  readonly cols: number;
  /**
   * A fresh row-major nested copy, transposed when `transpose` is true. It never
   * aliases the input, so the caller may mutate it.
   */
  copyRows(transpose: boolean): number[][];
  /** The sum of squares of all entries, summed in row-major order. No copy. */
  sumOfSquares(): number;
}

/** Copies a nested array row by row, transposing it when asked. */
function copyNestedRows(nested: number[][], transpose: boolean): number[][] {
  if (!transpose) {
    return nested.map((row) => row.slice());
  }
  const rows = nested.length;
  const cols = rows === 0 ? 0 : nested[0].length;
  const out = new Array<number[]>(cols);
  for (let j = 0; j < cols; j++) {
    const row = new Array<number>(rows);
    for (let i = 0; i < rows; i++) row[i] = nested[i][j];
    out[j] = row;
  }
  return out;
}

/**
 * Resolve a decomposition input once, without converting a `DenseMatrix` to
 * nested form. Other inputs are resolved with `decompositionInputToNestedArray`.
 */
export function decompositionSource(input: DecompositionMatrixInput): DecompositionSource {
  const reader = isDenseMatrix(input) ? denseReader(input) : null;
  if (reader) return reader;
  const nested = decompositionInputToNestedArray(input);
  return {
    rows: nested.length,
    cols: nested[0]?.length ?? 0,
    copyRows: (transpose) => copyNestedRows(nested, transpose),
    sumOfSquares: () => {
      let sum = 0;
      for (const row of nested) for (const v of row) sum += v * v;
      return sum;
    },
  };
}

/**
 * Convert a decomposition input to a `DenseMatrix` (for LU and related
 * DenseMatrix-native kernels).
 */
export function decompositionInputToDenseMatrix(input: DecompositionMatrixInput): DenseMatrix {
  if (isDenseMatrix(input)) {
    return input;
  }
  const dense = densifyForSolver(input);
  if (dense) {
    // A DenseMatrix of any copy of the package carries the brand and has the same layout (#1041).
    // Rebuild only a dense result that is not a DenseMatrix.
    const d: { rows: number; cols: number; toArray(): number[][] } = dense;
    return isDenseMatrix(d) ? d : new DenseMatrix(d.rows, d.cols, d.toArray());
  }
  if (input instanceof Float64Array) {
    const n = squareSize(input.length);
    // One copy. The constructor keeps this buffer; the caller's array stays unchanged.
    return new DenseMatrix(n, n, new Float64Array(input));
  }
  if (isPackedMatrixDescriptor(input)) {
    return new DenseMatrix(input.rows, input.cols, new Float64Array(input.data));
  }
  if (!isNestedNumberMatrix(input)) {
    invalidDecompositionInput(input);
  }
  const { rows, cols, nested } = resolveDimensions(input);
  return new DenseMatrix(rows, cols, nested);
}
