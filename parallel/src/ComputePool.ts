/**
 * MathTS Compute Pool
 *
 * High-level wrapper around @danielsimonjr/mathts-workerpool for parallel computation in MathTS.
 * Provides automatic parallelization of matrix operations based on data size.
 *
 * @packageDocumentation
 */

import { pairwiseSum, norm2 } from '@danielsimonjr/mathts-core';
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
 * Recognised kernel / operation names.
 *
 * These are the string identifiers passed to `shouldParallelize(length, op)` so
 * the per-op threshold map can be consulted before falling back to the global
 * `thresholdElements`.  The list covers:
 *   - Element-wise float ops dispatched through `ComputePool.unary/elementwise/scale`
 *   - Reduction ops (`sum`, `mean`, `variance`, etc.)
 *   - Linear-algebra ops (`matmul`, `matrixPower`, `characteristicPolynomial`)
 *   - Signal-processing ops (`parallelFFT`, `parallelConv`, `spectrogram`, `fft2d`)
 *   - Geometry ops (`distanceMatrix`)
 *   - Special / distribution functions (`erfc`, `besselJ`, `normalCDF`)
 *   - Additional ops exposed via the typed functions layer
 */
export type OpName =
  // element-wise
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'pow'
  | 'scale'
  | 'abs'
  | 'negate'
  | 'sqrt'
  | 'square'
  // bitwise (Int32Array element-wise)
  | 'bitAnd'
  | 'bitOr'
  | 'bitXor'
  | 'bitNot'
  | 'leftShift'
  | 'rightArithShift'
  | 'rightLogShift'
  | 'exp'
  | 'log'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'sign'
  // tensor operations
  | 'tensordot'
  // reductions
  | 'sum'
  | 'mean'
  | 'min'
  | 'max'
  | 'minMax'
  | 'variance'
  | 'std'
  | 'norm'
  | 'histogram'
  | 'dot'
  | 'prod'
  | 'distance'
  | 'parallelStatProd'
  // linear algebra
  | 'matmul'
  | 'outer'
  | 'matvec'
  | 'transpose'
  | 'matrixPower'
  | 'characteristicPolynomial'
  // signal
  | 'parallelFFT'
  | 'parallelConv'
  | 'spectrogram'
  | 'fft2d'
  // geometry
  | 'distanceMatrix'
  // special / distribution
  | 'erfc'
  | 'besselJ'
  | 'normalCDF'
  // hypothesis tests
  | 'chiSquareTest'
  | 'kolmogorovSmirnovTest'
  | 'mannWhitneyTest'
  | 'shapiroWilkTest'
  // integration fan-out (Slice 5.10)
  | 'integrateChunk'
  // distribution batch sampling (Slice 5.12)
  | 'sampleChunk';

/**
 * Per-op threshold override.  The value is the minimum element count required
 * before parallelizing the named operation.  Special string aliases:
 *
 *  - `'never'`  → `Number.MAX_SAFE_INTEGER` (never parallelize)
 *  - `'always'` → `0`                       (always parallelize when pool is ready)
 */
export type OpThreshold = number | 'never' | 'always';

/**
 * Resolve an `OpThreshold` alias to its numeric equivalent.
 * @internal
 */
export function resolveOpThreshold(t: OpThreshold): number {
  if (t === 'never') return Number.MAX_SAFE_INTEGER;
  if (t === 'always') return 0;
  return t;
}

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
  /**
   * Global minimum element count before parallelizing.
   * Acts as the fallback for ops not listed in `thresholdByOp`.
   */
  thresholdElements: number;
  /**
   * Per-operation parallelization thresholds.
   *
   * Values measured on a noisy CI container (2026-05-23) — re-run on target
   * hardware to retune.  Source: tools/benchmark/parallel/run.ts
   *
   * Ops absent from this map fall back to `thresholdElements`.
   */
  thresholdByOp?: Partial<Record<OpName, OpThreshold>>;
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
 * Default per-op thresholds derived from benchmark data (tools/benchmark/parallel/run.ts,
 * 2026-05-23).  Values measured on a noisy CI container — re-run on target hardware to retune.
 *
 *  'never'  → Number.MAX_SAFE_INTEGER  (benchmark showed no reliable speedup)
 *  'always' → 0                        (always parallelize when pool is ready)
 *  number   → minimum element count before dispatching to workers
 */
/**
 * Canonical, benchmark-tuned per-op parallelization thresholds. This is the
 * single source of truth consulted by `ComputePool.shouldParallelize` — the
 * authority the typed functions actually dispatch through. The coarser
 * category-level {@link ThresholdDispatcher} derives its overlapping values
 * (e.g. matmul) from here so the two cannot silently diverge.
 */
export const DEFAULT_THRESHOLD_BY_OP: Partial<Record<OpName, OpThreshold>> = {
  // element-wise: overhead dominates at all tested sizes
  add: 'never',
  subtract: 'never',
  multiply: 'never',
  divide: 'never',
  pow: 'never',
  scale: 'never',
  abs: 'never',
  negate: 'never',
  exp: 'never',
  log: 'never',
  sin: 'never',
  cos: 'never',
  tan: 'never',
  sign: 'never',
  // Added 2026-07-02 (WS-2): these element-wise ops were absent from the map and
  // silently defaulted to the 50 000 global threshold — an inconsistency with their
  // siblings above (surfaced by parallel-pairing.md). Benchmarked (tools/benchmark/
  // parallel/run.ts sqrt square) — memory-bound, speedup 0.12–0.65×, no persistent
  // break-even → 'never', matching the class.
  sqrt: 'never',
  square: 'never',
  // tensor contraction: parallelize when contracted-axis volume >= 8K
  tensordot: 8_192,

  // reductions: overhead dominates
  sum: 'never',
  mean: 'never',
  variance: 'never',
  parallelStatProd: 'never',
  normalCDF: 'never',
  // Added 2026-07-02 (WS-2): reductions that were absent from the map and defaulted
  // to the global threshold; benchmarked memory-bound (0.09–1.19×, occasional noise
  // spikes but no persistent win) → 'never'.
  norm: 'never',
  dot: 'never',
  // Added 2026-07-02 (WS-2): `min`/`max` are now `OpName`s (added to the union) so
  // they're tunable. Same memory-bound reduction profile as sum/mean/norm above →
  // 'never'. Their `functions/` call sites previously dispatched to the worker pool
  // unconditionally (no `shouldParallelize` gate), paying dispatch overhead on every
  // call; they now respect this threshold (sequential) with a `shouldParallelize` gate.
  min: 'never',
  max: 'never',
  // Added 2026-07-03 (WS-2, DGT sweep): the remaining memory-bound reductions that
  // defaulted to the 50 000 global threshold and dispatched unconditionally at every
  // `functions/` call site. Same class as sum/mean/min/max/norm/dot → 'never'. Now
  // gated INSIDE the ComputePool reduction methods (inline sequential fallback), so
  // ALL call sites honor the threshold without per-site edits. `std` derives from
  // `variance`; `min`/`max` derive from `minMax`.
  minMax: 'never',
  std: 'never',
  prod: 'never',
  distance: 'never',

  // Added 2026-07-04 (WS-2 completion): the five OpNames that were absent from
  // this map and silently rode the untested 50 000 global default. Benchmarked
  // (tools/benchmarks/ws2-missing-ops.mjs, medians of 9 interleaved reps):
  // histogram 0.23-0.56x, transpose 0.01-0.28x, matvec 0.00-0.05x, outer
  // 0.01-0.50x at every size up to 4.2M elements - memory-bound / copy-dominated,
  // no break-even -> 'never'. Their ComputePool methods previously dispatched to
  // the worker pool UNCONDITIONALLY (no shouldParallelize gate); they now gate
  // with an inline sequential fallback like the reductions above.
  histogram: 'never',
  transpose: 'never',
  matvec: 'never',
  outer: 'never',
  // integrateFanOut loses ~50-100x for cheap integrands (0.01-0.02x at 128-32768
  // evals). The fan-out is CALLER-OPT-IN (integration.ts dispatches only when the
  // caller passes workerCount > 1), so this entry documents the default posture;
  // no shouldParallelize call consults it. Expensive (ms-scale) integrands are the
  // one case where the fan-out pays off.
  integrateChunk: 'never',
  // Added 2026-07-05 (WS-2 addendum): the bitwise family gated via a NAMELESS
  // shouldParallelize(len) -> the untested global 50k. Benchmarked
  // (tools/benchmarks/ws2-bitwise-ops.mjs, medians of 9 interleaved reps):
  // bitAnd 0.07-0.15x, bitNot 0.06-0.09x, leftShift 0.04-0.07x at every size up
  // to 4M elements - Int32Array element-wise is maximally memory-bound; the
  // worker path loses 7-25x. All seven -> 'never'; the methods now pass their
  // op name so these entries actually govern.
  bitAnd: 'never',
  bitOr: 'never',
  bitXor: 'never',
  bitNot: 'never',
  leftShift: 'never',
  rightArithShift: 'never',
  rightLogShift: 'never',

  // signal: overhead dominates or break-even never reached
  parallelFFT: 'never',
  parallelConv: 'never',
  fft2d: 'never',

  // geometry: overhead dominates
  distanceMatrix: 'never',

  // special functions: parallel wins above these sizes
  erfc: 100_000,
  besselJ: 1_000_000,
  spectrogram: 65_536,

  // linear algebra: parallel wins above these element counts
  matmul: 4_096, // break-even at 64×64 (4,096 elements)
  matrixPower: 9_216, // break-even at ~96×96
  characteristicPolynomial: 9_216, // break-even at ~96×96

  // hypothesis tests: element-wise reduction (chiSquare) and post-sort
  // dot-product (KS/MW/SW). Threshold 4096 per Slice 3.10 spec.
  chiSquareTest: 4_096,
  kolmogorovSmirnovTest: 4_096,
  mannWhitneyTest: 4_096,
  shapiroWilkTest: 4_096,

  // distribution batch sampling: per-sample cost (rejection/transcendental) amortises
  // worker overhead above 100 000 samples (Slice 5.12).
  sampleChunk: 100_000,
};

/**
 * Default ComputePool configuration
 */
export const DEFAULT_POOL_CONFIG: ComputePoolConfig = {
  enabled: true,
  minWorkers: 1,
  maxWorkers: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  thresholdElements: 50000,
  thresholdByOp: DEFAULT_THRESHOLD_BY_OP,
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

// =============================================================================
// tensordot kernel helpers (used by sequential path and exported for tests)
// =============================================================================

/**
 * Row-major strides for a shape array.
 *
 * Kept as a local copy deliberately. The canonical implementation is
 * `Tensor.rowMajorStrides` in `@danielsimonjr/mathts-tensor`, but this package
 * (`@danielsimonjr/mathts-parallel`) depends ONLY on
 * `@danielsimonjr/mathts-workerpool` — it has no dependency on `tensor` or
 * `core`. Importing the canonical helper would pull the entire tensor/core math
 * stack into this low-level parallelization layer just for a 9-line pure,
 * stable function (row-major strides are a fixed mathematical definition). That
 * is worse coupling than this small duplicate, so the copy is retained by
 * design. See Duplication Audit Cluster H.
 * @internal
 */
function _rowMajorStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let stride = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= shape[i];
  }
  return strides;
}

/**
 * Multi-index to flat index using precomputed strides.
 * @internal
 */
function _flatIndex(idx: readonly number[], strides: readonly number[]): number {
  let flat = 0;
  for (let i = 0; i < idx.length; i++) flat += idx[i] * strides[i];
  return flat;
}

/**
 * Iterate over all multi-indices for `sizes` calling `cb(multiIndex)`.
 * @internal
 */
function _forEachIndex(sizes: readonly number[], cb: (idx: number[]) => void): void {
  const rank = sizes.length;
  if (rank === 0) {
    cb([]);
    return;
  }
  const idx = new Array<number>(rank).fill(0);
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    cb(idx.slice());
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      if (idx[d] < sizes[d]) break;
      idx[d] = 0;
    }
  }
}

/**
 * Pure-JS tensordot computation over a contiguous range of output elements
 * `[outStart, outEnd)`.
 *
 * This is the shared inner kernel used by both the sequential fallback path in
 * `ComputePool.tensordot` and the worker-dispatched `tensordotChunk` handler.
 * By exporting it and registering it in the worker, we keep the algorithm in
 * one place and avoid divergence.
 *
 * Contracts axis `axesA[i]` of `a` (shape `aShape`) with axis `axesB[i]` of
 * `b` (shape `bShape`). The result layout is free-A axes first, then free-B
 * axes (NumPy convention).
 */
export function tensordotChunkKernel(
  a: Float64Array,
  aShape: readonly number[],
  b: Float64Array,
  bShape: readonly number[],
  axesA: readonly number[],
  axesB: readonly number[],
  resultShape: readonly number[],
  outStart: number,
  outEnd: number
): Float64Array {
  const aStrides = _rowMajorStrides(aShape);
  const bStrides = _rowMajorStrides(bShape);
  const outStrides = _rowMajorStrides(resultShape);

  const aRank = aShape.length;
  const bRank = bShape.length;
  const contractedAxesA = Array.from(axesA);
  const contractedAxesB = Array.from(axesB);
  const contractedSetA = new Set(contractedAxesA);
  const contractedSetB = new Set(contractedAxesB);

  const aFreeAxes: number[] = [];
  const bFreeAxes: number[] = [];
  for (let i = 0; i < aRank; i++) if (!contractedSetA.has(i)) aFreeAxes.push(i);
  for (let i = 0; i < bRank; i++) if (!contractedSetB.has(i)) bFreeAxes.push(i);

  const contractedSizes = contractedAxesA.map((ax) => aShape[ax]);

  const chunkLen = outEnd - outStart;
  const result = new Float64Array(chunkLen);

  const outRank = resultShape.length;
  const outIdx = new Array<number>(outRank);

  for (let outFlat = outStart; outFlat < outEnd; outFlat++) {
    // Decode flat output index to multi-index
    let rem = outFlat;
    for (let d = 0; d < outRank; d++) {
      outIdx[d] = Math.floor(rem / outStrides[d]);
      rem -= outIdx[d] * outStrides[d];
    }

    const aFreeVals = outIdx.slice(0, aFreeAxes.length);
    const bFreeVals = outIdx.slice(aFreeAxes.length);

    // Sum over contracted axes
    let acc = 0;
    _forEachIndex(contractedSizes, (contractVals) => {
      const aIdx = new Array<number>(aRank).fill(0);
      for (let fi = 0; fi < aFreeAxes.length; fi++) aIdx[aFreeAxes[fi]] = aFreeVals[fi];
      for (let ci = 0; ci < contractedAxesA.length; ci++)
        aIdx[contractedAxesA[ci]] = contractVals[ci];

      const bIdx = new Array<number>(bRank).fill(0);
      for (let fi = 0; fi < bFreeAxes.length; fi++) bIdx[bFreeAxes[fi]] = bFreeVals[fi];
      for (let ci = 0; ci < contractedAxesB.length; ci++)
        bIdx[contractedAxesB[ci]] = contractVals[ci];

      acc += a[_flatIndex(aIdx, aStrides)] * b[_flatIndex(bIdx, bStrides)];
    });

    result[outFlat - outStart] = acc;
  }

  return result;
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
   * Determine if operation should be parallelized.
   *
   * When `op` is supplied the per-op threshold map is consulted first;
   * if the op is absent from the map the global `thresholdElements` fallback
   * is used.  When `op` is omitted the global threshold is always used (for
   * backward-compatibility with existing callers that don't know the op name).
   */
  shouldParallelize(elementCount: number, op?: OpName): boolean {
    const byOp = this.config.thresholdByOp;
    if (op !== undefined && byOp !== undefined && op in byOp) {
      const raw = byOp[op];
      if (raw !== undefined) {
        const threshold = resolveOpThreshold(raw);
        return this.config.enabled && elementCount >= threshold && this.workerPool.isReady();
      }
    }
    return this.workerPool.shouldParallelize(elementCount);
  }

  /**
   * Wrap a sequentially-computed reduction result in the `ParallelResult`
   * envelope. Used by the reduction methods below so that ops whose threshold
   * says "don't parallelize at this size" (notably the memory-bound reductions
   * pinned to `'never'`) compute inline instead of paying a worker round-trip —
   * previously every reduction dispatched to the pool unconditionally, ignoring
   * its threshold.
   */
  private seqResult<T>(result: T): ParallelResult<T> {
    return { result, duration: 0, chunks: 1, parallelized: false };
  }

  /**
   * Execute a method in the worker pool
   */
  async exec<T>(method: string, params: unknown[], options?: TaskOptions): Promise<T> {
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
    if (!this.shouldParallelize(data.length, 'sum')) {
      // PAIRWISE, not `s += data[i]`. Naive accumulation grows error as O(n)*eps; pairwise as
      // O(log n)*eps. On 1e6 elements that is 1.3e-11 vs 2.9e-16 — we were ~46,000x less accurate
      // than NumPy's `np.sum`, and `mean`/`std`/`variance` all inherit it.
      return this.seqResult(pairwiseSum(data));
    }
    return toParallelResult(await this.workerPool.sum(data));
  }

  /**
   * Parallel product of array elements
   */
  async prod(data: Float64Array): Promise<ParallelResult<number>> {
    if (!this.shouldParallelize(data.length, 'prod')) {
      let p = 1;
      for (let i = 0; i < data.length; i++) p *= data[i];
      return this.seqResult(p);
    }
    return toParallelResult(await this.workerPool.prod(data));
  }

  /**
   * Parallel dot product
   */
  async dot(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
    if (!this.shouldParallelize(a.length, 'dot')) {
      if (a.length !== b.length) throw new Error('dot: vectors must have the same length');
      let s = 0;
      for (let i = 0; i < a.length; i++) s += a[i] * b[i];
      return this.seqResult(s);
    }
    return toParallelResult(await this.workerPool.dot(a, b));
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
    if (!this.shouldParallelize(data.length, 'transpose')) {
      if (data.length !== rows * cols) {
        throw new Error(`transpose: data length ${data.length} !== rows*cols (${rows * cols})`);
      }
      const out = new Float64Array(rows * cols);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) out[j * rows + i] = data[i * cols + j];
      }
      return this.seqResult(out);
    }
    const result = await this.workerPool.transpose(data, rows, cols);
    return toParallelResult(result);
  }

  /**
   * Parallel map operation
   */
  async map<T, R>(data: T[], fn: (item: T) => R): Promise<ParallelResult<R[]>> {
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
  async filter<T>(data: T[], predicate: (item: T) => boolean): Promise<ParallelResult<T[]>> {
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
    // 'minMax' backs both `min` and `max` (they slice this result); gate on the
    // stricter of the two so it honors either op's threshold.
    if (
      !this.shouldParallelize(data.length, 'minMax') &&
      !this.shouldParallelize(data.length, 'min')
    ) {
      let min = Infinity;
      let max = -Infinity;
      let minIdx = -1;
      let maxIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < min) {
          min = data[i];
          minIdx = i;
        }
        if (data[i] > max) {
          max = data[i];
          maxIdx = i;
        }
      }
      return this.seqResult({ min, max, minIdx, maxIdx });
    }
    return toParallelResult(await this.workerPool.minMax(data));
  }

  /**
   * Compute variance, mean, and standard deviation in parallel
   */
  async variance(
    data: Float64Array
  ): Promise<ParallelResult<{ mean: number; variance: number; std: number }>> {
    if (!this.shouldParallelize(data.length, 'variance')) {
      const n = data.length;
      let mean = 0;
      for (let i = 0; i < n; i++) mean += data[i];
      mean = n > 0 ? mean / n : 0;
      let acc = 0;
      for (let i = 0; i < n; i++) acc += (data[i] - mean) ** 2;
      const variance = n > 0 ? acc / n : 0; // population variance (matches the worker)
      return this.seqResult({ mean, variance, std: Math.sqrt(variance) });
    }
    return toParallelResult(await this.workerPool.variance(data));
  }

  /**
   * Compute norm (Euclidean length) in parallel
   */
  async norm(data: Float64Array): Promise<ParallelResult<number>> {
    if (!this.shouldParallelize(data.length, 'norm')) {
      // LAPACK dnrm2 scaling, not `sqrt(sum(x*x))`: squaring before adding overflows to Infinity
      // around 1e200 and FLUSHES TO ZERO around 1e-200 (a silently wrong answer, worse than the
      // overflow). NumPy has this bug — `np.linalg.norm([1e200]*4)` is `inf`. We don't.
      return this.seqResult(norm2(data));
    }
    return toParallelResult(await this.workerPool.norm(data));
  }

  /**
   * Compute Euclidean distance in parallel
   */
  async distance(a: Float64Array, b: Float64Array): Promise<ParallelResult<number>> {
    if (!this.shouldParallelize(a.length, 'distance')) {
      if (a.length !== b.length) throw new Error('distance: vectors must have the same length');
      let s = 0;
      for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
      return this.seqResult(Math.sqrt(s));
    }
    return toParallelResult(await this.workerPool.distance(a, b));
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
    if (!this.shouldParallelize(data.length, 'histogram')) {
      let lo = min;
      let hi = max;
      if (lo === undefined || hi === undefined) {
        lo = Infinity;
        hi = -Infinity;
        for (let i = 0; i < data.length; i++) {
          if (data[i] < lo) lo = data[i];
          if (data[i] > hi) hi = data[i];
        }
      }
      const counts = new Array<number>(bins).fill(0);
      const width = (hi - lo) / bins || 1;
      for (let i = 0; i < data.length; i++) {
        let b = Math.floor((data[i] - lo) / width);
        if (b >= bins) b = bins - 1;
        if (b < 0) b = 0;
        counts[b]++;
      }
      return this.seqResult(counts);
    }
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
  async applyKernel(data: Float64Array, fnSource: string): Promise<ParallelResult<Float64Array>> {
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
   * Fan-out Gauss-Legendre quadrature over `workerCount` sub-intervals.
   *
   * Partitions `[a, b]` into `workerCount` equal sub-domains and dispatches one
   * `integrateChunk` worker task per sub-domain.  Each task evaluates the
   * integrand (supplied as a stringified closure) with the given GL nodes and
   * weights and returns its partial integral.  The partial sums are aggregated
   * on the main thread.
   *
   * **Closure contract:** `fnSource` must be a self-contained `(x: number) =>
   * number` expression — no free variables referencing outer scope, because it
   * is eval'd inside an isolated worker context.  Call-site validation (via
   * `validateClosureSource`) should have already rejected unsafe closures before
   * reaching this method.
   *
   * @param fnSource    - Stringified integrand, e.g. `"(x) => Math.sin(x)"`
   * @param a           - Lower integration bound
   * @param b           - Upper integration bound
   * @param workerCount - Number of sub-intervals / worker tasks
   * @param nodes       - GL nodes on [-1, 1]
   * @param weights     - Corresponding GL weights
   * @returns Sum of partial integrals = approximate value of ∫ₐᵇ f(x) dx
   */
  async integrateFanOut(
    fnSource: string,
    a: number,
    b: number,
    workerCount: number,
    nodes: number[],
    weights: number[]
  ): Promise<number> {
    const h = (b - a) / workerCount;
    const tasks: Promise<number>[] = [];
    for (let k = 0; k < workerCount; k++) {
      const subA = a + k * h;
      const subB = a + (k + 1) * h;
      tasks.push(
        this.workerPool.exec<number>('integrateChunk', [fnSource, subA, subB, nodes, weights])
      );
    }
    const partials = await Promise.all(tasks);
    return partials.reduce((acc, v) => acc + v, 0);
  }

  /**
   * Fan-out distribution batch sampling across `workerCount` workers.
   *
   * Partitions `n` samples into `workerCount` equal chunks (last chunk absorbs
   * the remainder) and dispatches one `sampleChunk` task per chunk. Each chunk
   * uses an independent seed derived from `baseSeed` via SplitMix64-style
   * hashing:
   *
   *   `chunkSeed = (baseSeed ^ (chunkIdx * 0x9E3779B97F4A7C15)) >>> 0`
   *
   * This Fibonacci-hashing multiplier gives good avalanche: even baseSeed=0
   * produces K distinct seeds, and adjacent chunk indices produce uncorrelated
   * sequences. See the `sampleChunk` worker kernel for the full rationale.
   *
   * @param distName    - One of 'normal', 'gamma', 'beta', 'studentT', 'exponential'
   * @param params      - Distribution parameters (order matches factory functions)
   * @param n           - Total number of samples to generate
   * @param baseSeed    - Base seed for reproducible output
   * @param workerCount - Number of parallel worker tasks
   * @returns Concatenated Float64Array of `n` samples
   */
  async distributionSampleFanOut(
    distName: string,
    params: number[],
    n: number,
    baseSeed: number,
    workerCount: number
  ): Promise<Float64Array> {
    // SplitMix64-style seed derivation constant (Fibonacci hashing).
    // Low 32 bits of the golden-ratio fractional part × 2^64.
    const SPLIT_MIX_CONST = 0x9e3779b9; // truncated to 32-bit safe range for JS

    const baseChunkSize = Math.floor(n / workerCount);
    const tasks: Promise<ArrayBuffer>[] = [];

    for (let k = 0; k < workerCount; k++) {
      const chunkCount =
        k < workerCount - 1 ? baseChunkSize : n - baseChunkSize * (workerCount - 1);
      // Seed splitting: XOR baseSeed with k * SPLIT_MIX_CONST (uint32)
      const chunkSeed = (baseSeed ^ (Math.imul(k, SPLIT_MIX_CONST) | 0)) >>> 0;
      tasks.push(
        this.workerPool.exec<ArrayBuffer>('sampleChunk', [distName, params, chunkSeed, chunkCount])
      );
    }

    const buffers = await Promise.all(tasks);

    // Concatenate chunk results into a single Float64Array
    const out = new Float64Array(n);
    let offset = 0;
    for (const buf of buffers) {
      const chunk = new Float64Array(buf);
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
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
    const result = await this.workerPool.fftBatch(real, imag, frameCount, frameLength, inverse);
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
    if (!this.shouldParallelize(matrix.length, 'matvec')) {
      if (matrix.length !== rows * cols) {
        throw new Error(`matvec: matrix length ${matrix.length} !== rows*cols (${rows * cols})`);
      }
      if (vector.length !== cols) {
        throw new Error(`matvec: vector length ${vector.length} !== cols (${cols})`);
      }
      const out = new Float64Array(rows);
      for (let i = 0; i < rows; i++) {
        let s = 0;
        for (let j = 0; j < cols; j++) s += matrix[i * cols + j] * vector[j];
        out[i] = s;
      }
      return this.seqResult(out);
    }
    const result = await this.workerPool.matvec(matrix, rows, cols, vector);
    return toParallelResult(result);
  }

  /**
   * Parallel outer product
   */
  async outer(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    if (!this.shouldParallelize(a.length * b.length, 'outer')) {
      const out = new Float64Array(a.length * b.length);
      for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) out[i * b.length + j] = a[i] * b[j];
      }
      return this.seqResult(out);
    }
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
  async sort<T>(data: T[], compare?: (a: T, b: T) => number): Promise<ParallelResult<T[]>> {
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
   * Parallel element-wise exponentiation.
   *
   * `out[i] = a[i] ** b[i]`
   *
   * Delegates to `applyKernel2` with the `Math.pow` kernel. The default
   * per-op threshold for `pow` is `'never'` (overhead dominates); the
   * sequential path is taken unless the caller overrides `thresholdByOp.pow`.
   */
  async pow(a: Float64Array, b: Float64Array): Promise<ParallelResult<Float64Array>> {
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'pow')) {
      return this.applyKernel2(a, b, '(a, b) => Math.pow(a, b)');
    }
    const start = performance.now();
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] ** b[i];
    }
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * Parallel element-wise sign function.
   *
   * `out[i] = Math.sign(data[i])`  →  -1 | 0 | 1, with NaN → NaN (IEEE 754).
   *
   * Delegates to `applyKernel` with the `Math.sign` kernel. The default
   * per-op threshold for `sign` is `'never'` (overhead dominates); the
   * sequential path is taken unless the caller overrides `thresholdByOp.sign`.
   */
  async sign(data: Float64Array): Promise<ParallelResult<Float64Array>> {
    if (this.shouldParallelize(data.length, 'sign')) {
      return this.applyKernel(data, '(x) => Math.sign(x)');
    }
    const start = performance.now();
    const result = new Float64Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = Math.sign(data[i]);
    }
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
  }

  /**
   * General tensor contraction (tensordot) over specified axis pairs.
   *
   * Contracts axis `axesA[i]` of `a` with axis `axesB[i]` of `b` for each
   * pair index `i`. The result shape is the non-contracted axes of `a` followed
   * by the non-contracted axes of `b` (NumPy convention).
   *
   * Parallelization threshold: contracted-axis volume (product of contracted
   * dimensions) >= 8 192. When parallelized, output elements are distributed
   * in contiguous slices across workers via the `tensordotChunk` kernel.
   *
   * @param a      - Flat row-major Float64Array for tensor A
   * @param aShape - Shape of tensor A
   * @param b      - Flat row-major Float64Array for tensor B
   * @param bShape - Shape of tensor B
   * @param axesA  - Axes of A to contract (same length as axesB)
   * @param axesB  - Axes of B to contract (same length as axesA)
   * @returns `{ data: Float64Array; shape: number[] }` — flat result + result shape
   */
  async tensordot(
    a: Float64Array,
    aShape: readonly number[],
    b: Float64Array,
    bShape: readonly number[],
    axesA: readonly number[],
    axesB: readonly number[]
  ): Promise<ParallelResult<{ data: Float64Array; shape: number[] }>> {
    if (axesA.length !== axesB.length) {
      throw new Error(
        `tensordot: axesA.length (${axesA.length}) !== axesB.length (${axesB.length})`
      );
    }

    const aRank = aShape.length;
    const bRank = bShape.length;
    const aContracted = new Set<number>();
    const bContracted = new Set<number>();

    for (let i = 0; i < axesA.length; i++) {
      const ax = axesA[i];
      const bx = axesB[i];
      if (!Number.isInteger(ax) || ax < 0 || ax >= aRank) {
        throw new Error(`tensordot: axesA[${i}]=${ax} is out of range for aShape (rank ${aRank})`);
      }
      if (!Number.isInteger(bx) || bx < 0 || bx >= bRank) {
        throw new Error(`tensordot: axesB[${i}]=${bx} is out of range for bShape (rank ${bRank})`);
      }
      if (aShape[ax] !== bShape[bx]) {
        throw new Error(
          `tensordot: dimension mismatch on contracted axes: ` +
            `aShape[${ax}]=${aShape[ax]} vs bShape[${bx}]=${bShape[bx]}`
        );
      }
      aContracted.add(ax);
      bContracted.add(bx);
    }

    // Build result shape: free axes of A then free axes of B
    const resultShape: number[] = [];
    for (let i = 0; i < aRank; i++) {
      if (!aContracted.has(i)) resultShape.push(aShape[i]);
    }
    for (let i = 0; i < bRank; i++) {
      if (!bContracted.has(i)) resultShape.push(bShape[i]);
    }

    const resultSize = resultShape.reduce((acc, d) => acc * d, 1);

    // Contracted-axis volume determines whether to parallelize
    const contractedVolume = Array.from(axesA).reduce((acc, ax) => acc * aShape[ax], 1);

    const start = performance.now();

    if (this.shouldParallelize(contractedVolume, 'tensordot') && resultSize > 0) {
      const chunkSize = this.config.chunkSize;
      const chunks: Array<[number, number]> = [];
      for (let i = 0; i < resultSize; i += chunkSize) {
        chunks.push([i, Math.min(i + chunkSize, resultSize)]);
      }

      const aShapeArr = Array.from(aShape);
      const bShapeArr = Array.from(bShape);
      const axesAArr = Array.from(axesA);
      const axesBArr = Array.from(axesB);

      const chunkResults = await Promise.all(
        chunks.map(([outStart, outEnd]) =>
          this.workerPool.exec<ArrayBuffer>('tensordotChunk', [
            a.buffer,
            aShapeArr,
            b.buffer,
            bShapeArr,
            axesAArr,
            axesBArr,
            resultShape,
            outStart,
            outEnd,
          ])
        )
      );

      const data = new Float64Array(resultSize);
      let offset = 0;
      for (const buf of chunkResults) {
        const chunk = new Float64Array(buf);
        data.set(chunk, offset);
        offset += chunk.length;
      }

      return {
        result: { data, shape: resultShape },
        duration: performance.now() - start,
        chunks: chunks.length,
        parallelized: true,
      };
    }

    // Sequential path
    const data =
      resultSize === 0
        ? new Float64Array(0)
        : tensordotChunkKernel(a, aShape, b, bShape, axesA, axesB, resultShape, 0, resultSize);

    return {
      result: { data, shape: resultShape },
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
    };
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
  // Above the elementwise threshold these dispatch to the `Int32Array`-keyed
  // worker kernels in `@danielsimonjr/mathts-workerpool` (`bitwiseChunk`,
  // `bitwiseScalarChunk`, `bitwiseNotChunk`). Below threshold they fall back
  // to the pure in-process drivers in `./ops/bitwise.ts`. The fallback path
  // uses those drivers verbatim so the algorithm lives in one place.

  /**
   * Element-wise bitwise AND on two `Int32Array`s.
   */
  async bitAnd(a: Int32Array, b: Int32Array): Promise<ParallelResult<Int32Array>> {
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'bitAnd')) {
      return toParallelResult(await this.workerPool.bitwiseBinary(a, b, 'bitAnd'));
    }
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
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'bitOr')) {
      return toParallelResult(await this.workerPool.bitwiseBinary(a, b, 'bitOr'));
    }
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
    if (a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'bitXor')) {
      return toParallelResult(await this.workerPool.bitwiseBinary(a, b, 'bitXor'));
    }
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
    if (this.shouldParallelize(a.length, 'bitNot')) {
      return toParallelResult(await this.workerPool.bitwiseNot(a));
    }
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
  async leftShift(a: Int32Array, b: Int32Array | number): Promise<ParallelResult<Int32Array>> {
    if (typeof b !== 'number' && a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'leftShift')) {
      const result =
        typeof b === 'number'
          ? await this.workerPool.bitwiseScalar(a, b, 'leftShift')
          : await this.workerPool.bitwiseBinary(a, b, 'leftShift');
      return toParallelResult(result);
    }
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
    if (typeof b !== 'number' && a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'rightArithShift')) {
      const result =
        typeof b === 'number'
          ? await this.workerPool.bitwiseScalar(a, b, 'rightArithShift')
          : await this.workerPool.bitwiseBinary(a, b, 'rightArithShift');
      return toParallelResult(result);
    }
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
  async rightLogShift(a: Int32Array, b: Int32Array | number): Promise<ParallelResult<Int32Array>> {
    if (typeof b !== 'number' && a.length !== b.length) {
      throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
    }
    if (this.shouldParallelize(a.length, 'rightLogShift')) {
      const result =
        typeof b === 'number'
          ? await this.workerPool.bitwiseScalar(a, b, 'rightLogShift')
          : await this.workerPool.bitwiseBinary(a, b, 'rightLogShift');
      return toParallelResult(result);
    }
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
   * Maximum number of workers configured for this pool.
   * Used by distribution sampling fan-out to determine chunk count.
   */
  get workerCount(): number {
    return this.config.maxWorkers;
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
