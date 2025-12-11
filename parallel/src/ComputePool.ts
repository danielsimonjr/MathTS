/**
 * MathTS Compute Pool
 *
 * High-level wrapper around @mathts/workerpool for parallel computation in MathTS.
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
} from '@mathts/workerpool';

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
 * Wraps the @mathts/workerpool MathWorkerPool with a MathTS-specific API.
 *
 * @example
 * ```typescript
 * import { ComputePool } from '@mathts/parallel';
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
 * Re-export types from @mathts/workerpool
 */
export type { TaskOptions, PoolStats };
