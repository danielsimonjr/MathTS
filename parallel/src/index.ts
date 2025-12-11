/**
 * @mathts/parallel
 *
 * WebWorker parallelization for MathTS computations.
 * Provides automatic parallelization based on data size thresholds.
 *
 * @packageDocumentation
 */

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

// Re-export workerpool types for advanced usage
export type {
  PoolOptions,
  ExecOptions,
  PoolStats,
} from 'workerpool';
