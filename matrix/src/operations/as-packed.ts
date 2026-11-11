/**
 * Normalize decomposition inputs (DenseMatrix, nested arrays, packed f64).
 *
 * Shared by `svd`, `lu`, and (via `decompositionInputToNestedArray`) `lusolve`
 * in `@danielsimonjr/mathts-functions`.
 */

import { DenseMatrix, isDenseMatrix } from '../types/DenseMatrix.js';

/** Row-major packed matrix given explicitly when length alone is ambiguous. */
export interface PackedMatrixDescriptor {
  data: Float64Array;
  rows: number;
  cols: number;
}

/** Inputs accepted by matrix-package dense decompositions. */
export type DecompositionMatrixInput =
  DenseMatrix | number[][] | Float64Array | PackedMatrixDescriptor;

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

function isPackedDescriptor(value: unknown): value is PackedMatrixDescriptor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
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

function nestedFromFloat64Square(data: Float64Array): {
  rows: number;
  cols: number;
  nested: number[][];
} {
  const n = Math.sqrt(data.length);
  if (data.length === 0 || n !== Math.floor(n)) {
    throw new TypeError(
      `Matrix decomposition: Float64Array length ${data.length} is not a perfect square; use ${ACCEPTED_TYPES_MSG}`
    );
  }
  const size = n as number;
  const nested: number[][] = [];
  for (let i = 0; i < size; i++) {
    nested.push(Array.from(data.subarray(i * size, (i + 1) * size)));
  }
  return { rows: size, cols: size, nested };
}

function resolveDimensions(input: DecompositionMatrixInput): {
  rows: number;
  cols: number;
  nested: number[][];
} {
  if (isDenseMatrix(input)) {
    return { rows: input.rows, cols: input.cols, nested: input.toArray() };
  }
  if (isNestedNumberMatrix(input)) {
    const rows = input.length;
    const cols = input[0]?.length ?? 0;
    for (let i = 0; i < rows; i++) {
      if ((input[i]?.length ?? 0) !== cols) {
        throw new Error(`Matrix decomposition: jagged nested array at row ${i}`);
      }
    }
    return { rows, cols, nested: input };
  }
  if (input instanceof Float64Array) {
    const { rows, cols, nested } = nestedFromFloat64Square(input);
    return { rows, cols, nested };
  }
  if (isPackedDescriptor(input)) {
    const { rows, cols, data } = input;
    const nested: number[][] = [];
    for (let i = 0; i < rows; i++) {
      nested.push(Array.from(data.subarray(i * cols, (i + 1) * cols)));
    }
    return { rows, cols, nested };
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
    !isNestedNumberMatrix(input) &&
    !(input instanceof Float64Array) &&
    !isPackedDescriptor(input)
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
  if (
    !isNestedNumberMatrix(input) &&
    !(input instanceof Float64Array) &&
    !isPackedDescriptor(input)
  ) {
    invalidDecompositionInput(input);
  }
  const { rows, cols, nested } = resolveDimensions(input);
  return new DenseMatrix(rows, cols, nested);
}
