/**
 * Parallel Matrix Multiplication
 *
 * High-performance parallel matrix multiplication with automatic chunking.
 * Distributes rows across workers for parallel computation.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool } from '../ComputePool.js';
import type { ParallelResult } from '../ComputePool.js';

/**
 * Options for parallel matrix multiplication
 */
export interface MatmulOptions {
  /** Custom pool to use (defaults to global computePool) */
  pool?: ComputePool;
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution regardless of threshold */
  forceSequential?: boolean;
}

/**
 * Parallel matrix multiplication (C = A × B)
 *
 * Multiplies two matrices using parallel workers. The computation
 * distributes rows of matrix A across available workers.
 *
 * @param a - First matrix as flat Float64Array (row-major order)
 * @param aRows - Number of rows in matrix A
 * @param aCols - Number of columns in matrix A (must equal bRows)
 * @param b - Second matrix as flat Float64Array (row-major order)
 * @param bCols - Number of columns in matrix B
 * @param options - Optional configuration
 * @returns Result matrix C (aRows × bCols) with parallel execution metadata
 *
 * @example
 * ```typescript
 * // 2x3 matrix * 3x2 matrix = 2x2 matrix
 * const A = new Float64Array([1, 2, 3, 4, 5, 6]);
 * const B = new Float64Array([7, 8, 9, 10, 11, 12]);
 *
 * const result = await parallelMatmul(A, 2, 3, B, 2);
 * console.log(result.result); // 2x2 result matrix
 * console.log(result.parallelized); // true if workers were used
 * ```
 */
export async function parallelMatmul(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number,
  options: MatmulOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.matmul(a, aRows, aCols, b, bCols);
}

/**
 * Parallel matrix-vector multiplication (y = A × x)
 *
 * Multiplies a matrix by a vector using parallel workers.
 *
 * @param matrix - Matrix as flat Float64Array (row-major order)
 * @param rows - Number of rows in the matrix
 * @param cols - Number of columns in the matrix (must equal vector length)
 * @param vector - Vector as Float64Array
 * @param options - Optional configuration
 * @returns Result vector with parallel execution metadata
 */
export async function parallelMatvec(
  matrix: Float64Array,
  rows: number,
  cols: number,
  vector: Float64Array,
  options: MatmulOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.matvec(matrix, rows, cols, vector);
}

/**
 * Parallel matrix transpose
 *
 * Transposes a matrix using parallel workers.
 *
 * @param data - Matrix as flat Float64Array (row-major order)
 * @param rows - Number of rows in the original matrix
 * @param cols - Number of columns in the original matrix
 * @param options - Optional configuration
 * @returns Transposed matrix (cols × rows) with parallel execution metadata
 */
export async function parallelTranspose(
  data: Float64Array,
  rows: number,
  cols: number,
  options: MatmulOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.transpose(data, rows, cols);
}

/**
 * Parallel outer product (C = a ⊗ b)
 *
 * Computes the outer product of two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @param options - Optional configuration
 * @returns Outer product matrix (a.length × b.length)
 */
export async function parallelOuter(
  a: Float64Array,
  b: Float64Array,
  options: MatmulOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.outer(a, b);
}

/**
 * Parallel dot product (scalar = a · b)
 *
 * Computes the dot product of two vectors.
 *
 * @param a - First vector
 * @param b - Second vector (must have same length as a)
 * @param options - Optional configuration
 * @returns Dot product scalar
 */
export async function parallelDot(
  a: Float64Array,
  b: Float64Array,
  options: MatmulOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.dot(a, b);
}
