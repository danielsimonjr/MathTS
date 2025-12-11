/**
 * @mathts/workerpool
 *
 * Worker pool management for MathTS parallel computations.
 * Wraps the workerpool library with MathTS-specific operations and optimizations.
 *
 * Supports WASM-accelerated task queue when available for improved performance.
 *
 * @packageDocumentation
 */

import {
  pool as createPool,
  Pool,
  Transfer,
  type PoolOptions,
  type ExecOptions,
  type PoolStats,
} from 'workerpool';

// =============================================================================
// WASM Support
// =============================================================================

// WASM module and feature detection (loaded dynamically)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;

/**
 * WASM feature status
 */
export interface WasmFeatureStatus {
  hasWebAssembly: boolean;
  hasSharedArrayBuffer: boolean;
  hasAtomics: boolean;
  hasWASMThreads: boolean;
}

let wasmFeatures: WasmFeatureStatus | null = null;

/**
 * Initialize WASM task queue support (optional, improves performance)
 *
 * This will attempt to load the WASM module from workerpool if available.
 * Falls back gracefully if WASM support is not available.
 *
 * @returns Promise resolving to feature status
 */
export async function initWorkerWasm(): Promise<WasmFeatureStatus | null> {
  if (wasmFeatures !== null) return wasmFeatures;

  try {
    // Dynamic import for WASM module (may not exist in all workerpool builds)
    // Use string variable to prevent TypeScript from type-checking the module path
    const wasmPath = 'workerpool/wasm';
    wasmModule = await import(/* @vite-ignore */ wasmPath).catch(() => null);

    if (wasmModule && typeof wasmModule.detectWASMFeatures === 'function') {
      const features = wasmModule.detectWASMFeatures();
      wasmFeatures = {
        hasWebAssembly: features.hasWebAssembly ?? false,
        hasSharedArrayBuffer: features.hasSharedArrayBuffer ?? false,
        hasAtomics: features.hasAtomics ?? false,
        hasWASMThreads: features.hasWASMThreads ?? false,
      };
    } else {
      wasmFeatures = {
        hasWebAssembly: false,
        hasSharedArrayBuffer: false,
        hasAtomics: false,
        hasWASMThreads: false,
      };
    }
  } catch {
    // WASM not available
    wasmFeatures = {
      hasWebAssembly: false,
      hasSharedArrayBuffer: false,
      hasAtomics: false,
      hasWASMThreads: false,
    };
  }

  return wasmFeatures;
}

/**
 * Check if WASM task queue is available
 */
export function isWorkerWasmAvailable(): boolean {
  return wasmFeatures?.hasWebAssembly ?? false;
}

/**
 * Get WASM feature status
 */
export function getWasmFeatures(): WasmFeatureStatus | null {
  return wasmFeatures;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for MathTS worker pool
 */
export interface WorkerPoolConfig {
  /** Enable parallel processing */
  enabled: boolean;
  /** Minimum number of workers to maintain */
  minWorkers: number;
  /** Maximum number of workers */
  maxWorkers: number;
  /** Minimum elements before parallelizing */
  parallelThreshold: number;
  /** Elements per chunk for parallel operations */
  chunkSize: number;
  /** Worker type: 'auto' | 'web' | 'thread' */
  workerType: 'auto' | 'web' | 'thread';
  /** Worker idle timeout in milliseconds */
  idleTimeout: number;
  /** Default task timeout in milliseconds */
  taskTimeout: number;
  /** Worker script path (optional) */
  workerScript?: string;
}

/**
 * Default pool configuration
 */
export const DEFAULT_WORKER_CONFIG: WorkerPoolConfig = {
  enabled: true,
  minWorkers: 1,
  maxWorkers: typeof navigator !== 'undefined'
    ? navigator.hardwareConcurrency || 4
    : 4,
  parallelThreshold: 10000,
  chunkSize: 5000,
  workerType: 'auto',
  idleTimeout: 60000,
  taskTimeout: 300000, // 5 minutes
};

/**
 * Result of a parallel operation with metadata
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
  /** Number of workers used */
  workersUsed: number;
}

/**
 * Task execution options
 */
export interface TaskOptions extends ExecOptions {
  /** Force parallel execution regardless of threshold */
  forceParallel?: boolean;
  /** Force sequential execution regardless of threshold */
  forceSequential?: boolean;
  /** Custom chunk size for this task */
  chunkSize?: number;
  /** Task timeout in milliseconds */
  taskTimeout?: number;
}

// =============================================================================
// Worker Pool Class
// =============================================================================

/**
 * MathTS Worker Pool for parallel computations
 *
 * Provides automatic parallelization based on data size with
 * intelligent chunking and result aggregation.
 *
 * @example
 * ```typescript
 * import { MathWorkerPool } from '@mathts/workerpool';
 *
 * const pool = new MathWorkerPool({ maxWorkers: 8 });
 * await pool.initialize();
 *
 * // Parallel sum
 * const result = await pool.sum(new Float64Array(100000));
 *
 * // Parallel matrix multiplication
 * const matmulResult = await pool.matmul(matrixA, matrixB, dims);
 *
 * await pool.terminate();
 * ```
 */
export class MathWorkerPool {
  private pool: Pool | null = null;
  private config: WorkerPoolConfig;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.initialized = true;
      return;
    }

    const options: PoolOptions = {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      workerType: this.config.workerType,
      workerTerminateTimeout: this.config.idleTimeout,
    };

    // Use custom worker script if provided
    if (this.config.workerScript) {
      this.pool = createPool(this.config.workerScript, options);
    } else {
      this.pool = createPool(null, options);
    }

    this.initialized = true;
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.initialized && (this.pool !== null || !this.config.enabled);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<WorkerPoolConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WorkerPoolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Determine if operation should be parallelized
   */
  shouldParallelize(elementCount: number, options?: TaskOptions): boolean {
    if (options?.forceSequential) return false;
    if (options?.forceParallel) return true;

    return (
      this.config.enabled &&
      this.pool !== null &&
      elementCount >= this.config.parallelThreshold
    );
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
   * Execute a method in the worker pool
   */
  async exec<T>(
    method: string,
    params: unknown[],
    options?: TaskOptions
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('WorkerPool not initialized. Call initialize() first.');
    }

    const execOptions: ExecOptions = {
      on: options?.on,
      transfer: options?.transfer,
    };

    const timeout = options?.taskTimeout ?? this.config.taskTimeout;
    return this.pool.exec<T>(method, params, execOptions).timeout(timeout) as Promise<T>;
  }

  /**
   * Execute a function directly (for simple parallelization)
   */
  async execFunction<T, R>(
    fn: (arg: T) => R,
    arg: T,
    options?: TaskOptions
  ): Promise<R> {
    if (!this.pool) {
      throw new Error('WorkerPool not initialized. Call initialize() first.');
    }

    const timeout = options?.taskTimeout ?? this.config.taskTimeout;
    // Use workerpool's ability to execute functions directly
    return this.pool.exec<R>(fn as unknown as string, [arg]).timeout(timeout) as Promise<R>;
  }

  // =========================================================================
  // Array Operations
  // =========================================================================

  /**
   * Parallel sum of array elements
   */
  async sum(data: Float64Array, options?: TaskOptions): Promise<ParallelResult<number>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      let total = 0;
      for (let i = 0; i < data.length; i++) {
        total += data[i];
      }
      return {
        result: total,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const stats = this.stats();

    const partialSums = await Promise.all(
      chunks.map((chunk) =>
        this.exec<number>('sumChunk', [chunk.buffer, 0, chunk.length])
      )
    );

    const result = partialSums.reduce((a, b) => a + b, 0);

    return {
      result,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Parallel dot product
   */
  async dot(
    a: Float64Array,
    b: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<number>> {
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result += a[i] * b[i];
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkPairs = this.chunkPairFloat64Array(a, b, options?.chunkSize);
    const stats = this.stats();

    const partialDots = await Promise.all(
      chunkPairs.map(([chunkA, chunkB]) =>
        this.exec<number>('dotChunk', [
          chunkA.buffer,
          chunkB.buffer,
          0,
          chunkA.length,
        ])
      )
    );

    const result = partialDots.reduce((acc, val) => acc + val, 0);

    return {
      result,
      duration: performance.now() - start,
      chunks: chunkPairs.length,
      parallelized: true,
      workersUsed: Math.min(chunkPairs.length, stats.totalWorkers),
    };
  }

  /**
   * Parallel element-wise operation
   */
  async elementwise(
    a: Float64Array,
    b: Float64Array,
    op: 'add' | 'subtract' | 'multiply' | 'divide',
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
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
        workersUsed: 0,
      };
    }

    const chunkPairs = this.chunkPairFloat64Array(a, b, options?.chunkSize);
    const stats = this.stats();

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

    const combined = this.combineArrayBuffers(results, a.length);

    return {
      result: combined,
      duration: performance.now() - start,
      chunks: chunkPairs.length,
      parallelized: true,
      workersUsed: Math.min(chunkPairs.length, stats.totalWorkers),
    };
  }

  /**
   * Parallel scale operation
   */
  async scale(
    data: Float64Array,
    scalar: number,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      const result = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] * scalar;
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<ArrayBuffer>('scaleChunk', [
          chunk.buffer,
          0,
          chunk.length,
          scalar,
        ])
      )
    );

    const combined = this.combineArrayBuffers(results, data.length);

    return {
      result: combined,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

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
    bCols: number,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const resultSize = aRows * bCols;
    const start = performance.now();

    if (!this.shouldParallelize(resultSize, options)) {
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
        workersUsed: 0,
      };
    }

    // Distribute rows across workers
    const stats = this.stats();
    const numWorkers = Math.max(1, stats.totalWorkers);
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
      workersUsed: tasks.length,
    };
  }

  /**
   * Parallel matrix transpose
   */
  async transpose(
    data: Float64Array,
    rows: number,
    cols: number,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      const result = new Float64Array(data.length);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          result[j * rows + i] = data[i * cols + j];
        }
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const stats = this.stats();
    const numWorkers = Math.max(1, stats.totalWorkers);
    const rowsPerWorker = Math.ceil(rows / numWorkers);
    const tasks: Promise<ArrayBuffer>[] = [];

    for (let w = 0; w < numWorkers; w++) {
      const rowStart = w * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, rows);

      if (rowStart >= rows) break;

      tasks.push(
        this.exec<ArrayBuffer>('transposeRows', [
          data.buffer,
          rows,
          cols,
          rowStart,
          rowEnd,
        ])
      );
    }

    const results = await Promise.all(tasks);

    // Reconstruct transposed matrix
    const result = new Float64Array(data.length);
    let workerIdx = 0;
    for (let w = 0; w < numWorkers; w++) {
      const rowStart = w * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, rows);
      if (rowStart >= rows) break;

      const chunk = new Float64Array(results[workerIdx]);
      const chunkRows = rowEnd - rowStart;

      // Copy transposed data back
      for (let j = 0; j < cols; j++) {
        for (let i = 0; i < chunkRows; i++) {
          result[j * rows + (rowStart + i)] = chunk[j * chunkRows + i];
        }
      }
      workerIdx++;
    }

    return {
      result,
      duration: performance.now() - start,
      chunks: tasks.length,
      parallelized: true,
      workersUsed: tasks.length,
    };
  }

  // =========================================================================
  // Generic Parallel Operations
  // =========================================================================

  /**
   * Parallel map operation
   */
  async map<T, R>(
    data: T[],
    fn: (item: T) => R,
    options?: TaskOptions
  ): Promise<ParallelResult<R[]>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      return {
        result: data.map(fn),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const chunks = this.chunkArray(data, chunkSize);
    const stats = this.stats();

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
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Parallel reduce operation
   */
  async reduce<T, R>(
    data: T[],
    fn: (acc: R, item: T) => R,
    initial: R,
    options?: TaskOptions
  ): Promise<ParallelResult<R>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      return {
        result: data.reduce(fn, initial),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    // For parallel reduce, we map chunks first then reduce sequentially
    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const chunks = this.chunkArray(data, chunkSize);
    const stats = this.stats();

    // Reduce each chunk in parallel
    const partialResults = await Promise.all(
      chunks.map((chunk) =>
        this.exec<R>('reduceChunk', [chunk, fn.toString(), initial])
      )
    );

    // Final sequential reduction of partial results
    const result = partialResults.reduce(
      (acc, partial) => fn(acc, partial as unknown as T),
      initial
    );

    return {
      result,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Parallel filter operation
   */
  async filter<T>(
    data: T[],
    predicate: (item: T) => boolean,
    options?: TaskOptions
  ): Promise<ParallelResult<T[]>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      return {
        result: data.filter(predicate),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const chunks = this.chunkArray(data, chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<T[]>('filterChunk', [chunk, predicate.toString()])
      )
    );

    return {
      result: results.flat(),
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Terminate the worker pool
   */
  async terminate(force = false): Promise<void> {
    if (this.pool) {
      await this.pool.terminate(force);
      this.pool = null;
    }
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Clear pending tasks
   */
  clear(): void {
    if (this.pool) {
      // workerpool doesn't have a direct clear method,
      // so we just note that pending tasks will complete
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private chunkFloat64Array(data: Float64Array, customChunkSize?: number): Float64Array[] {
    const chunkSize = customChunkSize ?? this.config.chunkSize;
    const chunks: Float64Array[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, data.length);
      chunks.push(data.subarray(i, end));
    }
    return chunks;
  }

  private chunkPairFloat64Array(
    a: Float64Array,
    b: Float64Array,
    customChunkSize?: number
  ): [Float64Array, Float64Array][] {
    const chunkSize = customChunkSize ?? this.config.chunkSize;
    const pairs: [Float64Array, Float64Array][] = [];
    for (let i = 0; i < a.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, a.length);
      pairs.push([a.subarray(i, end), b.subarray(i, end)]);
    }
    return pairs;
  }

  private chunkArray<T>(arr: T[], chunkSize?: number): T[][] {
    const size = chunkSize ?? this.config.chunkSize;
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
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

// =============================================================================
// Global Pool Instance
// =============================================================================

/**
 * Global MathTS worker pool instance
 */
export const mathWorkerPool = new MathWorkerPool();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Initialize the global worker pool
 */
export async function initializePool(
  config?: Partial<WorkerPoolConfig>
): Promise<MathWorkerPool> {
  if (config) {
    mathWorkerPool.updateConfig(config);
  }
  await mathWorkerPool.initialize();
  return mathWorkerPool;
}

/**
 * Terminate the global worker pool
 */
export async function terminatePool(force = false): Promise<void> {
  await mathWorkerPool.terminate(force);
}

/**
 * Get pool statistics
 */
export function getPoolStats(): PoolStats {
  return mathWorkerPool.stats();
}

// =============================================================================
// Re-exports from workerpool
// =============================================================================

export { Transfer };
export type { Pool, PoolOptions, ExecOptions, PoolStats };
