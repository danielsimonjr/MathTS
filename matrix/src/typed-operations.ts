/**
 * Typed Matrix Operations
 *
 * Polymorphic matrix operations using typed-function for runtime dispatch.
 * Supports operations on DenseMatrix with automatic type coercion.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import type { SignatureFunction } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from './types/DenseMatrix.js';

// Helper type for signature records with proper typing
type Signatures = Record<string, SignatureFunction>;

// =============================================================================
// Typed Matrix Creation Functions
// =============================================================================

/**
 * Create a matrix from various input types
 */
export const matrix = mathTyped('matrix', {
  Array: (arr: number[][]) => DenseMatrix.fromArray(arr),

  'number, number': (rows: number, cols: number) => DenseMatrix.zeros(rows, cols),

  'number, number, number': (rows: number, cols: number, fill: number) =>
    DenseMatrix.fill(rows, cols, fill),

  'number, number, Array': (rows: number, cols: number, data: number[]) =>
    DenseMatrix.fromFlat(rows, cols, data),
} as Signatures);

/**
 * Create an identity matrix
 */
export const identity = mathTyped('identity', {
  number: (n: number) => DenseMatrix.identity(n),
} as Signatures);

/**
 * Create a matrix of zeros
 */
export const zeros = mathTyped('zeros', {
  'number, number': (rows: number, cols: number) => DenseMatrix.zeros(rows, cols),
} as Signatures);

/**
 * Create a matrix of ones
 */
export const ones = mathTyped('ones', {
  'number, number': (rows: number, cols: number) => DenseMatrix.ones(rows, cols),
} as Signatures);

/**
 * Create a diagonal matrix
 */
export const diag = mathTyped('diag', {
  Array: (values: number[]) => DenseMatrix.diag(values),
} as Signatures);

/**
 * Create a random matrix
 */
export const random = mathTyped('random', {
  'number, number': (rows: number, cols: number) => DenseMatrix.random(rows, cols),
} as Signatures);

// =============================================================================
// Typed Matrix Arithmetic Operations
// =============================================================================

/**
 * Matrix addition - polymorphic add function
 */
export const add = mathTyped('add', {
  // Matrix + Matrix
  'DenseMatrix, DenseMatrix': (a: DenseMatrix, b: DenseMatrix) => a.add(b),

  // Matrix + scalar
  'DenseMatrix, number': (a: DenseMatrix, scalar: number) => a.map((v) => v + scalar),

  // scalar + Matrix
  'number, DenseMatrix': (scalar: number, a: DenseMatrix) => a.map((v) => v + scalar),

  // Fallback for number + number (delegates to core)
  'number, number': (a: number, b: number) => a + b,
} as Signatures);

/**
 * Matrix subtraction
 */
export const subtract = mathTyped('subtract', {
  // Matrix - Matrix
  'DenseMatrix, DenseMatrix': (a: DenseMatrix, b: DenseMatrix) => a.subtract(b),

  // Matrix - scalar
  'DenseMatrix, number': (a: DenseMatrix, scalar: number) => a.map((v) => v - scalar),

  // scalar - Matrix
  'number, DenseMatrix': (scalar: number, a: DenseMatrix) => a.map((v) => scalar - v),

  // Fallback for number - number
  'number, number': (a: number, b: number) => a - b,
} as Signatures);

/**
 * Matrix multiplication (matmul)
 */
export const multiply = mathTyped('multiply', {
  // Matrix * Matrix (matmul)
  'DenseMatrix, DenseMatrix': (a: DenseMatrix, b: DenseMatrix) => a.multiply(b),

  // Matrix * scalar (scale)
  'DenseMatrix, number': (a: DenseMatrix, scalar: number) => a.scale(scalar),

  // scalar * Matrix (scale)
  'number, DenseMatrix': (scalar: number, a: DenseMatrix) => a.scale(scalar),

  // Fallback for number * number
  'number, number': (a: number, b: number) => a * b,
} as Signatures);

/**
 * Element-wise multiplication (Hadamard product)
 */
export const dotMultiply = mathTyped('dotMultiply', {
  'DenseMatrix, DenseMatrix': (a: DenseMatrix, b: DenseMatrix) => a.multiplyElementwise(b),

  'number, number': (a: number, b: number) => a * b,
} as Signatures);

/**
 * Matrix division (A / B where B is scalar or element-wise)
 */
export const divide = mathTyped('divide', {
  // Matrix / scalar
  'DenseMatrix, number': (a: DenseMatrix, scalar: number) => a.scale(1 / scalar),

  // scalar / Matrix (element-wise)
  'number, DenseMatrix': (scalar: number, a: DenseMatrix) => a.map((v) => scalar / v),

  // Fallback for number / number
  'number, number': (a: number, b: number) => a / b,
} as Signatures);

/**
 * Matrix negation
 */
export const unaryMinus = mathTyped('unaryMinus', {
  DenseMatrix: (a: DenseMatrix) => a.negate(),
  number: (a: number) => -a,
} as Signatures);

/**
 * Matrix transpose
 */
export const transpose = mathTyped('transpose', {
  DenseMatrix: (a: DenseMatrix) => a.transpose(),
} as Signatures);

// =============================================================================
// Typed Reduction Operations
// =============================================================================

/**
 * Sum of all elements
 */
export const sum = mathTyped('sum', {
  DenseMatrix: (a: DenseMatrix) => a.sum(),
  Array: (arr: number[]) => arr.reduce((acc, v) => acc + v, 0),
} as Signatures);

/**
 * Mean of all elements
 */
export const mean = mathTyped('mean', {
  DenseMatrix: (a: DenseMatrix) => a.mean(),
  Array: (arr: number[]) => arr.reduce((acc, v) => acc + v, 0) / arr.length,
} as Signatures);

/**
 * Minimum element
 */
export const min = mathTyped('min', {
  DenseMatrix: (a: DenseMatrix) => a.min(),
  Array: (arr: number[]) => Math.min(...arr),
  'number, number': (a: number, b: number) => Math.min(a, b),
} as Signatures);

/**
 * Maximum element
 */
export const max = mathTyped('max', {
  DenseMatrix: (a: DenseMatrix) => a.max(),
  Array: (arr: number[]) => Math.max(...arr),
  'number, number': (a: number, b: number) => Math.max(a, b),
} as Signatures);

/**
 * Frobenius norm
 */
export const norm = mathTyped('norm', {
  DenseMatrix: (a: DenseMatrix) => a.norm(),
  Array: (arr: number[]) => Math.sqrt(arr.reduce((acc, v) => acc + v * v, 0)),
} as Signatures);

/**
 * Matrix trace (sum of diagonal elements)
 */
export const trace = mathTyped('trace', {
  DenseMatrix: (a: DenseMatrix) => a.trace(),
} as Signatures);

// =============================================================================
// Typed Element-wise Functions
// =============================================================================

/**
 * Element-wise absolute value
 */
export const abs = mathTyped('abs', {
  DenseMatrix: (a: DenseMatrix) => a.map((v) => Math.abs(v)),
  number: (a: number) => Math.abs(a),
} as Signatures);

/**
 * Element-wise square root
 */
export const sqrt = mathTyped('sqrt', {
  DenseMatrix: (a: DenseMatrix) => a.map((v) => Math.sqrt(v)),
  number: (a: number) => Math.sqrt(a),
} as Signatures);

/**
 * Element-wise square
 */
export const square = mathTyped('square', {
  DenseMatrix: (a: DenseMatrix) => a.map((v) => v * v),
  number: (a: number) => a * a,
} as Signatures);

/**
 * Element-wise exponential
 */
export const exp = mathTyped('exp', {
  DenseMatrix: (a: DenseMatrix) => a.map((v) => Math.exp(v)),
  number: (a: number) => Math.exp(a),
} as Signatures);

/**
 * Element-wise natural logarithm
 */
export const log = mathTyped('log', {
  DenseMatrix: (a: DenseMatrix) => a.map((v) => Math.log(v)),
  number: (a: number) => Math.log(a),
} as Signatures);

/**
 * Element-wise power
 */
export const pow = mathTyped('pow', {
  'DenseMatrix, number': (a: DenseMatrix, n: number) => a.map((v) => Math.pow(v, n)),
  'number, number': (a: number, b: number) => Math.pow(a, b),
} as Signatures);

// =============================================================================
// Typed Matrix Query Functions
// =============================================================================

/**
 * Get matrix dimensions
 */
export const size = mathTyped('size', {
  DenseMatrix: (a: DenseMatrix) => [a.rows, a.cols],
  Array: (arr: unknown[]) => {
    if (Array.isArray(arr[0])) {
      return [arr.length, (arr[0] as unknown[]).length];
    }
    return [arr.length];
  },
} as Signatures);

/**
 * Get element at position
 */
export const subset = mathTyped('subset', {
  'DenseMatrix, number, number': (a: DenseMatrix, row: number, col: number) => a.get(row, col),
} as Signatures);

/**
 * Get row from matrix
 */
export const row = mathTyped('row', {
  'DenseMatrix, number': (a: DenseMatrix, index: number) => a.row(index),
} as Signatures);

/**
 * Get column from matrix
 */
export const column = mathTyped('column', {
  'DenseMatrix, number': (a: DenseMatrix, index: number) => a.column(index),
} as Signatures);

/**
 * Get diagonal from matrix
 */
export const diagonal = mathTyped('diagonal', {
  DenseMatrix: (a: DenseMatrix) => a.diagonal(),
  'DenseMatrix, number': (a: DenseMatrix, k: number) => a.diagonal(k),
} as Signatures);

// =============================================================================
// Export all typed operations
// =============================================================================

export const typedMatrixOperations = {
  // Creation
  matrix,
  identity,
  zeros,
  ones,
  diag,
  random,

  // Arithmetic
  add,
  subtract,
  multiply,
  dotMultiply,
  divide,
  unaryMinus,
  transpose,

  // Reductions
  sum,
  mean,
  min,
  max,
  norm,
  trace,

  // Element-wise
  abs,
  sqrt,
  square,
  exp,
  log,
  pow,

  // Query
  size,
  subset,
  row,
  column,
  diagonal,
};
