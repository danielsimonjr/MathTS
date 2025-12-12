/**
 * @mathts/parallel
 *
 * WebWorker parallelization for MathTS computations.
 * Provides automatic parallelization based on data size thresholds.
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Pool
// =============================================================================

export {
  ComputePool,
  computePool,
  Transfer,
  DEFAULT_POOL_CONFIG,
} from './ComputePool.js';

export type {
  ComputePoolConfig,
  ParallelResult,
} from './ComputePool.js';

// =============================================================================
// Operations
// =============================================================================

export {
  // Matrix operations
  parallelMatmul,
  parallelMatvec,
  parallelTranspose,
  parallelOuter,
  parallelDot,

  // Element-wise operations
  parallelAdd,
  parallelSubtract,
  parallelMultiply,
  parallelDivide,
  parallelScale,
  parallelAbs,
  parallelNegate,
  parallelSquare,
  parallelSqrt,
  parallelExp,
  parallelLog,
  parallelSin,
  parallelCos,
  parallelTan,
  parallelElementwise,
  parallelUnary,

  // Reduction operations
  parallelSum,
  parallelMean,
  parallelMin,
  parallelMax,
  parallelMinMax,
  parallelVariance,
  parallelStd,
  parallelNorm,
  parallelDistance,
  parallelHistogram,
  parallelReduce,

  // Map and transform operations
  parallelMap,
  parallelFilter,
  parallelFind,
  parallelSort,
  parallelForEach,
  parallelSome,
  parallelEvery,
  parallelCount,
} from './operations/index.js';

export type {
  MatmulOptions,
  ElementwiseOptions,
  ReduceOptions,
  MapOptions,
} from './operations/index.js';

// =============================================================================
// Strategies
// =============================================================================

export {
  // Chunking strategies
  calculateOptimalChunks,
  chunkFloat64Array,
  chunkArray,
  mergeFloat64Chunks,
  mergeArrayChunks,
  shouldChunkParallelize,
  partitionRange,
  partition2D,

  // Threshold-based dispatch
  ThresholdDispatcher,
  thresholdDispatcher,
  shouldParallelize,
  dispatch,
  calculateChunks,
  DEFAULT_THRESHOLDS,
} from './strategies/index.js';

export type {
  ChunkOptions,
  ChunkResult,
  ChunkInfo,
  ThresholdConfig,
  OperationCategory,
  ExecutionMode,
  DispatchResult,
} from './strategies/index.js';

// =============================================================================
// Re-exported Types
// =============================================================================

// Re-export workerpool types for advanced usage (locally defined to avoid type resolution issues)
export interface PoolOptions {
  minWorkers?: number | 'max';
  maxWorkers?: number;
  workerType?: 'auto' | 'web' | 'thread';
  workerTerminateTimeout?: number;
}

export interface ExecOptions {
  on?: (payload: unknown) => void;
  transfer?: unknown[];
  timeout?: number;
}

export interface PoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
  activeTasks: number;
}
