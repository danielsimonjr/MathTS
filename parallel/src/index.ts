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
