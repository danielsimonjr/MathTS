/**
 * Normalize decomposition inputs (DenseMatrix, nested arrays, packed f64).
 *
 * Shared by `svd`, `lu`, and (via `decompositionInputToNestedArray`) `lusolve`
 * in `@danielsimonjr/mathts-functions`.
 */

import { DenseMatrix, isDenseMatrix } from '../types/DenseMatrix.js';
import { SparseMatrix, isSparseMatrix } from '../types/SparseMatrix.js';

/** Row-major packed matrix given explicitly when length alone is ambiguous. */
export interface PackedMatrixDescriptor {
  data: Float64Array;
  rows: number;
  cols: number;
}

/**
 * Inputs accepted by matrix-package dense decompositions. A `SparseMatrix` is
 * densified with `toDense()` before the factorization runs.
 */
export type DecompositionMatrixInput =
  DenseMatrix | SparseMatrix | number[][] | Float64Array | PackedMatrixDescriptor;

const ACCEPTED_TYPES_MSG =
  'DenseMatrix, number[][], square Float64Array, or { data: Float64Array, rows, cols }';

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

function resolveDimensions(input: DecompositionMatrixInput): {
  rows: number;
  cols: number;
  nested: number[][];
} {
  if (isDenseMatrix(input)) {
    return { rows: input.rows, cols: input.cols, nested: input.toArray() };
  }
  if (isSparseMatrix(input)) {
    const dense = input.toDense();
    return { rows: dense.rows, cols: dense.cols, nested: dense.toArray() };
  }
  if (isNestedNumberMatrix(input)) {
    const rows = input.length;
    const cols = input[0]?.length ?? 0;
    for (let i = 0; i < rows; i++) {
      if (!Array.isArray(input[i]) || input[i].length !== cols) {
        throw new TypeError(`Matrix decomposition: jagged nested array at row ${i}`);
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
  if (
    !isDenseMatrix(input) &&
    !isSparseMatrix(input) &&
    !isNestedNumberMatrix(input) &&
    !(input instanceof Float64Array) &&
    !isPackedMatrixDescriptor(input)
  ) {
    invalidDecompositionInput(input);
  }
  return resolveDimensions(input).nested;
}

/**
 * Convert a decomposition input to a `DenseMatrix` (for LU and related
 * DenseMatrix-native kernels).
 */
export function decompositionInputToDenseMatrix(input: DecompositionMatrixInput): DenseMatrix {
  if (isDenseMatrix(input)) {
    return input;
  }
  if (isSparseMatrix(input)) {
    return input.toDense();
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
