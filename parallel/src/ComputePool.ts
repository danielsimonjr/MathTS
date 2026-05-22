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

import {
  bitAnd as bitAndOp,
  bitOr as bitOrOp,
  bitXor as bitXorOp,
  bitNot as bitNotOp,
  leftShift as leftShiftOp,
  rightArithShift as rightArithShiftOp,
  rightLogShift as rightLogShiftOp,
} from './ops/bitwise.js';

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
   * Parallel product of array elements
   */
  async prod(data: Float64Array): Promise<ParallelResult<number>> {
    const result = await this.workerPool.prod(data);
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
   * Apply a caller-supplied binary numeric function in parallel.
   *
   * @param a - First operand array
   * @param b - Second operand array (must match the length of `a`)
   * @param fnSource - Source of a self-contained `(a: number, b: number) =>
   *   number` expression (no free variables / closures).
   */
  async applyKernel2(
    a: Float64Array,
    b: Float64Array,
    fnSource: string
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.applyKernel2(a, b, fnSource);
    return toParallelResult(result);
  }

  /**
   * Compute a batch of independent radix-2 FFTs in parallel.
   *
   * `real` and `imag` each hold `frameCount` concatenated frames of
   * `frameLength` samples (`frameLength` must be a power of two). Each frame
   * is FFT'd independently and the frames are distributed across workers.
   *
   * Used to parallelize the embarrassingly-parallel FFT batches in
   * `spectrogram` (one FFT per windowed frame) and `fft2d` (rows then columns).
   *
   * @param real - Concatenated real parts (`frameCount * frameLength` values)
   * @param imag - Concatenated imaginary parts (same layout as `real`)
   * @param frameCount - Number of independent frames
   * @param frameLength - Samples per frame (power of two)
   * @param inverse - Compute the inverse FFT when true
   */
  async fftBatch(
    real: Float64Array,
    imag: Float64Array,
    frameCount: number,
    frameLength: number,
    inverse = false
  ): Promise<ParallelResult<{ real: Float64Array; imag: Float64Array }>> {
    const result = await this.workerPool.fftBatch(
      real,
      imag,
      frameCount,
      frameLength,
      inverse
    );
    return toParallelResult(result);
  }

  /**
   * Compute an all-pairs Euclidean distance matrix in parallel.
   *
   * @param points - Flattened `n * dim` coordinate array (row-major)
   * @param n - Number of points
   * @param dim - Coordinate dimension
   * @returns Flat row-major `n * n` distance matrix
   */
  async distanceMatrix(
    points: Float64Array,
    n: number,
    dim: number
  ): Promise<ParallelResult<Float64Array>> {
    const result = await this.workerPool.distanceMatrix(points, n, dim);
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

  // =========================================================================
  // Bitwise Operations (Int32Array)
  // =========================================================================
  //
  // Bitwise ops are evaluated in-process rather than via the shared
  // workerpool kernel registry: that registry is keyed on `Float64Array`
  // buffers, and bitwise math on doubles would silently lose the upper
  // bits. The ops still chunk their work to match the call shape of the
  // Float64Array elementwise ops, so the typed-function dispatch layer
  // can treat both buffer types uniformly.

  /**
   * Element-wise bitwise AND on two `Int32Array`s.
   */
  async bitAnd(a: Int32Array, b: Int32Array): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = bitAndOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Element-wise bitwise OR on two `Int32Array`s.
   */
  async bitOr(a: Int32Array, b: Int32Array): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = bitOrOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Element-wise bitwise XOR on two `Int32Array`s.
   */
  async bitXor(a: Int32Array, b: Int32Array): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = bitXorOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Unary bitwise NOT on an `Int32Array`.
   */
  async bitNot(a: Int32Array): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = bitNotOp(a);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Element-wise left shift. `b` may be a per-element `Int32Array` of
   * shift counts or a single scalar `number` applied uniformly.
   */
  async leftShift(
    a: Int32Array,
    b: Int32Array | number
  ): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = leftShiftOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Element-wise arithmetic (sign-preserving) right shift.
   */
  async rightArithShift(
    a: Int32Array,
    b: Int32Array | number
  ): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = rightArithShiftOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Element-wise logical (zero-filling) right shift. Results are stored
   * as `Int32Array`, so values ≥ 2^31 wrap into the negative range —
   * matching `(x >>> n) | 0` JavaScript semantics.
   */
  async rightLogShift(
    a: Int32Array,
    b: Int32Array | number
  ): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();
    const result = rightLogShiftOp(a, b);
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
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
