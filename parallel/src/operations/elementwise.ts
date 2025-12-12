/**
 * Parallel Element-wise Operations
 *
 * High-performance parallel element-wise operations on arrays.
 * Automatically chunks data for distribution across workers.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool } from '../ComputePool.js';
import type { ParallelResult } from '../ComputePool.js';

/**
 * Options for parallel element-wise operations
 */
export interface ElementwiseOptions {
  /** Custom pool to use (defaults to global computePool) */
  pool?: ComputePool;
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution regardless of threshold */
  forceSequential?: boolean;
}

/**
 * Parallel element-wise addition (c[i] = a[i] + b[i])
 */
export async function parallelAdd(
  a: Float64Array,
  b: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.add(a, b);
}

/**
 * Parallel element-wise subtraction (c[i] = a[i] - b[i])
 */
export async function parallelSubtract(
  a: Float64Array,
  b: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.subtract(a, b);
}

/**
 * Parallel element-wise multiplication (c[i] = a[i] * b[i])
 */
export async function parallelMultiply(
  a: Float64Array,
  b: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.multiply(a, b);
}

/**
 * Parallel element-wise division (c[i] = a[i] / b[i])
 */
export async function parallelDivide(
  a: Float64Array,
  b: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.divide(a, b);
}

/**
 * Parallel scalar multiplication (b[i] = a[i] * scalar)
 */
export async function parallelScale(
  data: Float64Array,
  scalar: number,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.scale(data, scalar);
}

/**
 * Parallel absolute value (b[i] = |a[i]|)
 */
export async function parallelAbs(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.abs(data);
}

/**
 * Parallel negation (b[i] = -a[i])
 */
export async function parallelNegate(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.negate(data);
}

/**
 * Parallel square (b[i] = a[i]²)
 */
export async function parallelSquare(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.square(data);
}

/**
 * Parallel square root (b[i] = √a[i])
 */
export async function parallelSqrt(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.sqrt(data);
}

/**
 * Parallel exponential (b[i] = e^a[i])
 */
export async function parallelExp(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.exp(data);
}

/**
 * Parallel natural logarithm (b[i] = ln(a[i]))
 */
export async function parallelLog(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.log(data);
}

/**
 * Parallel sine (b[i] = sin(a[i]))
 */
export async function parallelSin(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.sin(data);
}

/**
 * Parallel cosine (b[i] = cos(a[i]))
 */
export async function parallelCos(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.cos(data);
}

/**
 * Parallel tangent (b[i] = tan(a[i]))
 */
export async function parallelTan(
  data: Float64Array,
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.tan(data);
}

/**
 * Generic parallel element-wise operation
 */
export async function parallelElementwise(
  a: Float64Array,
  b: Float64Array,
  op: 'add' | 'subtract' | 'multiply' | 'divide',
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.elementwise(a, b, op);
}

/**
 * Generic parallel unary operation
 */
export async function parallelUnary(
  data: Float64Array,
  fn: 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square',
  options: ElementwiseOptions = {}
): Promise<ParallelResult<Float64Array>> {
  const pool = options.pool ?? computePool;
  return pool.unary(data, fn);
}
