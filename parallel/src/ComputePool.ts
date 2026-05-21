/**
 * MathTS Compute Pool
 *
 * High-level wrapper around @danielsimonjr/mathts-workerpool for parallel computation in MathTS.
 * Provides automatic parallelization of matrix operations based on data size.
 *
 * @packageDocumentation
 */

import {
  MathWorkerPool,
  Transfer,
  type WorkerPoolConfig,
  type ParallelResult as WorkerParallelResult,
  type TaskOptions,
  type PoolStats,
} from '@danielsimonjr/mathts-workerpool';

/**
 * Configuration for ComputePool
 * Extends the base WorkerPoolConfig with MathTS-specific options
 */
export interface ComputePoolConfig {
  /** Enable parallel processing */
  enabled: boolean;
  /** Minimum number of workers to maintain */
  minWorkers: number;
  /** Maximum number of workers */
  maxWorkers: number;
  /** Minimum elements before parallelizing */
  thresholdElements: number;
  /** Elements per chunk for parallel operations */
  chunkSize: number;
  /** Worker type: 'auto' | 'web' | 'thread' */
  workerType: 'auto' | 'web' | 'thread';
  /** Worker idle timeout in milliseconds */
  workerIdleTimeout: number;
  /** Default task timeout in milliseconds */
  taskTimeout: number;
}

/**
 * Default ComputePool configuration
 */
export const DEFAULT_POOL_CONFIG: ComputePoolConfig = {
  enabled: true,
  minWorkers: 1,
  maxWorkers: typeof navigator !== 'undefined'
    ? navigator.hardwareConcurrency || 4
    : 4,
  thresholdElements: 50000,
  chunkSize: 10000,
  workerType: 'auto',
  workerIdleTimeout: 60000,
  taskTimeout: 300000, // 5 minutes
};

/**
 * Result of a parallel operation
 */
export interface ParallelResult<T> {
  /** The computed result */
  result: T;
  /** Time taken in milliseconds */
  duration: number;
  /** Number of chunks processed */
  chunks: number;
  /** Whether parallelization was used */
  parallelized: boolean;
}

/**
 * Convert WorkerParallelResult to ParallelResult (drops workersUsed)
 */
function toParallelResult<T>(result: WorkerParallelResult<T>): ParallelResult<T> {
  return {
    result: result.result,
    duration: result.duration,
    chunks: result.chunks,
    parallelized: result.parallelized,
  };
}

/**
 * Convert ComputePoolConfig to WorkerPoolConfig
 */
function toWorkerConfig(config: ComputePoolConfig): Partial<WorkerPoolConfig> {
  return {
    enabled: config.enabled,
    minWorkers: config.minWorkers,
    maxWorkers: config.maxWorkers,
    parallelThreshold: config.thresholdElements,
    chunkSize: config.chunkSize,
    workerType: config.workerType,
    idleTimeout: config.workerIdleTimeout,
    taskTimeout: config.taskTimeout,
  };
}

/**
 * ComputePool for parallel MathTS operations
 *
 * Wraps the @danielsimonjr/mathts-workerpool MathWorkerPool with a MathTS-specific API.
 *
 * @example
 * ```typescript
 * import { ComputePool } from '@danielsimonjr/mathts-parallel';
 *
 * const pool = new ComputePool({ maxWorkers: 8 });
 * await pool.initialize();
 *
 * // Parallel matrix multiplication
 * const result = await pool.matmul(matrixA, aRows, aCols, matrixB, bCols);
 *
 * // Parallel element-wise operation
 * const sum = await pool.elementwise(a, b, 'add');
 *
 * // Cleanup
 * await pool.terminate();
 * ```
 */
export class ComputePool {
  private workerPool: MathWorkerPool;
  private config: ComputePoolConfig;

  constructor(config: Partial<ComputePoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.workerPool = new MathWorkerPool(toWorkerConfig(this.config));
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    await this.workerPool.initialize();
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.workerPool.isReady();
  }

  /**
   * Determine if operation should be parallelized
   */
  shouldParallelize(elementCount: number): boolean {
    return this.workerPool.shouldParallelize(elementCount);
  }

  /**
   * Execute a method in the worker pool
   */
  async exec<T>(
    method: string,
    params: unknown[],
    options?: TaskOptions
  ): Promise<T> {
    return this.workerPool.exec<T>(method, params, options);
  }

  /**
   * Get pool statistics
   */
  stats(): PoolStats {
    return this.workerPool.stats();
  }

  /**
   * Parallel sum of array elements
   */
  async sum(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.workerPool.sum(data);
    return toParallelResult(result);
  }

  /**
   * Parallel dot product
   */
  async dot(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.workerPool.dot(a, b);
    return toParallelResult(result);
  }

  /**
   * Parallel element-wise operation
   */
  async elementwise(
    a: Float64Array,
    b: Float64Array,
    op: 'add' | 'subtract' | 'multiply' | 'divide'
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.elementwise(a, b, op);
    return toParallelResult(result);
  }

  /**
   * Parallel scale operation
   */
  async scale(data: Float64Array, scalar: number): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.scale(data, scalar);
    return toParallelResult(result);
  }

  /**
   * Parallel matrix multiplication
   *
   * @param a - First matrix as flat Float64Array (row-major)
   * @param aRows - Number of rows in A
   * @param aCols - Number of columns in A
   * @param b - Second matrix as flat Float64Array (row-major)
   * @param bCols - Number of columns in B
   */
  async matmul(
    a: Float64Array,
    aRows: number,
    aCols: number,
    b: Float64Array,
    bCols: number
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.matmul(a, aRows, aCols, b, bCols);
    return toParallelResult(result);
  }

  /**
   * Parallel matrix transpose
   */
  async transpose(
    data: Float64Array,
    rows: number,
    cols: number
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.transpose(data, rows, cols);
    return toParallelResult(result);
  }

  /**
   * Parallel map operation
   */
  async map<T, R>(
    data: T[],
    fn: (item: T) => R
  ): Promise<ParallelResult<R[]>> {
    const result = await this.workerPool.map(data, fn);
    return toParallelResult(result);
  }

  /**
   * Parallel reduce operation
   */
  async reduce<T, R>(
    data: T[],
    fn: (acc: R, item: T) => R,
    initial: R
  ): Promise<ParallelResult<R>> {
    const result = await this.workerPool.reduce(data, fn, initial);
    return toParallelResult(result);
  }

  /**
   * Parallel filter operation
   */
  async filter<T>(
    data: T[],
    predicate: (item: T) => boolean
  ): Promise<ParallelResult<T[]>> {
    const result = await this.workerPool.filter(data, predicate);
    return toParallelResult(result);
  }

  // =========================================================================
  // Statistical Operations
  // =========================================================================

  /**
   * Find min and max values in parallel
   */
  async minMax(
    data: Float64Array
  ): Promise<ParallelResult<{ min: number; max: number; minIdx: number; maxIdx: number }>> {
    const result = await this.workerPool.minMax(data);
    return toParallelResult(result);
  }

  /**
   * Compute variance, mean, and standard deviation in parallel
   */
  async variance(
    data: Float64Array
  ): Promise<ParallelResult<{ mean: number; variance: number; std: number }>> {
    const result = await this.workerPool.variance(data);
    return toParallelResult(result);
  }

  /**
   * Compute norm (Euclidean length) in parallel
   */
  async norm(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.workerPool.norm(data);
    return toParallelResult(result);
  }

  /**
   * Compute Euclidean distance in parallel
   */
  async distance(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.workerPool.distance(a, b);
    return toParallelResult(result);
  }

  /**
   * Compute histogram in parallel
   */
  async histogram(
    data: Float64Array,
    bins: number,
    min?: number,
    max?: number
  ): Promise<ParallelResult<number[]>> {
    const result = await this.workerPool.histogram(data, bins, min, max);
    return toParallelResult(result);
  }

  // =========================================================================
  // Unary Operations
  // =========================================================================

  /**
   * Apply unary function in parallel
   */
  async unary(
    data: Float64Array,
    fn: 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square'
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.unary(data, fn);
    return toParallelResult(result);
  }

  /**
   * Apply a caller-supplied unary numeric function in parallel.
   *
   * @param data - Input values
   * @param fnSource - Source of a self-contained `(x: number) => number`
   *   expression. It must not reference free variables / closures, since it
   *   is eval'd in an isolated worker context. Used to parallelize element-wise
   *   math (special functions, distribution PDFs/CDFs).
   */
  async applyKernel(
    data: Float64Array,
    fnSource: string
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.applyKernel(data, fnSource);
    return toParallelResult(result);
  }

  /**
   * Parallel absolute value
   */
  async abs(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'abs');
  }

  /**
   * Parallel square root
   */
  async sqrt(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'sqrt');
  }

  /**
   * Parallel exponential
   */
  async exp(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'exp');
  }

  /**
   * Parallel natural log
   */
  async log(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'log');
  }

  /**
   * Parallel sine
   */
  async sin(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'sin');
  }

  /**
   * Parallel cosine
   */
  async cos(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'cos');
  }

  /**
   * Parallel tangent
   */
  async tan(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'tan');
  }

  /**
   * Parallel negation
   */
  async negate(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'negate');
  }

  /**
   * Parallel square
   */
  async square(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.unary(data, 'square');
  }

  // =========================================================================
  // Additional Matrix Operations
  // =========================================================================

  /**
   * Parallel matrix-vector multiplication
   */
  async matvec(
    matrix: Float64Array,
    rows: number,
    cols: number,
    vector: Float64Array
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.matvec(matrix, rows, cols, vector);
    return toParallelResult(result);
  }

  /**
   * Parallel outer product
   */
  async outer(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.outer(a, b);
    return toParallelResult(result);
  }

  // =========================================================================
  // Search and Sort Operations
  // =========================================================================

  /**
   * Parallel find operation
   */
  async find<T>(
    data: T[],
    predicate: (item: T) => boolean
  ): Promise<ParallelResult<{ found: boolean; value?: T; index?: number }>> {
    const result = await this.workerPool.find(data, predicate);
    return toParallelResult(result);
  }

  /**
   * Parallel sort operation
   */
  async sort<T>(
    data: T[],
    compare?: (a: T, b: T) => number
  ): Promise<ParallelResult<T[]>> {
    const result = await this.workerPool.sort(data, compare);
    return toParallelResult(result);
  }

  // =========================================================================
  // Convenience Methods
  // =========================================================================

  /**
   * Parallel addition of two arrays
   */
  async add(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.elementwise(a, b, 'add');
  }

  /**
   * Parallel subtraction of two arrays
   */
  async subtract(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.elementwise(a, b, 'subtract');
  }

  /**
   * Parallel element-wise multiplication
   */
  async multiply(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.elementwise(a, b, 'multiply');
  }

  /**
   * Parallel element-wise division
   */
  async divide(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    return this.elementwise(a, b, 'divide');
  }

  /**
   * Compute mean in parallel (uses variance internally)
   */
  async mean(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.variance(data);
    return {
      ...result,
      result: result.result.mean,
    };
  }

  /**
   * Compute standard deviation in parallel
   */
  async std(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.variance(data);
    return {
      ...result,
      result: result.result.std,
    };
  }

  /**
   * Find minimum value in parallel
   */
  async min(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.minMax(data);
    return {
      ...result,
      result: result.result.min,
    };
  }

  /**
   * Find maximum value in parallel
   */
  async max(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.minMax(data);
    return {
      ...result,
      result: result.result.max,
    };
  }

  /**
   * Terminate the worker pool
   */
  async terminate(force = false): Promise<void> {
    await this.workerPool.terminate(force);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComputePoolConfig>): void {
    this.config = { ...this.config, ...config };
    this.workerPool.updateConfig(toWorkerConfig(this.config));
  }

  /**
   * Get current configuration
   */
  getConfig(): ComputePoolConfig {
    return { ...this.config };
  }

  /**
   * Get the underlying MathWorkerPool for advanced operations
   */
  getWorkerPool(): MathWorkerPool {
    return this.workerPool;
  }
}

/**
 * Global compute pool instance
 */
export const computePool = new ComputePool();

/**
 * Create a Transferable wrapper for zero-copy data transfer
 */
export { Transfer };

/**
 * Re-export types from @danielsimonjr/mathts-workerpool
 */
export type { TaskOptions, PoolStats };
