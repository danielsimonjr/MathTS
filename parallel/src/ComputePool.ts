/**
 * MathTS Compute Pool
 *
 * High-level wrapper around workerpool for parallel computation in MathTS.
 * Provides automatic parallelization of matrix operations based on data size.
 *
 * @packageDocumentation
 */

import { pool, Pool, Transfer, type PoolOptions, type ExecOptions, type PoolStats } from 'workerpool';

/**
 * Configuration for ComputePool
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
 * ComputePool for parallel MathTS operations
 *
 * @example
 * ```typescript
 * import { ComputePool } from '@mathts/parallel';
 *
 * const pool = new ComputePool({ maxWorkers: 8 });
 * await pool.initialize();
 *
 * // Parallel matrix multiplication
 * const result = await pool.matmul(matrixA, matrixB);
 *
 * // Parallel element-wise operation
 * const sum = await pool.elementwise(a, b, 'add');
 *
 * // Cleanup
 * await pool.terminate();
 * ```
 */
export class ComputePool {
  private pool: Pool | null = null;
  private config: ComputePoolConfig;
  private initialized = false;

  constructor(config: Partial<ComputePoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.initialized = true;
      return;
    }

    if (this.pool) {
      return; // Already initialized
    }

    const options: PoolOptions = {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      workerType: this.config.workerType,
      workerTerminateTimeout: this.config.workerIdleTimeout,
    };

    this.pool = pool(options);
    this.initialized = true;
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.initialized && (this.pool !== null || !this.config.enabled);
  }

  /**
   * Determine if operation should be parallelized
   */
  shouldParallelize(elementCount: number): boolean {
    return (
      this.config.enabled &&
      this.pool !== null &&
      elementCount >= this.config.thresholdElements
    );
  }

  /**
   * Execute a function in the worker pool
   */
  async exec<T>(
    method: string,
    params: unknown[],
    options?: ExecOptions
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('ComputePool not initialized. Call initialize() first.');
    }

    const execOptions: ExecOptions = {
      ...options,
      timeout: options?.timeout ?? this.config.taskTimeout,
    };

    return this.pool.exec(method, params, execOptions) as Promise<T>;
  }

  /**
   * Get pool statistics
   */
  stats(): PoolStats {
    if (!this.pool) {
      return {
        totalWorkers: 0,
        busyWorkers: 0,
        idleWorkers: 0,
        pendingTasks: 0,
        activeTasks: 0,
      };
    }
    return this.pool.stats();
  }

  /**
   * Parallel sum of array elements
   */
  async sum(data: Float64Array): Promise<ParallelResult<number>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length)) {
      // Sequential fallback
      let total = 0;
      for (let i = 0; i < data.length; i++) {
        total += data[i];
      }
      return {
        result: total,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
      };
    }

    // Parallel execution
    const chunks = this.chunkData(data);
    const partialSums = await Promise.all(
      chunks.map((chunk) =>
        this.exec<number>('sumChunk', [chunk.buffer, 0, chunk.length], {
          transfer: [],
        })
      )
    );

    const result = partialSums.reduce((a, b) => a + b, 0);

    return {
      result,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
    };
  }

  /**
   * Parallel element-wise operation
   */
  async elementwise(
    a: Float64Array,
    b: Float64Array,
    op: 'add' | 'subtract' | 'multiply' | 'divide'
  ): Promise<ParallelResult<Float64Array>> {
    if (a.length !== b.length) {
      throw new Error(`Length mismatch: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length)) {
      // Sequential fallback
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) {
        switch (op) {
          case 'add':
            result[i] = a[i] + b[i];
            break;
          case 'subtract':
            result[i] = a[i] - b[i];
            break;
          case 'multiply':
            result[i] = a[i] * b[i];
            break;
          case 'divide':
            result[i] = a[i] / b[i];
            break;
        }
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
      };
    }

    // Parallel execution
    const chunkPairs = this.chunkDataPair(a, b);
    const results = await Promise.all(
      chunkPairs.map(([chunkA, chunkB]) =>
        this.exec<ArrayBuffer>('elementwiseChunk', [
          chunkA.buffer,
          chunkB.buffer,
          0,
          chunkA.length,
          op,
        ])
      )
    );

    // Combine results
    const combined = this.combineArrayBuffers(results, a.length);

    return {
      result: combined,
      duration: performance.now() - start,
      chunks: chunkPairs.length,
      parallelized: true,
    };
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
    const resultSize = aRows * bCols;
    const start = performance.now();

    if (!this.shouldParallelize(resultSize)) {
      // Sequential fallback
      const result = new Float64Array(resultSize);
      for (let i = 0; i < aRows; i++) {
        for (let j = 0; j < bCols; j++) {
          let sum = 0;
          for (let k = 0; k < aCols; k++) {
            sum += a[i * aCols + k] * b[k * bCols + j];
          }
          result[i * bCols + j] = sum;
        }
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
      };
    }

    // Parallel: distribute rows across workers
    const numWorkers = this.stats().totalWorkers;
    const rowsPerWorker = Math.ceil(aRows / numWorkers);
    const tasks: Promise<ArrayBuffer>[] = [];

    for (let w = 0; w < numWorkers; w++) {
      const rowStart = w * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, aRows);

      if (rowStart >= aRows) break;

      tasks.push(
        this.exec<ArrayBuffer>('matmulRows', [
          a.buffer,
          b.buffer,
          aRows,
          aCols,
          bCols,
          rowStart,
          rowEnd,
        ])
      );
    }

    const results = await Promise.all(tasks);

    // Combine row blocks
    const result = new Float64Array(resultSize);
    let offset = 0;
    for (const buf of results) {
      const chunk = new Float64Array(buf);
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      result,
      duration: performance.now() - start,
      chunks: tasks.length,
      parallelized: true,
    };
  }

  /**
   * Parallel map operation
   */
  async map<T, R>(
    data: T[],
    fn: (item: T) => R
  ): Promise<ParallelResult<R[]>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length)) {
      return {
        result: data.map(fn),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
      };
    }

    const chunks = this.chunkArray(data);
    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<R[]>('mapChunk', [chunk, fn.toString()])
      )
    );

    return {
      result: results.flat(),
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
    };
  }

  /**
   * Terminate the worker pool
   */
  async terminate(force = false): Promise<void> {
    if (this.pool) {
      await this.pool.terminate(force);
      this.pool = null;
    }
    this.initialized = false;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComputePoolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ComputePoolConfig {
    return { ...this.config };
  }

  // Helper methods

  private chunkData(data: Float64Array): Float64Array[] {
    const chunks: Float64Array[] = [];
    for (let i = 0; i < data.length; i += this.config.chunkSize) {
      const end = Math.min(i + this.config.chunkSize, data.length);
      chunks.push(data.subarray(i, end));
    }
    return chunks;
  }

  private chunkDataPair(a: Float64Array, b: Float64Array): [Float64Array, Float64Array][] {
    const pairs: [Float64Array, Float64Array][] = [];
    for (let i = 0; i < a.length; i += this.config.chunkSize) {
      const end = Math.min(i + this.config.chunkSize, a.length);
      pairs.push([a.subarray(i, end), b.subarray(i, end)]);
    }
    return pairs;
  }

  private chunkArray<T>(arr: T[]): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += this.config.chunkSize) {
      chunks.push(arr.slice(i, i + this.config.chunkSize));
    }
    return chunks;
  }

  private combineArrayBuffers(buffers: ArrayBuffer[], totalLength: number): Float64Array {
    const result = new Float64Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      const chunk = new Float64Array(buf);
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
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
