/**
 * Parallel Reduction Operations
 *
 * High-performance parallel reduction operations (sum, min, max, etc.).
 * Uses parallel aggregation with sequential final reduction.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool } from '../ComputePool.js';
import type { ParallelResult } from '../ComputePool.js';

/**
 * Options for parallel reduction operations
 */
export interface ReduceOptions {
  /** Custom pool to use (defaults to global computePool) */
  pool?: ComputePool;
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution regardless of threshold */
  forceSequential?: boolean;
}

/**
 * Parallel sum reduction
 *
 * Computes the sum of all elements using parallel partial sums.
 *
 * @param data - Array to sum
 * @param options - Optional configuration
 * @returns Sum of all elements
 */
export async function parallelSum(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.sum(data);
}

/**
 * Parallel mean computation
 *
 * @param data - Array to compute mean of
 * @param options - Optional configuration
 * @returns Mean value
 */
export async function parallelMean(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.mean(data);
}

/**
 * Parallel minimum value
 *
 * @param data - Array to find minimum of
 * @param options - Optional configuration
 * @returns Minimum value
 */
export async function parallelMin(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.min(data);
}

/**
 * Parallel maximum value
 *
 * @param data - Array to find maximum of
 * @param options - Optional configuration
 * @returns Maximum value
 */
export async function parallelMax(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.max(data);
}

/**
 * Parallel min/max with indices
 *
 * @param data - Array to analyze
 * @param options - Optional configuration
 * @returns Object with min, max, minIdx, maxIdx
 */
export async function parallelMinMax(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<{ min: number; max: number; minIdx: number; maxIdx: number }>> {
  const pool = options.pool ?? computePool;
  return pool.minMax(data);
}

/**
 * Parallel variance computation
 *
 * Uses Welford's algorithm for numerically stable variance calculation.
 *
 * @param data - Array to compute variance of
 * @param options - Optional configuration
 * @returns Object with mean, variance, and std (standard deviation)
 */
export async function parallelVariance(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<{ mean: number; variance: number; std: number }>> {
  const pool = options.pool ?? computePool;
  return pool.variance(data);
}

/**
 * Parallel standard deviation
 *
 * @param data - Array to compute std of
 * @param options - Optional configuration
 * @returns Standard deviation
 */
export async function parallelStd(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.std(data);
}

/**
 * Parallel Euclidean norm (L2 norm)
 *
 * Computes √(Σx²) using parallel partial sums of squares.
 *
 * @param data - Vector to compute norm of
 * @param options - Optional configuration
 * @returns Euclidean norm
 */
export async function parallelNorm(
  data: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.norm(data);
}

/**
 * Parallel Euclidean distance
 *
 * Computes the Euclidean distance between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @param options - Optional configuration
 * @returns Euclidean distance
 */
export async function parallelDistance(
  a: Float64Array,
  b: Float64Array,
  options: ReduceOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;
  return pool.distance(a, b);
}

/**
 * Parallel histogram computation
 *
 * Bins data into histogram using parallel counting.
 *
 * @param data - Array to bin
 * @param bins - Number of bins
 * @param min - Minimum value (auto-detected if not provided)
 * @param max - Maximum value (auto-detected if not provided)
 * @param options - Optional configuration
 * @returns Array of bin counts
 */
export async function parallelHistogram(
  data: Float64Array,
  bins: number,
  min?: number,
  max?: number,
  options: ReduceOptions = {}
): Promise<ParallelResult<number[]>> {
  const pool = options.pool ?? computePool;
  return pool.histogram(data, bins, min, max);
}

/**
 * Generic parallel reduce operation
 *
 * Reduces an array using a custom function. Note that for truly
 * associative operations, consider using specialized functions
 * (parallelSum, parallelMin, etc.) for better performance.
 *
 * @param data - Array to reduce
 * @param fn - Reduction function (acc, item) => newAcc
 * @param initial - Initial accumulator value
 * @param options - Optional configuration
 * @returns Reduced value
 */
export async function parallelReduce<T, R>(
  data: T[],
  fn: (acc: R, item: T) => R,
  initial: R,
  options: ReduceOptions = {}
): Promise<ParallelResult<R>> {
  const pool = options.pool ?? computePool;
  return pool.reduce(data, fn, initial);
}
