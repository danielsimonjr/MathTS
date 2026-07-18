/**
 * @danielsimonjr/mathts-parallel
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
  DEFAULT_THRESHOLD_BY_OP,
  resolveOpThreshold,
} from './ComputePool.js';

export type { ComputePoolConfig, ParallelResult, OpName, OpThreshold } from './ComputePool.js';

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
// Bitwise Operations (Int32Array)
// =============================================================================

export {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
} from './ops/bitwise.js';

export type { BitwiseBinaryOp } from './ops/bitwise.js';

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

// Re-export workerpool types for advanced usage. Consolidated onto
// `@danielsimonjr/mathts-workerpool`'s byte-identical definitions (this
// package already depends on workerpool) instead of the former local
// redeclaration — see docs/Architecture/duplicate-symbols.json.
export type { PoolOptions, ExecOptions, PoolStats } from '@danielsimonjr/mathts-workerpool';
