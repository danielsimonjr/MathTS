/**
 * @danielsimonjr/mathts-workerpool
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
import { fftFrameInPlace } from './fft-core.js';

// Try to import WASM feature detection from workerpool/wasm subpath
// These may not be available in all environments
let _canUseWasm: (() => boolean) | undefined;
let _canUseSharedMemory: (() => boolean) | undefined;

// Dynamically import WASM utilities if available
try {
  // Use dynamic import to avoid TypeScript resolution issues
  const wasmPath = 'workerpool/wasm';
  import(/* @vite-ignore */ wasmPath)
    .then((wasmModule) => {
      _canUseWasm = wasmModule.canUseWasm;
      _canUseSharedMemory = wasmModule.canUseSharedMemory;
    })
    .catch(() => {
      // WASM module not available, fallbacks will be used
    });
} catch {
  // Import not available
}

// =============================================================================
// Synchronous Feature Detection
// =============================================================================

/**
 * Check if WebAssembly is available (synchronous)
 * Can be called before pool initialization for configuration decisions.
 */
export function canUseWasm(): boolean {
  // Use workerpool's native sync detection if available
  if (typeof _canUseWasm === 'function') {
    return _canUseWasm();
  }
  // Fallback: check WebAssembly global
  return typeof WebAssembly !== 'undefined';
}

/**
 * Check if SharedArrayBuffer is available (synchronous)
 * Required for shared memory workers.
 */
export function canUseSharedMemory(): boolean {
  // Use workerpool's native sync detection if available
  if (typeof _canUseSharedMemory === 'function') {
    return _canUseSharedMemory();
  }
  // Fallback: check SharedArrayBuffer global
  if (typeof SharedArrayBuffer === 'undefined') return false;
  // In browsers without COOP/COEP headers, SharedArrayBuffer exists but
  // instantiation throws. crossOriginIsolated must be true to use it safely.
  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) return false;
  return true;
}

// =============================================================================
// Transfer Helpers
// =============================================================================

/**
 * Mark a Float64Array for zero-copy transfer to worker
 * Automatically handles Transferable marking.
 *
 * @param array - The Float64Array to transfer
 * @returns Transfer-wrapped array
 */
export function transferFloat64(array: Float64Array): Transfer {
  // Wrap with Transfer for zero-copy transfer
  return new Transfer(array, [array.buffer]);
}

/**
 * Mark an ArrayBuffer for zero-copy transfer to worker
 *
 * @param buffer - The ArrayBuffer to transfer
 * @returns Transfer-wrapped buffer
 */
export function transferArrayBuffer(buffer: ArrayBuffer): Transfer {
  return new Transfer(buffer, [buffer]);
}

/**
 * Mark a TypedArray for zero-copy transfer to worker.
 * Works with any TypedArray type (Float32Array, Int32Array, Uint8Array, etc.)
 *
 * @param typedArray - The TypedArray to transfer
 * @returns Transfer-wrapped typed array
 */
export function transferTypedArray(
  typedArray: ArrayBufferView & { buffer: ArrayBuffer }
): Transfer {
  return new Transfer(typedArray, [typedArray.buffer]);
}

// =============================================================================
// SharedArrayBuffer Helpers
// =============================================================================

/**
 * Create a SharedArrayBuffer-backed Float64Array for zero-copy shared memory.
 *
 * SharedArrayBuffer allows multiple workers to read/write the same memory
 * without any serialization or transfer overhead. Requires Cross-Origin-Isolation
 * headers in browsers (`Cross-Origin-Opener-Policy: same-origin` and
 * `Cross-Origin-Embedder-Policy: require-corp`).
 *
 * @param length - Number of Float64 elements
 * @returns Float64Array backed by SharedArrayBuffer
 * @throws Error if SharedArrayBuffer is not available
 */
export function createSharedFloat64Array(length: number): Float64Array {
  if (!canUseSharedMemory()) {
    throw new Error(
      'SharedArrayBuffer is not available. ' +
        'In browsers, Cross-Origin-Isolation headers are required.'
    );
  }
  const sab = new SharedArrayBuffer(length * Float64Array.BYTES_PER_ELEMENT);
  return new Float64Array(sab);
}

/**
 * Create a SharedArrayBuffer of the specified byte length.
 *
 * @param byteLength - Size in bytes
 * @returns SharedArrayBuffer
 * @throws Error if SharedArrayBuffer is not available
 */
export function createSharedBuffer(byteLength: number): SharedArrayBuffer {
  if (!canUseSharedMemory()) {
    throw new Error(
      'SharedArrayBuffer is not available. ' +
        'In browsers, Cross-Origin-Isolation headers are required.'
    );
  }
  return new SharedArrayBuffer(byteLength);
}

/**
 * Check if a value is backed by SharedArrayBuffer
 */
export function isSharedBuffer(value: unknown): value is SharedArrayBuffer | ArrayBufferView {
  if (value instanceof SharedArrayBuffer) return true;
  if (
    value !== null &&
    typeof value === 'object' &&
    'buffer' in value &&
    (value as ArrayBufferView).buffer instanceof SharedArrayBuffer
  ) {
    return true;
  }
  return false;
}

// =============================================================================
// Capabilities Detection
// =============================================================================

/**
 * Runtime capability information for the current environment
 */
export interface WorkerpoolCapabilities {
  /** SharedArrayBuffer is available (zero-copy shared memory) */
  sharedArrayBuffer: boolean;
  /** Transferable objects are supported (zero-copy ownership transfer) */
  transferable: boolean;
  /** Atomics API is available (for SharedArrayBuffer synchronization) */
  atomics: boolean;
  /** Cross-Origin-Isolated context (browsers only, required for SAB) */
  crossOriginIsolated: boolean;
  /** Maximum recommended worker count */
  maxWorkers: number;
}

/**
 * Detect runtime capabilities for data transfer optimization.
 *
 * Use this to decide which transfer strategy to employ:
 * - SharedArrayBuffer (best): zero-copy shared memory, requires Cross-Origin-Isolation in browsers
 * - Transferable (good): zero-copy ownership transfer, works in all modern environments
 * - JSON (fallback): always works but slow for large data
 *
 * @returns Capability report for the current environment
 */
export function getCapabilities(): WorkerpoolCapabilities {
  const maxWorkers =
    typeof navigator !== 'undefined'
      ? navigator.hardwareConcurrency || 4
      : (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const os = require('os');
            return os.cpus?.()?.length ?? 4;
          } catch {
            return 4;
          }
        })();

  return {
    sharedArrayBuffer: canUseSharedMemory(),
    transferable: typeof ArrayBuffer !== 'undefined',
    atomics: typeof Atomics !== 'undefined',
    crossOriginIsolated:
      typeof globalThis !== 'undefined' &&
      'crossOriginIsolated' in globalThis &&
      !!(globalThis as unknown as { crossOriginIsolated: boolean }).crossOriginIsolated,
    maxWorkers,
  };
}

// =============================================================================
// WASM Support (Async)
// =============================================================================

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

  // Use sync detection for initial values
  wasmFeatures = {
    hasWebAssembly: canUseWasm(),
    hasSharedArrayBuffer: canUseSharedMemory(),
    hasAtomics: typeof Atomics !== 'undefined',
    hasWASMThreads: canUseWasm() && canUseSharedMemory(),
  };

  return wasmFeatures;
}

/**
 * Check if WASM task queue is available
 */
export function isWorkerWasmAvailable(): boolean {
  return wasmFeatures?.hasWebAssembly ?? canUseWasm();
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
  /**
   * Eagerly spawn workers on pool creation instead of lazily on first task.
   * When true, workers are pre-spawned during initialize() to eliminate
   * cold-start latency on the first task.
   * @default false
   */
  eagerInit?: boolean;
}

/**
 * Resolve the path to the built worker script (`dist/worker.js`).
 *
 * The worker thread must run the registered MathTS kernels (`sumChunk`,
 * `matmulRows`, ...). If the pool is created without this script, workerpool
 * falls back to its generic worker which only supports `run`/`methods`, and
 * every named-method dispatch throws `Unknown method "..."`.
 *
 * @returns Worker script path (Node) or URL (browser), or undefined if it
 *          cannot be located (callers then fall back to the generic worker).
 */
async function resolveDefaultWorkerScript(): Promise<string | undefined> {
  const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;

  // Browser: let the consuming bundler rewrite the worker URL.
  if (!isNode) {
    try {
      return new URL('./worker.js', import.meta.url).href;
    } catch {
      return undefined;
    }
  }

  // Node: workerpool's worker_threads / process-fork paths need a real file.
  try {
    const { fileURLToPath } = await import('node:url');
    const { existsSync } = await import('node:fs');

    // When consumed as a built package this module is dist/index.js, so the
    // worker is a sibling. When running from src/ (tests) it lives in dist/.
    const candidates = [
      new URL('./worker.js', import.meta.url),
      new URL('../dist/worker.js', import.meta.url),
    ];
    for (const url of candidates) {
      const filePath = fileURLToPath(url);
      if (existsSync(filePath)) return filePath;
    }
  } catch {
    // Resolution failed — caller falls back to the generic worker.
  }
  return undefined;
}

/**
 * Default pool configuration
 */
export const DEFAULT_WORKER_CONFIG: WorkerPoolConfig = {
  enabled: true,
  minWorkers: 1,
  maxWorkers: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  parallelThreshold: 10000,
  chunkSize: 5000,
  workerType: 'auto',
  idleTimeout: 60000,
  taskTimeout: 300000, // 5 minutes
  eagerInit: false,
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
 * Performance metrics collected by the pool
 */
export interface PoolMetrics {
  /** Total number of tasks executed since pool creation */
  totalTasksExecuted: number;
  /** Total number of tasks that failed */
  totalTasksFailed: number;
  /** Average task execution time in milliseconds */
  averageExecutionTime: number;
  /** P95 task execution time in milliseconds */
  p95ExecutionTime: number;
  /** Tasks completed per second (rolling 60s window) */
  throughput: number;
  /** Current task queue depth */
  taskQueueDepth: number;
  /** Worker utilization ratio (0-1): busyWorkers / totalWorkers */
  workerUtilization: number;
}

/**
 * Extended pool statistics including performance metrics
 */
export interface EnhancedPoolStats extends PoolStats {
  /** Performance metrics (when metrics tracking is enabled) */
  metrics: PoolMetrics;
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
 * import { MathWorkerPool } from '@danielsimonjr/mathts-workerpool';
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

  // Metrics tracking
  private _totalTasksExecuted = 0;
  private _totalTasksFailed = 0;
  private _executionTimes: number[] = [];
  private _completionTimestamps: number[] = [];
  private _metricsWindowMs = 60_000; // 60s rolling window for throughput
  private _maxExecutionTimeSamples = 1000; // Keep last 1000 samples for percentiles

  /**
   * Promise that resolves when the pool is fully ready (workers spawned).
   * Particularly useful with `eagerInit: true`.
   */
  public ready: Promise<void> = Promise.resolve();

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
      minWorkers: this.config.eagerInit
        ? this.config.minWorkers === 0
          ? this.config.maxWorkers
          : this.config.minWorkers
        : this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      workerType: this.config.workerType,
      workerTerminateTimeout: this.config.idleTimeout,
    };

    // Use the explicit worker script if provided, otherwise resolve the
    // built kernel worker so named-method dispatch (sumChunk, ...) works.
    const workerScript = this.config.workerScript ?? (await resolveDefaultWorkerScript());

    if (workerScript) {
      this.pool = createPool(workerScript, options);
    } else {
      this.pool = createPool(null, options);
    }

    this.initialized = true;

    // If eager init, warm up workers by running a no-op on each
    if (this.config.eagerInit && this.pool) {
      this.ready = this._warmupWorkers(this.config.maxWorkers);
    }
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.initialized && (this.pool !== null || !this.config.enabled);
  }

  /**
   * Pre-spawn and warm up workers to eliminate cold-start latency.
   *
   * Each worker is forced to execute a trivial task, ensuring the worker
   * process/thread is fully initialized and ready to accept real work.
   *
   * @param count - Number of workers to warm up (defaults to maxWorkers)
   * @returns Promise that resolves when all workers are warmed up
   */
  async warmup(count?: number): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.pool) return;

    const workerCount = count ?? this.config.maxWorkers;
    await this._warmupWorkers(workerCount);
  }

  private async _warmupWorkers(count: number): Promise<void> {
    if (!this.pool) return;

    // Fire `count` concurrent no-op tasks to force worker spawning
    const tasks: Promise<unknown>[] = [];
    for (let i = 0; i < count; i++) {
      tasks.push(
        this.pool
          .exec(() => true, [])
          .timeout(this.config.taskTimeout)
          .catch(() => {
            // Warmup failure is non-fatal
          })
      );
    }
    await Promise.all(tasks);
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
      this.config.enabled && this.pool !== null && elementCount >= this.config.parallelThreshold
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
   * Get enhanced pool statistics including performance metrics.
   *
   * Tracks task execution times, throughput, error rates, and worker utilization.
   * Metrics are collected automatically for every task executed via exec().
   *
   * @returns Enhanced stats with metrics
   */
  enhancedStats(): EnhancedPoolStats {
    const baseStats = this.stats();
    const now = performance.now();

    // Calculate average execution time
    const avgExecTime =
      this._executionTimes.length > 0
        ? this._executionTimes.reduce((a, b) => a + b, 0) / this._executionTimes.length
        : 0;

    // Calculate p95 execution time
    let p95ExecTime = 0;
    if (this._executionTimes.length > 0) {
      const sorted = [...this._executionTimes].sort((a, b) => a - b);
      const idx = Math.ceil(sorted.length * 0.95) - 1;
      p95ExecTime = sorted[Math.max(0, idx)];
    }

    // Calculate throughput (tasks/sec in rolling window)
    const windowStart = now - this._metricsWindowMs;
    const recentCompletions = this._completionTimestamps.filter((t) => t >= windowStart);
    const throughput =
      recentCompletions.length > 0 ? recentCompletions.length / (this._metricsWindowMs / 1000) : 0;

    // Worker utilization
    const utilization =
      baseStats.totalWorkers > 0 ? baseStats.busyWorkers / baseStats.totalWorkers : 0;

    return {
      ...baseStats,
      metrics: {
        totalTasksExecuted: this._totalTasksExecuted,
        totalTasksFailed: this._totalTasksFailed,
        averageExecutionTime: Math.round(avgExecTime * 100) / 100,
        p95ExecutionTime: Math.round(p95ExecTime * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        taskQueueDepth: baseStats.pendingTasks,
        workerUtilization: Math.round(utilization * 1000) / 1000,
      },
    };
  }

  /**
   * Reset collected performance metrics
   */
  resetMetrics(): void {
    this._totalTasksExecuted = 0;
    this._totalTasksFailed = 0;
    this._executionTimes = [];
    this._completionTimestamps = [];
  }

  /**
   * Record a task execution for metrics tracking (called internally)
   */
  private _recordExecution(durationMs: number, failed: boolean): void {
    if (failed) {
      this._totalTasksFailed++;
    }
    this._totalTasksExecuted++;
    this._executionTimes.push(durationMs);
    const now = performance.now();
    this._completionTimestamps.push(now);

    // Trim execution times to max samples
    if (this._executionTimes.length > this._maxExecutionTimeSamples) {
      this._executionTimes = this._executionTimes.slice(-this._maxExecutionTimeSamples);
    }

    // Trim completion timestamps outside window
    const windowStart = now - this._metricsWindowMs;
    this._completionTimestamps = this._completionTimestamps.filter((t) => t >= windowStart);
  }

  /**
   * Execute a method in the worker pool
   */
  async exec<T>(method: string, params: unknown[], options?: TaskOptions): Promise<T> {
    if (!this.pool) {
      throw new Error('WorkerPool not initialized. Call initialize() first.');
    }

    const execOptions: ExecOptions = {
      on: options?.on,
      transfer: options?.transfer,
    };

    const timeout = options?.taskTimeout ?? this.config.taskTimeout;
    const execStart = performance.now();

    try {
      const result = await (this.pool
        .exec<T>(method, params, execOptions)
        .timeout(timeout) as Promise<T>);
      this._recordExecution(performance.now() - execStart, false);
      return result;
    } catch (err) {
      this._recordExecution(performance.now() - execStart, true);
      throw err;
    }
  }

  /**
   * Execute a function directly (for simple parallelization)
   */
  async execFunction<T, R>(fn: (arg: T) => R, arg: T, options?: TaskOptions): Promise<R> {
    if (!this.pool) {
      throw new Error('WorkerPool not initialized. Call initialize() first.');
    }

    const timeout = options?.taskTimeout ?? this.config.taskTimeout;
    const execStart = performance.now();

    try {
      // Use workerpool's ability to execute functions directly
      const result = await (this.pool
        .exec<R>(fn as unknown as string, [arg])
        .timeout(timeout) as Promise<R>);
      this._recordExecution(performance.now() - execStart, false);
      return result;
    } catch (err) {
      this._recordExecution(performance.now() - execStart, true);
      throw err;
    }
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
      chunks.map((chunk) => this.exec<number>('sumChunk', [chunk.buffer, 0, chunk.length]))
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
   * Parallel product of array elements
   */
  async prod(data: Float64Array, options?: TaskOptions): Promise<ParallelResult<number>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      let total = 1;
      for (let i = 0; i < data.length; i++) {
        total *= data[i];
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

    const partialProds = await Promise.all(
      chunks.map((chunk) => this.exec<number>('prodChunk', [chunk.buffer, 0, chunk.length]))
    );

    const result = partialProds.reduce((a, b) => a * b, 1);

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
        this.exec<number>('dotChunk', [chunkA.buffer, chunkB.buffer, 0, chunkA.length])
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
        this.exec<ArrayBuffer>('scaleChunk', [chunk.buffer, 0, chunk.length, scalar])
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
  // Bitwise Operations (Int32Array)
  // =========================================================================

  /**
   * Element-wise bitwise binary op over two `Int32Array`s.
   *
   * Mirrors `elementwise` but is keyed on `Int32Array` so the worker reads
   * the buffers back as `Int32Array` (not `Float64Array`). Below threshold
   * the binary op is computed in-process; otherwise chunks are distributed
   * to `bitwiseChunk` worker kernels.
   *
   * Op codes correspond to the seven `parallel/src/ops/bitwise.ts` exports:
   * `'bitAnd' | 'bitOr' | 'bitXor' | 'leftShift' | 'rightArithShift' |
   * 'rightLogShift'`.
   */
  async bitwiseBinary(
    a: Int32Array,
    b: Int32Array,
    op: 'bitAnd' | 'bitOr' | 'bitXor' | 'leftShift' | 'rightArithShift' | 'rightLogShift',
    options?: TaskOptions
  ): Promise<ParallelResult<Int32Array>> {
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      const result = new Int32Array(a.length);
      switch (op) {
        case 'bitAnd':
          for (let i = 0; i < a.length; i++) result[i] = a[i] & b[i];
          break;
        case 'bitOr':
          for (let i = 0; i < a.length; i++) result[i] = a[i] | b[i];
          break;
        case 'bitXor':
          for (let i = 0; i < a.length; i++) result[i] = a[i] ^ b[i];
          break;
        case 'leftShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] << b[i];
          break;
        case 'rightArithShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] >> b[i];
          break;
        case 'rightLogShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] >>> b[i];
          break;
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkPairs = this.chunkPairInt32Array(a, b, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunkPairs.map(([chunkA, chunkB]) =>
        this.exec<ArrayBuffer>('bitwiseChunk', [chunkA.buffer, chunkB.buffer, 0, chunkA.length, op])
      )
    );

    const combined = this.combineInt32Buffers(results, a.length);

    return {
      result: combined,
      duration: performance.now() - start,
      chunks: chunkPairs.length,
      parallelized: true,
      workersUsed: Math.min(chunkPairs.length, stats.totalWorkers),
    };
  }

  /**
   * Element-wise bitwise op on an `Int32Array` with a scalar second operand.
   *
   * Used by the shift overloads when `b` is a single `number` rather than
   * a per-element `Int32Array`.
   */
  async bitwiseScalar(
    a: Int32Array,
    scalar: number,
    op: 'bitAnd' | 'bitOr' | 'bitXor' | 'leftShift' | 'rightArithShift' | 'rightLogShift',
    options?: TaskOptions
  ): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      const result = new Int32Array(a.length);
      switch (op) {
        case 'bitAnd':
          for (let i = 0; i < a.length; i++) result[i] = a[i] & scalar;
          break;
        case 'bitOr':
          for (let i = 0; i < a.length; i++) result[i] = a[i] | scalar;
          break;
        case 'bitXor':
          for (let i = 0; i < a.length; i++) result[i] = a[i] ^ scalar;
          break;
        case 'leftShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] << scalar;
          break;
        case 'rightArithShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] >> scalar;
          break;
        case 'rightLogShift':
          for (let i = 0; i < a.length; i++) result[i] = a[i] >>> scalar;
          break;
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkInt32Array(a, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<ArrayBuffer>('bitwiseScalarChunk', [chunk.buffer, 0, chunk.length, scalar, op])
      )
    );

    const combined = this.combineInt32Buffers(results, a.length);

    return {
      result: combined,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Unary bitwise NOT (`~a[i]`) over an `Int32Array`.
   */
  async bitwiseNot(a: Int32Array, options?: TaskOptions): Promise<ParallelResult<Int32Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      const result = new Int32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        result[i] = ~a[i];
      }
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkInt32Array(a, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<ArrayBuffer>('bitwiseNotChunk', [chunk.buffer, 0, chunk.length])
      )
    );

    const combined = this.combineInt32Buffers(results, a.length);

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
        this.exec<ArrayBuffer>('transposeRows', [data.buffer, rows, cols, rowStart, rowEnd])
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
  // Statistical Operations
  // =========================================================================

  /**
   * Find min and max values in parallel
   */
  async minMax(
    data: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<{ min: number; max: number; minIdx: number; maxIdx: number }>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      let min = data[0];
      let max = data[0];
      let minIdx = 0;
      let maxIdx = 0;
      for (let i = 1; i < data.length; i++) {
        if (data[i] < min) {
          min = data[i];
          minIdx = i;
        }
        if (data[i] > max) {
          max = data[i];
          maxIdx = i;
        }
      }
      return {
        result: { min, max, minIdx, maxIdx },
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk, idx) =>
        this.exec<{ min: number; max: number; minIdx: number; maxIdx: number }>('minMaxChunk', [
          chunk.buffer,
          0,
          chunk.length,
        ]).then((result) => ({
          ...result,
          minIdx: result.minIdx + idx * (options?.chunkSize ?? this.config.chunkSize),
          maxIdx: result.maxIdx + idx * (options?.chunkSize ?? this.config.chunkSize),
        }))
      )
    );

    // Reduce to find global min/max
    let min = results[0].min;
    let max = results[0].max;
    let minIdx = results[0].minIdx;
    let maxIdx = results[0].maxIdx;
    for (let i = 1; i < results.length; i++) {
      if (results[i].min < min) {
        min = results[i].min;
        minIdx = results[i].minIdx;
      }
      if (results[i].max > max) {
        max = results[i].max;
        maxIdx = results[i].maxIdx;
      }
    }

    return {
      result: { min, max, minIdx, maxIdx },
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Compute variance in parallel using Welford's algorithm
   */
  async variance(
    data: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<{ mean: number; variance: number; std: number }>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      let mean = 0;
      let m2 = 0;
      for (let i = 0; i < data.length; i++) {
        const delta = data[i] - mean;
        mean += delta / (i + 1);
        const delta2 = data[i] - mean;
        m2 += delta * delta2;
      }
      const variance = m2 / data.length;
      return {
        result: { mean, variance, std: Math.sqrt(variance) },
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
        this.exec<{ count: number; mean: number; m2: number }>('varianceChunk', [
          chunk.buffer,
          0,
          chunk.length,
        ])
      )
    );

    // Combine partial results using parallel algorithm
    let totalCount = results[0].count;
    let totalMean = results[0].mean;
    let totalM2 = results[0].m2;
    for (let i = 1; i < results.length; i++) {
      const { count, mean, m2 } = results[i];
      const delta = mean - totalMean;
      const newCount = totalCount + count;
      totalMean = (totalMean * totalCount + mean * count) / newCount;
      totalM2 = totalM2 + m2 + (delta * delta * (totalCount * count)) / newCount;
      totalCount = newCount;
    }

    const variance = totalM2 / totalCount;

    return {
      result: { mean: totalMean, variance, std: Math.sqrt(variance) },
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Compute norm (Euclidean length) in parallel
   */
  async norm(data: Float64Array, options?: TaskOptions): Promise<ParallelResult<number>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        sumSq += data[i] * data[i];
      }
      return {
        result: Math.sqrt(sumSq),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const stats = this.stats();

    const partialNorms = await Promise.all(
      chunks.map((chunk) => this.exec<number>('normChunk', [chunk.buffer, 0, chunk.length]))
    );

    const sumSq = partialNorms.reduce((a, b) => a + b, 0);

    return {
      result: Math.sqrt(sumSq),
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Compute Euclidean distance in parallel
   */
  async distance(
    a: Float64Array,
    b: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<number>> {
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      let sumSq = 0;
      for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sumSq += diff * diff;
      }
      return {
        result: Math.sqrt(sumSq),
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkPairs = this.chunkPairFloat64Array(a, b, options?.chunkSize);
    const stats = this.stats();

    const partialDistances = await Promise.all(
      chunkPairs.map(([chunkA, chunkB]) =>
        this.exec<number>('distanceChunk', [chunkA.buffer, chunkB.buffer, 0, chunkA.length])
      )
    );

    const sumSq = partialDistances.reduce((acc, val) => acc + val, 0);

    return {
      result: Math.sqrt(sumSq),
      duration: performance.now() - start,
      chunks: chunkPairs.length,
      parallelized: true,
      workersUsed: Math.min(chunkPairs.length, stats.totalWorkers),
    };
  }

  /**
   * Apply unary function in parallel
   */
  async unary(
    data: Float64Array,
    fn: 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square',
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      const result = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        switch (fn) {
          case 'abs':
            result[i] = Math.abs(data[i]);
            break;
          case 'sqrt':
            result[i] = Math.sqrt(data[i]);
            break;
          case 'exp':
            result[i] = Math.exp(data[i]);
            break;
          case 'log':
            result[i] = Math.log(data[i]);
            break;
          case 'sin':
            result[i] = Math.sin(data[i]);
            break;
          case 'cos':
            result[i] = Math.cos(data[i]);
            break;
          case 'tan':
            result[i] = Math.tan(data[i]);
            break;
          case 'negate':
            result[i] = -data[i];
            break;
          case 'square':
            result[i] = data[i] * data[i];
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

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const stats = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<ArrayBuffer>('unaryChunk', [chunk.buffer, 0, chunk.length, fn])
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

  /**
   * Apply a caller-supplied unary numeric function in parallel.
   *
   * @param data - Input values
   * @param fnSource - Source of a self-contained `(x: number) => number`
   *   expression. It must not reference any free variables / closures, since
   *   it is eval'd in an isolated worker context.
   */
  async applyKernel(
    data: Float64Array,
    fnSource: string,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      // eslint-disable-next-line no-eval
      const fn = (0, eval)(`(${fnSource})`) as (x: number) => number;
      const result = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        result[i] = fn(data[i]);
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
        this.exec<ArrayBuffer>('applyKernelChunk', [chunk.buffer, 0, chunk.length, fnSource])
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

  /**
   * Apply a caller-supplied binary numeric function in parallel.
   *
   * @param a - First operand array
   * @param b - Second operand array (must match the length of `a`)
   * @param fnSource - Source of a self-contained `(a: number, b: number) =>
   *   number` expression. It must not reference free variables / closures.
   */
  async applyKernel2(
    a: Float64Array,
    b: Float64Array,
    fnSource: string,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(a.length, options)) {
      // eslint-disable-next-line no-eval
      const fn = (0, eval)(`(${fnSource})`) as (a: number, b: number) => number;
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) {
        result[i] = fn(a[i], b[i]);
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
        this.exec<ArrayBuffer>('applyKernel2Chunk', [
          chunkA.buffer,
          chunkB.buffer,
          0,
          chunkA.length,
          fnSource,
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
   * Compute a batch of independent radix-2 FFTs in parallel.
   *
   * `real` and `imag` each hold `frameCount` concatenated frames of
   * `frameLength` samples (`frameLength` must be a power of two). Every frame
   * is FFT'd independently — the frames are distributed across workers as
   * contiguous groups, each group dispatched to the `fftBatchChunk` kernel.
   *
   * This parallelizes the embarrassingly-parallel FFT batches that drive
   * `spectrogram` (one FFT per windowed frame) and `fft2d` (one FFT per
   * row, then one per column).
   *
   * @param real - Concatenated real parts (`frameCount * frameLength` values)
   * @param imag - Concatenated imaginary parts (same layout as `real`)
   * @param frameCount - Number of independent frames
   * @param frameLength - Samples per frame (power of two)
   * @param inverse - Compute the inverse FFT when true
   * @returns Concatenated transformed real and imaginary parts, each laid out
   *          as `frameCount` frames of `frameLength` samples
   */
  async fftBatch(
    real: Float64Array,
    imag: Float64Array,
    frameCount: number,
    frameLength: number,
    inverse = false,
    options?: TaskOptions
  ): Promise<ParallelResult<{ real: Float64Array; imag: Float64Array }>> {
    const start = performance.now();
    const total = frameCount * frameLength;

    if (real.length !== total || imag.length !== total) {
      throw new Error(
        `fftBatch buffer length mismatch: expected ${total}, ` +
          `got real=${real.length}, imag=${imag.length}`
      );
    }

    // Each FFT frame costs ~frameLength * log2(frameLength) work; gate the
    // worker dispatch on the total element count like every other kernel.
    if (frameCount === 0 || !this.shouldParallelize(total, options)) {
      const r = real.slice();
      const im = imag.slice();
      for (let f = 0; f < frameCount; f++) {
        fftFrameInPlace(r, im, f * frameLength, frameLength, inverse);
      }
      return {
        result: { real: r, imag: im },
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    // Distribute whole frames across workers as contiguous groups.
    const stats = this.stats();
    const numWorkers = Math.max(1, stats.totalWorkers);
    const framesPerWorker = Math.max(1, Math.ceil(frameCount / numWorkers));
    const tasks: Promise<{ buffer: ArrayBuffer; frameStart: number; groupFrames: number }>[] = [];

    for (let frameStart = 0; frameStart < frameCount; frameStart += framesPerWorker) {
      const groupFrames = Math.min(framesPerWorker, frameCount - frameStart);
      const elemStart = frameStart * frameLength;
      const elemCount = groupFrames * frameLength;
      // slice() so each chunk owns a standalone buffer (the established
      // chunking invariant — see chunkFloat64Array).
      const realChunk = real.slice(elemStart, elemStart + elemCount);
      const imagChunk = imag.slice(elemStart, elemStart + elemCount);
      tasks.push(
        this.exec<ArrayBuffer>('fftBatchChunk', [
          realChunk.buffer,
          imagChunk.buffer,
          groupFrames,
          frameLength,
          inverse,
        ]).then((buffer) => ({ buffer, frameStart, groupFrames }))
      );
    }

    const results = await Promise.all(tasks);

    const outReal = new Float64Array(total);
    const outImag = new Float64Array(total);
    for (const { buffer, frameStart, groupFrames } of results) {
      const flat = new Float64Array(buffer);
      const elemCount = groupFrames * frameLength;
      outReal.set(flat.subarray(0, elemCount), frameStart * frameLength);
      outImag.set(flat.subarray(elemCount, elemCount * 2), frameStart * frameLength);
    }

    return {
      result: { real: outReal, imag: outImag },
      duration: performance.now() - start,
      chunks: tasks.length,
      parallelized: true,
      workersUsed: Math.min(tasks.length, stats.totalWorkers),
    };
  }

  /**
   * Compute an all-pairs Euclidean distance matrix in parallel.
   *
   * Each output row is independent, so the rows are distributed across workers.
   *
   * @param points - Flattened `n * dim` coordinate array (row-major: point `i`
   *   occupies `[i*dim, i*dim + dim)`)
   * @param n - Number of points
   * @param dim - Coordinate dimension
   * @returns Flat row-major `n * n` distance matrix
   */
  async distanceMatrix(
    points: Float64Array,
    n: number,
    dim: number,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const start = performance.now();
    const resultSize = n * n;

    if (!this.shouldParallelize(resultSize, options)) {
      const result = new Float64Array(resultSize);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let d = 0; d < dim; d++) {
            const diff = points[i * dim + d] - points[j * dim + d];
            sum += diff * diff;
          }
          result[i * n + j] = Math.sqrt(sum);
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
    const rowsPerWorker = Math.ceil(n / numWorkers);
    const tasks: Promise<ArrayBuffer>[] = [];

    for (let w = 0; w < numWorkers; w++) {
      const rowStart = w * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, n);
      if (rowStart >= n) break;
      tasks.push(
        this.exec<ArrayBuffer>('distanceMatrixRowsChunk', [points.buffer, n, dim, rowStart, rowEnd])
      );
    }

    const results = await Promise.all(tasks);
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
   * Compute histogram in parallel
   */
  async histogram(
    data: Float64Array,
    bins: number,
    min?: number,
    max?: number,
    options?: TaskOptions
  ): Promise<ParallelResult<number[]>> {
    const start = performance.now();

    // Find min/max if not provided
    let actualMin = min;
    let actualMax = max;
    if (actualMin === undefined || actualMax === undefined) {
      const minMaxResult = await this.minMax(data, options);
      actualMin = actualMin ?? minMaxResult.result.min;
      actualMax = actualMax ?? minMaxResult.result.max;
    }

    if (!this.shouldParallelize(data.length, options)) {
      const histogram = new Array(bins).fill(0);
      const binWidth = (actualMax - actualMin) / bins;
      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val >= actualMin && val <= actualMax) {
          const binIdx = Math.min(Math.floor((val - actualMin) / binWidth), bins - 1);
          histogram[binIdx]++;
        }
      }
      return {
        result: histogram,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunks = this.chunkFloat64Array(data, options?.chunkSize);
    const statsInfo = this.stats();

    const results = await Promise.all(
      chunks.map((chunk) =>
        this.exec<number[]>('histogramChunk', [
          chunk.buffer,
          0,
          chunk.length,
          actualMin,
          actualMax,
          bins,
        ])
      )
    );

    // Combine histograms
    const histogram = new Array(bins).fill(0);
    for (const partial of results) {
      for (let i = 0; i < bins; i++) {
        histogram[i] += partial[i];
      }
    }

    return {
      result: histogram,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, statsInfo.totalWorkers),
    };
  }

  /**
   * Matrix-vector multiplication in parallel
   */
  async matvec(
    matrix: Float64Array,
    rows: number,
    cols: number,
    vector: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    if (cols !== vector.length) {
      throw new Error(`Matrix columns (${cols}) must match vector length (${vector.length})`);
    }

    const start = performance.now();

    if (!this.shouldParallelize(rows * cols, options)) {
      const result = new Float64Array(rows);
      for (let i = 0; i < rows; i++) {
        let sum = 0;
        for (let j = 0; j < cols; j++) {
          sum += matrix[i * cols + j] * vector[j];
        }
        result[i] = sum;
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
        this.exec<ArrayBuffer>('matvecRows', [
          matrix.buffer,
          vector.buffer,
          rows,
          cols,
          rowStart,
          rowEnd,
        ])
      );
    }

    const results = await Promise.all(tasks);
    const result = new Float64Array(rows);
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
   * Outer product in parallel
   */
  async outer(
    a: Float64Array,
    b: Float64Array,
    options?: TaskOptions
  ): Promise<ParallelResult<Float64Array>> {
    const resultSize = a.length * b.length;
    const start = performance.now();

    if (!this.shouldParallelize(resultSize, options)) {
      const result = new Float64Array(resultSize);
      for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
          result[i * b.length + j] = a[i] * b[j];
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
    const rowsPerWorker = Math.ceil(a.length / numWorkers);
    const tasks: Promise<ArrayBuffer>[] = [];

    for (let w = 0; w < numWorkers; w++) {
      const rowStart = w * rowsPerWorker;
      const rowEnd = Math.min(rowStart + rowsPerWorker, a.length);
      if (rowStart >= a.length) break;

      tasks.push(
        this.exec<ArrayBuffer>('outerProductRows', [
          a.buffer,
          b.buffer,
          a.length,
          b.length,
          rowStart,
          rowEnd,
        ])
      );
    }

    const results = await Promise.all(tasks);
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
   * Find first element matching predicate
   */
  async find<T>(
    data: T[],
    predicate: (item: T) => boolean,
    options?: TaskOptions
  ): Promise<ParallelResult<{ found: boolean; value?: T; index?: number }>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      const index = data.findIndex(predicate);
      return {
        result: index === -1 ? { found: false } : { found: true, value: data[index], index },
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const chunks = this.chunkArray(data, chunkSize);
    const stats = this.stats();

    // Search chunks in parallel
    const results = await Promise.all(
      chunks.map((chunk, idx) =>
        this.exec<{ found: boolean; value?: T; index?: number }>('findChunk', [
          chunk,
          predicate.toString(),
          idx * chunkSize,
        ])
      )
    );

    // Find the first match across all chunks
    for (const result of results) {
      if (result.found) {
        return {
          result,
          duration: performance.now() - start,
          chunks: chunks.length,
          parallelized: true,
          workersUsed: Math.min(chunks.length, stats.totalWorkers),
        };
      }
    }

    return {
      result: { found: false },
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * Sort array in parallel (merge sort approach)
   */
  async sort<T>(
    data: T[],
    compare?: (a: T, b: T) => number,
    options?: TaskOptions
  ): Promise<ParallelResult<T[]>> {
    const start = performance.now();

    if (!this.shouldParallelize(data.length, options)) {
      const result = [...data].sort(compare);
      return {
        result,
        duration: performance.now() - start,
        chunks: 1,
        parallelized: false,
        workersUsed: 0,
      };
    }

    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const chunks = this.chunkArray(data, chunkSize);
    const stats = this.stats();

    // Sort each chunk in parallel
    const sortedChunks = await Promise.all(
      chunks.map((chunk) => this.exec<T[]>('sortChunk', [chunk, compare?.toString()]))
    );

    // Merge sorted chunks (k-way merge)
    const result = this.kWayMerge(sortedChunks, compare);

    return {
      result,
      duration: performance.now() - start,
      chunks: chunks.length,
      parallelized: true,
      workersUsed: Math.min(chunks.length, stats.totalWorkers),
    };
  }

  /**
   * K-way merge of sorted arrays
   */
  private kWayMerge<T>(arrays: T[][], compare?: (a: T, b: T) => number): T[] {
    const result: T[] = [];
    const indices = new Array(arrays.length).fill(0);
    const compareFn = compare ?? ((a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0));

    while (true) {
      let minIdx = -1;
      let minVal: T | undefined;

      for (let i = 0; i < arrays.length; i++) {
        if (indices[i] < arrays[i].length) {
          const val = arrays[i][indices[i]];
          if (minIdx === -1 || compareFn(val, minVal!) < 0) {
            minIdx = i;
            minVal = val;
          }
        }
      }

      if (minIdx === -1) break;
      result.push(minVal!);
      indices[minIdx]++;
    }

    return result;
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
      chunks.map((chunk) => this.exec<R[]>('mapChunk', [chunk, fn.toString()]))
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
      chunks.map((chunk) => this.exec<R>('reduceChunk', [chunk, fn.toString(), initial]))
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
      chunks.map((chunk) => this.exec<T[]>('filterChunk', [chunk, predicate.toString()]))
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
    this.ready = Promise.resolve();
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

  // Chunks are produced with slice() (not subarray()): a subarray shares the
  // full underlying ArrayBuffer, so passing `chunk.buffer` with `start: 0` to
  // a worker kernel would read the wrong region for every chunk past the first.
  private chunkFloat64Array(data: Float64Array, customChunkSize?: number): Float64Array[] {
    const chunkSize = customChunkSize ?? this.config.chunkSize;
    const chunks: Float64Array[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, data.length);
      chunks.push(data.slice(i, end));
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
      pairs.push([a.slice(i, end), b.slice(i, end)]);
    }
    return pairs;
  }

  // Int32 counterparts to the Float64 chunkers. Same slice()-not-subarray()
  // invariant: a subarray shares the full underlying ArrayBuffer, so passing
  // `chunk.buffer` with `start: 0` to a worker kernel would read the wrong
  // region for every chunk past the first.
  private chunkInt32Array(data: Int32Array, customChunkSize?: number): Int32Array[] {
    const chunkSize = customChunkSize ?? this.config.chunkSize;
    const chunks: Int32Array[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, data.length);
      chunks.push(data.slice(i, end));
    }
    return chunks;
  }

  private chunkPairInt32Array(
    a: Int32Array,
    b: Int32Array,
    customChunkSize?: number
  ): [Int32Array, Int32Array][] {
    const chunkSize = customChunkSize ?? this.config.chunkSize;
    const pairs: [Int32Array, Int32Array][] = [];
    for (let i = 0; i < a.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, a.length);
      pairs.push([a.slice(i, end), b.slice(i, end)]);
    }
    return pairs;
  }

  private combineInt32Buffers(buffers: ArrayBuffer[], totalLength: number): Int32Array {
    const result = new Int32Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      const chunk = new Int32Array(buf);
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
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
export async function initializePool(config?: Partial<WorkerPoolConfig>): Promise<MathWorkerPool> {
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
