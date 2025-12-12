/**
 * Parallel Map and Transform Operations
 *
 * High-performance parallel map, filter, find, and sort operations.
 * Automatically chunks data for distribution across workers.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool } from '../ComputePool.js';
import type { ParallelResult } from '../ComputePool.js';

/**
 * Options for parallel map operations
 */
export interface MapOptions {
  /** Custom pool to use (defaults to global computePool) */
  pool?: ComputePool;
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution regardless of threshold */
  forceSequential?: boolean;
}

/**
 * Parallel map operation
 *
 * Applies a function to each element in parallel.
 *
 * @param data - Array to map over
 * @param fn - Function to apply to each element
 * @param options - Optional configuration
 * @returns Mapped array
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5];
 * const result = await parallelMap(data, x => x * x);
 * console.log(result.result); // [1, 4, 9, 16, 25]
 * ```
 */
export async function parallelMap<T, R>(
  data: T[],
  fn: (item: T) => R,
  options: MapOptions = {}
): Promise<ParallelResult<R[]>> {
  const pool = options.pool ?? computePool;
  return pool.map(data, fn);
}

/**
 * Parallel filter operation
 *
 * Filters elements based on a predicate in parallel.
 *
 * @param data - Array to filter
 * @param predicate - Function that returns true for elements to keep
 * @param options - Optional configuration
 * @returns Filtered array
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5, 6];
 * const result = await parallelFilter(data, x => x % 2 === 0);
 * console.log(result.result); // [2, 4, 6]
 * ```
 */
export async function parallelFilter<T>(
  data: T[],
  predicate: (item: T) => boolean,
  options: MapOptions = {}
): Promise<ParallelResult<T[]>> {
  const pool = options.pool ?? computePool;
  return pool.filter(data, predicate);
}

/**
 * Parallel find operation
 *
 * Finds the first element matching a predicate.
 * Searches chunks in parallel for early termination.
 *
 * @param data - Array to search
 * @param predicate - Function that returns true for the target element
 * @param options - Optional configuration
 * @returns Object with found status, value, and index
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5];
 * const result = await parallelFind(data, x => x > 3);
 * console.log(result.result); // { found: true, value: 4, index: 3 }
 * ```
 */
export async function parallelFind<T>(
  data: T[],
  predicate: (item: T) => boolean,
  options: MapOptions = {}
): Promise<ParallelResult<{ found: boolean; value?: T; index?: number }>> {
  const pool = options.pool ?? computePool;
  return pool.find(data, predicate);
}

/**
 * Parallel sort operation
 *
 * Sorts an array using parallel merge sort.
 * Each chunk is sorted in parallel, then merged.
 *
 * @param data - Array to sort
 * @param compare - Optional comparison function (default: ascending)
 * @param options - Optional configuration
 * @returns Sorted array
 *
 * @example
 * ```typescript
 * const data = [3, 1, 4, 1, 5, 9, 2, 6];
 * const result = await parallelSort(data);
 * console.log(result.result); // [1, 1, 2, 3, 4, 5, 6, 9]
 * ```
 */
export async function parallelSort<T>(
  data: T[],
  compare?: (a: T, b: T) => number,
  options: MapOptions = {}
): Promise<ParallelResult<T[]>> {
  const pool = options.pool ?? computePool;
  return pool.sort(data, compare);
}

/**
 * Parallel forEach (for side effects)
 *
 * Note: This executes the function for side effects only.
 * The function is serialized to workers, so it cannot access
 * closures or external state.
 *
 * @param data - Array to iterate
 * @param fn - Function to apply to each element
 * @param options - Optional configuration
 */
export async function parallelForEach<T>(
  data: T[],
  fn: (item: T) => void,
  options: MapOptions = {}
): Promise<ParallelResult<void[]>> {
  const pool = options.pool ?? computePool;
  const result = await pool.map(data, (item: T) => {
    fn(item);
    return undefined;
  });
  return {
    ...result,
    result: result.result as unknown as void[],
  };
}

/**
 * Parallel some operation
 *
 * Tests whether at least one element passes the predicate.
 *
 * @param data - Array to test
 * @param predicate - Test function
 * @param options - Optional configuration
 * @returns true if any element passes
 */
export async function parallelSome<T>(
  data: T[],
  predicate: (item: T) => boolean,
  options: MapOptions = {}
): Promise<ParallelResult<boolean>> {
  const pool = options.pool ?? computePool;
  const findResult = await pool.find(data, predicate);
  return {
    ...findResult,
    result: findResult.result.found,
  };
}

/**
 * Parallel every operation
 *
 * Tests whether all elements pass the predicate.
 *
 * @param data - Array to test
 * @param predicate - Test function
 * @param options - Optional configuration
 * @returns true if all elements pass
 */
export async function parallelEvery<T>(
  data: T[],
  predicate: (item: T) => boolean,
  options: MapOptions = {}
): Promise<ParallelResult<boolean>> {
  const pool = options.pool ?? computePool;
  // Find an element that doesn't pass - if found, not all pass
  const findResult = await pool.find(data, (item: T) => !predicate(item));
  return {
    ...findResult,
    result: !findResult.result.found,
  };
}

/**
 * Parallel count operation
 *
 * Counts elements matching a predicate.
 *
 * @param data - Array to count
 * @param predicate - Optional predicate (counts all if not provided)
 * @param options - Optional configuration
 * @returns Count of matching elements
 */
export async function parallelCount<T>(
  data: T[],
  predicate?: (item: T) => boolean,
  options: MapOptions = {}
): Promise<ParallelResult<number>> {
  const pool = options.pool ?? computePool;

  if (!predicate) {
    // No predicate, just return length
    return {
      result: data.length,
      duration: 0,
      chunks: 1,
      parallelized: false,
    };
  }

  const filterResult = await pool.filter(data, predicate);
  return {
    ...filterResult,
    result: filterResult.result.length,
  };
}
