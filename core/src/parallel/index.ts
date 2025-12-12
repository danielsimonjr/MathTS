/**
 * MathTS Parallel Processing Module (LEGACY)
 *
 * @deprecated This module provides Promise.all()-based parallel utilities.
 * For worker pool-based parallel execution, use @mathts/parallel instead.
 *
 * The @mathts/parallel package provides ComputePool with true worker-based
 * parallelization for significantly better performance on large datasets.
 *
 * Migration example:
 * ```typescript
 * // Before (this module):
 * import { parallelSum, parallelMap } from '@mathts/core';
 *
 * // After (@mathts/parallel - recommended):
 * import { computePool } from '@mathts/parallel';
 * const result = await computePool.sum(data);
 * const mapped = await computePool.map(data, fn);
 * ```
 *
 * This module will be removed in a future major version.
 *
 * @packageDocumentation
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  /** Enable parallel processing globally */
  enabled: boolean;
  /** Number of workers to use (0 = auto-detect) */
  workers: number;
  /** Minimum elements to trigger parallelization */
  threshold: number;
  /** Default chunk size for parallel operations */
  chunkSize: number;
  /** Task timeout in milliseconds */
  timeout: number;
}

/**
 * Default parallel configuration
 */
export const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  enabled: true,
  workers: 0, // Auto-detect
  threshold: 1000, // Lower threshold for parallel-first approach
  chunkSize: 2500,
  timeout: 300000,
};

/**
 * Global parallel configuration
 */
let globalConfig: ParallelConfig = { ...DEFAULT_PARALLEL_CONFIG };

/**
 * Get current parallel configuration
 */
export function getParallelConfig(): Readonly<ParallelConfig> {
  return { ...globalConfig };
}

/**
 * Update parallel configuration
 */
export function setParallelConfig(config: Partial<ParallelConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Reset parallel configuration to defaults
 */
export function resetParallelConfig(): void {
  globalConfig = { ...DEFAULT_PARALLEL_CONFIG };
}

// =============================================================================
// Execution Result Types
// =============================================================================

/**
 * Result of a parallel operation with performance metadata
 */
export interface ParallelResult<T> {
  /** The computed result */
  value: T;
  /** Time taken in milliseconds */
  duration: number;
  /** Whether parallelization was used */
  parallelized: boolean;
  /** Number of chunks processed */
  chunks: number;
  /** Number of workers used */
  workers: number;
}

/**
 * Options for parallel execution
 */
export interface ParallelOptions {
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution */
  forceSequential?: boolean;
  /** Custom chunk size */
  chunkSize?: number;
  /** Custom timeout */
  timeout?: number;
  /** Custom threshold */
  threshold?: number;
}

// =============================================================================
// Core Parallel Utilities
// =============================================================================

/**
 * Get the number of available CPU cores
 */
export function getCpuCount(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  // Node.js environment
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');
    return os.cpus().length;
  } catch {
    return 4; // Default fallback
  }
}

/**
 * Determine if operation should be parallelized
 */
export function shouldParallelize(
  elementCount: number,
  options?: ParallelOptions
): boolean {
  if (!globalConfig.enabled) return false;
  if (options?.forceSequential) return false;
  if (options?.forceParallel) return true;

  const threshold = options?.threshold ?? globalConfig.threshold;
  return elementCount >= threshold;
}

/**
 * Split an array into chunks for parallel processing
 */
export function chunkArray<T>(
  array: T[],
  chunkSize: number = globalConfig.chunkSize
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Split a Float64Array into chunks
 */
export function chunkFloat64Array(
  array: Float64Array,
  chunkSize: number = globalConfig.chunkSize
): Float64Array[] {
  const chunks: Float64Array[] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.subarray(i, Math.min(i + chunkSize, array.length)));
  }
  return chunks;
}

// =============================================================================
// Parallel Array Operations (Main Thread Fallback)
// =============================================================================

/**
 * Parallel map operation
 * Uses Promise.all for concurrent execution when parallelization is beneficial
 */
export async function parallelMap<T, R>(
  array: T[],
  fn: (item: T, index: number) => R | Promise<R>,
  options?: ParallelOptions
): Promise<ParallelResult<R[]>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    // Sequential execution
    const result: R[] = [];
    for (let i = 0; i < array.length; i++) {
      result.push(await fn(array[i], i));
    }
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  // Parallel execution using Promise.all
  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, chunkIndex) => {
      const results: R[] = [];
      const baseIndex = chunkIndex * chunkSize;
      for (let i = 0; i < chunk.length; i++) {
        results.push(await fn(chunk[i], baseIndex + i));
      }
      return results;
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel reduce operation
 */
export async function parallelReduce<T, R>(
  array: T[],
  fn: (acc: R, item: T, index: number) => R | Promise<R>,
  initial: R,
  options?: ParallelOptions
): Promise<ParallelResult<R>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    let acc = initial;
    for (let i = 0; i < array.length; i++) {
      acc = await fn(acc, array[i], i);
    }
    return {
      value: acc,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  // Parallel reduction: reduce chunks in parallel, then combine
  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  const partialResults = await Promise.all(
    chunks.map(async (chunk, chunkIndex) => {
      let acc = initial;
      const baseIndex = chunkIndex * chunkSize;
      for (let i = 0; i < chunk.length; i++) {
        acc = await fn(acc, chunk[i], baseIndex + i);
      }
      return acc;
    })
  );

  // Combine partial results
  let finalResult = initial;
  for (const partial of partialResults) {
    // Use fn to combine, treating partial as an item
    finalResult = await fn(finalResult, partial as unknown as T, 0);
  }

  return {
    value: finalResult,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel filter operation
 */
export async function parallelFilter<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean | Promise<boolean>,
  options?: ParallelOptions
): Promise<ParallelResult<T[]>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    const result: T[] = [];
    for (let i = 0; i < array.length; i++) {
      if (await predicate(array[i], i)) {
        result.push(array[i]);
      }
    }
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, chunkIndex) => {
      const results: T[] = [];
      const baseIndex = chunkIndex * chunkSize;
      for (let i = 0; i < chunk.length; i++) {
        if (await predicate(chunk[i], baseIndex + i)) {
          results.push(chunk[i]);
        }
      }
      return results;
    })
  );

  return {
    value: chunkResults.flat(),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel find operation
 */
export async function parallelFind<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean | Promise<boolean>,
  options?: ParallelOptions
): Promise<ParallelResult<T | undefined>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    for (let i = 0; i < array.length; i++) {
      if (await predicate(array[i], i)) {
        return {
          value: array[i],
          duration: performance.now() - start,
          parallelized: false,
          chunks: 1,
          workers: 0,
        };
      }
    }
    return {
      value: undefined,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  // Race chunks to find first match
  const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
    const baseIndex = chunkIndex * chunkSize;
    for (let i = 0; i < chunk.length; i++) {
      if (await predicate(chunk[i], baseIndex + i)) {
        return { found: true, value: chunk[i], index: baseIndex + i };
      }
    }
    return { found: false, value: undefined, index: -1 };
  });

  const results = await Promise.all(chunkPromises);

  // Find first match by index
  let firstMatch: { value: T | undefined; index: number } = { value: undefined, index: -1 };
  for (const result of results) {
    if (result.found && (firstMatch.index === -1 || result.index < firstMatch.index)) {
      firstMatch = { value: result.value as T, index: result.index };
    }
  }

  return {
    value: firstMatch.value,
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel every operation (all elements match predicate)
 */
export async function parallelEvery<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean | Promise<boolean>,
  options?: ParallelOptions
): Promise<ParallelResult<boolean>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    for (let i = 0; i < array.length; i++) {
      if (!(await predicate(array[i], i))) {
        return {
          value: false,
          duration: performance.now() - start,
          parallelized: false,
          chunks: 1,
          workers: 0,
        };
      }
    }
    return {
      value: true,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, chunkIndex) => {
      const baseIndex = chunkIndex * chunkSize;
      for (let i = 0; i < chunk.length; i++) {
        if (!(await predicate(chunk[i], baseIndex + i))) {
          return false;
        }
      }
      return true;
    })
  );

  return {
    value: chunkResults.every(Boolean),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel some operation (any element matches predicate)
 */
export async function parallelSome<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean | Promise<boolean>,
  options?: ParallelOptions
): Promise<ParallelResult<boolean>> {
  const start = performance.now();

  if (!shouldParallelize(array.length, options)) {
    for (let i = 0; i < array.length; i++) {
      if (await predicate(array[i], i)) {
        return {
          value: true,
          duration: performance.now() - start,
          parallelized: false,
          chunks: 1,
          workers: 0,
        };
      }
    }
    return {
      value: false,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(array, chunkSize);

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, chunkIndex) => {
      const baseIndex = chunkIndex * chunkSize;
      for (let i = 0; i < chunk.length; i++) {
        if (await predicate(chunk[i], baseIndex + i)) {
          return true;
        }
      }
      return false;
    })
  );

  return {
    value: chunkResults.some(Boolean),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

// =============================================================================
// Parallel Numeric Operations
// =============================================================================

/**
 * Parallel sum of numbers
 */
export async function parallelSum(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<number>> {
  const start = performance.now();
  const arr = array instanceof Float64Array ? Array.from(array) : array;

  if (!shouldParallelize(arr.length, options)) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return {
      value: sum,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(arr, chunkSize);

  const partialSums = await Promise.all(
    chunks.map(async (chunk) => {
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) {
        sum += chunk[i];
      }
      return sum;
    })
  );

  return {
    value: partialSums.reduce((a, b) => a + b, 0),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel product of numbers
 */
export async function parallelProduct(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<number>> {
  const start = performance.now();
  const arr = array instanceof Float64Array ? Array.from(array) : array;

  if (!shouldParallelize(arr.length, options)) {
    let product = 1;
    for (let i = 0; i < arr.length; i++) {
      product *= arr[i];
    }
    return {
      value: product,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(arr, chunkSize);

  const partialProducts = await Promise.all(
    chunks.map(async (chunk) => {
      let product = 1;
      for (let i = 0; i < chunk.length; i++) {
        product *= chunk[i];
      }
      return product;
    })
  );

  return {
    value: partialProducts.reduce((a, b) => a * b, 1),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel min/max
 */
export async function parallelMinMax(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<{ min: number; max: number }>> {
  const start = performance.now();
  const arr = array instanceof Float64Array ? Array.from(array) : array;

  if (arr.length === 0) {
    return {
      value: { min: Infinity, max: -Infinity },
      duration: performance.now() - start,
      parallelized: false,
      chunks: 0,
      workers: 0,
    };
  }

  if (!shouldParallelize(arr.length, options)) {
    let min = arr[0];
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }
    return {
      value: { min, max },
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(arr, chunkSize);

  const partialResults = await Promise.all(
    chunks.map(async (chunk) => {
      let min = chunk[0];
      let max = chunk[0];
      for (let i = 1; i < chunk.length; i++) {
        if (chunk[i] < min) min = chunk[i];
        if (chunk[i] > max) max = chunk[i];
      }
      return { min, max };
    })
  );

  let finalMin = partialResults[0].min;
  let finalMax = partialResults[0].max;
  for (let i = 1; i < partialResults.length; i++) {
    if (partialResults[i].min < finalMin) finalMin = partialResults[i].min;
    if (partialResults[i].max > finalMax) finalMax = partialResults[i].max;
  }

  return {
    value: { min: finalMin, max: finalMax },
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

/**
 * Parallel mean calculation
 */
export async function parallelMean(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<number>> {
  const sumResult = await parallelSum(array, options);
  const len = array instanceof Float64Array ? array.length : array.length;
  return {
    ...sumResult,
    value: len > 0 ? sumResult.value / len : 0,
  };
}

/**
 * Parallel variance calculation
 */
export async function parallelVariance(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<number>> {
  const start = performance.now();
  const arr = array instanceof Float64Array ? Array.from(array) : array;

  if (arr.length <= 1) {
    return {
      value: 0,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  // Calculate mean first
  const meanResult = await parallelMean(arr, options);
  const mean = meanResult.value;

  // Calculate sum of squared differences
  const squaredDiffs = arr.map(x => (x - mean) ** 2);
  const sumSquaredDiffs = await parallelSum(squaredDiffs, options);

  return {
    value: sumSquaredDiffs.value / arr.length,
    duration: performance.now() - start,
    parallelized: meanResult.parallelized || sumSquaredDiffs.parallelized,
    chunks: Math.max(meanResult.chunks, sumSquaredDiffs.chunks),
    workers: Math.max(meanResult.workers, sumSquaredDiffs.workers),
  };
}

/**
 * Parallel standard deviation calculation
 */
export async function parallelStdDev(
  array: number[] | Float64Array,
  options?: ParallelOptions
): Promise<ParallelResult<number>> {
  const varianceResult = await parallelVariance(array, options);
  return {
    ...varianceResult,
    value: Math.sqrt(varianceResult.value),
  };
}

// =============================================================================
// Parallel Execution Utilities
// =============================================================================

/**
 * Execute multiple independent tasks in parallel
 */
export async function parallelAll<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: () => Promise<T[K]> | T[K] }
): Promise<ParallelResult<T>> {
  const start = performance.now();

  const results = await Promise.all(tasks.map(task => task())) as unknown as T;

  return {
    value: results,
    duration: performance.now() - start,
    parallelized: true,
    chunks: tasks.length,
    workers: Math.min(tasks.length, getCpuCount()),
  };
}

/**
 * Execute tasks with a concurrency limit
 */
export async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R> | R,
  limit: number = getCpuCount()
): Promise<ParallelResult<R[]>> {
  const start = performance.now();
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array(Math.min(limit, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);

  return {
    value: results,
    duration: performance.now() - start,
    parallelized: limit > 1 && items.length > 1,
    chunks: items.length,
    workers: Math.min(limit, items.length),
  };
}

/**
 * Race multiple tasks, return first to complete
 */
export async function parallelRace<T>(
  tasks: (() => Promise<T> | T)[]
): Promise<ParallelResult<T>> {
  const start = performance.now();

  const result = await Promise.race(tasks.map(task => task()));

  return {
    value: result,
    duration: performance.now() - start,
    parallelized: true,
    chunks: tasks.length,
    workers: tasks.length,
  };
}

// =============================================================================
// Batch Operations for Custom Types
// =============================================================================

/**
 * Parallel batch operation on custom types
 */
export async function parallelBatch<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]> | R[],
  combiner: (results: R[][]) => R[],
  options?: ParallelOptions
): Promise<ParallelResult<R[]>> {
  const start = performance.now();

  if (!shouldParallelize(items.length, options)) {
    const result = await operation(items);
    return {
      value: result,
      duration: performance.now() - start,
      parallelized: false,
      chunks: 1,
      workers: 0,
    };
  }

  const chunkSize = options?.chunkSize ?? globalConfig.chunkSize;
  const chunks = chunkArray(items, chunkSize);

  const chunkResults = await Promise.all(chunks.map(chunk => operation(chunk)));

  return {
    value: combiner(chunkResults),
    duration: performance.now() - start,
    parallelized: true,
    chunks: chunks.length,
    workers: Math.min(chunks.length, getCpuCount()),
  };
}

// =============================================================================
// Parallel Iterator Utilities
// =============================================================================

/**
 * Create a parallel iterable from an array
 */
export function* parallelIterator<T>(
  array: T[],
  chunkSize: number = globalConfig.chunkSize
): Generator<T[], void, unknown> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize);
  }
}

/**
 * Async parallel iterator
 */
export async function* asyncParallelIterator<T, R>(
  array: T[],
  fn: (chunk: T[]) => Promise<R[]>,
  chunkSize: number = globalConfig.chunkSize
): AsyncGenerator<R[], void, unknown> {
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    yield await fn(chunk);
  }
}
