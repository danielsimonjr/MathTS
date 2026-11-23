/**
 * Parallel Map and Transform Operations
 *
 * High-performance parallel map, filter, find, and sort operations.
 * Automatically chunks data for distribution across workers.
 *
 * @packageDocumentation
 */

import { assertArrayData } from '@danielsimonjr/mathts-workerpool';
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
 * Give a wrapper a worker-safe source text.
 *
 * The worker pool calls `wrapper(item)` on the sequential path and sends
 * `wrapper.toString()` to the workers on the parallel path. The source of a wrapper
 * that calls the user's function through a closure variable has a free variable, and
 * the worker throws `ReferenceError`. This helper overrides `toString()` so that the
 * text embeds the source of the user's function. The wrapper itself stays a closure,
 * so the sequential path accepts every callable (closures, bound, native and method
 * functions), and the main thread compiles no code from a string.
 *
 * @param wrapper - Closure over `fn`; runs on the sequential path
 * @param fn - User function
 * @param source - Builds the wrapper source from the parenthesised source of `fn`
 */
function withInlinedSource<W extends (...args: never[]) => unknown>(
  wrapper: W,
  fn: (...args: never[]) => unknown,
  source: (fnSource: string) => string
): W {
  wrapper.toString = () => source(`(${fn.toString()})`);
  return wrapper;
}

/**
 * Parallel map operation
 *
 * Applies a function to each element in parallel.
 *
 * On the worker path the function is serialized to workers, so it cannot access
 * closures or external state. Pass a self-contained function.
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
  return pool.map(data, fn, options);
}

/**
 * Parallel filter operation
 *
 * Filters elements based on a predicate in parallel.
 *
 * On the worker path the function is serialized to workers, so it cannot access
 * closures or external state. Pass a self-contained function.
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
  return pool.filter(data, predicate, options);
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
  return pool.find(data, predicate, options);
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
  return pool.sort(data, compare, options);
}

/**
 * Parallel forEach (for side effects)
 *
 * Note: This executes the function for side effects only.
 * On the worker path the function is serialized to workers, so it cannot access
 * closures or external state, and its side effects occur in the worker.
 * Pass a self-contained function.
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
  const wrapped = withInlinedSource(
    (item: T): undefined => {
      fn(item);
      return undefined;
    },
    fn,
    (f) => `(item) => { ${f}(item); return undefined; }`
  );
  const result = await pool.map(data, wrapped, options);
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
 * On the worker path the function is serialized to workers, so it cannot access
 * closures or external state. Pass a self-contained function.
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
  const findResult = await pool.find(data, predicate, options);
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
 * On the worker path the function is serialized to workers, so it cannot access
 * closures or external state. Pass a self-contained function.
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
  const findResult = await pool.find(
    data,
    withInlinedSource(
      (item: T) => !predicate(item),
      predicate,
      (f) => `(item) => !${f}(item)`
    ),
    options
  );
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
  // Reads only `length`, so check without a copy; a non-array has no length to count.
  assertArrayData('count', data);

  if (!predicate) {
    // No predicate, just return length
    return {
      result: data.length,
      duration: 0,
      chunks: 1,
      parallelized: false,
    };
  }

  const filterResult = await pool.filter(data, predicate, options);
  return {
    ...filterResult,
    result: filterResult.result.length,
  };
}
