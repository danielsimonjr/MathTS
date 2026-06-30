/**
 * Threshold-based Dispatch Strategy
 *
 * Automatically decides whether to use parallel or sequential execution
 * based on data size, operation type, and system capabilities.
 *
 * @packageDocumentation
 */

import { computePool, ComputePool, DEFAULT_THRESHOLD_BY_OP } from '../ComputePool.js';

/**
 * Pull a numeric per-op threshold from the canonical {@link DEFAULT_THRESHOLD_BY_OP}
 * map, falling back to `fallback` when the op is absent or set to a non-numeric
 * mode ('never'/'always'). Keeps the category defaults below sourced from the
 * same benchmark-tuned numbers ComputePool uses.
 */
function opThreshold(op: string, fallback: number): number {
  const raw = (DEFAULT_THRESHOLD_BY_OP as Record<string, number | string>)[op];
  return typeof raw === 'number' ? raw : fallback;
}

/**
 * Operation categories for threshold selection
 */
export type OperationCategory =
  | 'matmul' // O(n³) matrix multiplication
  | 'elementwise' // O(n) element-wise operations
  | 'reduce' // O(n) reduction operations
  | 'map' // O(n) map operations
  | 'sort' // O(n log n) sorting
  | 'decomposition' // O(n³) matrix decompositions
  | 'general'; // General operations

/**
 * Threshold configuration for different operation types
 */
export interface ThresholdConfig {
  /** Minimum elements for parallel matmul */
  matmul: number;
  /** Minimum elements for parallel elementwise ops */
  elementwise: number;
  /** Minimum elements for parallel reductions */
  reduce: number;
  /** Minimum elements for parallel map */
  map: number;
  /** Minimum elements for parallel sort */
  sort: number;
  /** Minimum elements for parallel decomposition */
  decomposition: number;
  /** Default threshold for other operations */
  general: number;
}

/**
 * Default category-level thresholds.
 *
 * NOTE: `ComputePool.shouldParallelize` (op-level, {@link DEFAULT_THRESHOLD_BY_OP})
 * is the authority the typed functions dispatch through. This category map is a
 * coarser helper; where a category overlaps a tuned op (matmul) its value is
 * derived from the canonical const so the two cannot diverge. The remaining
 * categories (no single ComputePool op equivalent — many are 'never') keep
 * heuristic defaults for compute-vs-memory-bound work.
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  matmul: opThreshold('matmul', 4096), // canonical: DEFAULT_THRESHOLD_BY_OP.matmul
  elementwise: 50000, // ~50K elements (memory-bound; ComputePool ops mostly 'never')
  reduce: 100000, // ~100K elements
  map: 10000, // ~10K elements
  sort: 5000, // ~5K elements
  decomposition: 2500, // ~50x50 matrix (no single canonical op; heuristic)
  general: 50000, // Default ~50K
};

/**
 * Execution mode returned by threshold dispatch
 */
export type ExecutionMode = 'parallel' | 'sequential';

/**
 * Result of threshold dispatch decision
 */
export interface DispatchResult {
  /** Recommended execution mode */
  mode: ExecutionMode;
  /** Reason for the decision */
  reason: string;
  /** Threshold used for comparison */
  threshold: number;
  /** Actual element count */
  elementCount: number;
}

/**
 * Threshold-based Dispatch Manager
 *
 * Provides intelligent parallel vs sequential dispatch based on
 * operation type, data size, and system state.
 */
export class ThresholdDispatcher {
  private thresholds: ThresholdConfig;
  private pool: ComputePool;

  constructor(thresholds: Partial<ThresholdConfig> = {}, pool?: ComputePool) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.pool = pool ?? computePool;
  }

  /**
   * Get threshold for a specific operation category
   */
  getThreshold(category: OperationCategory): number {
    return this.thresholds[category];
  }

  /**
   * Update thresholds
   */
  setThresholds(thresholds: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current threshold configuration
   */
  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Determine execution mode based on operation and data size
   */
  dispatch(elementCount: number, category: OperationCategory = 'general'): DispatchResult {
    const threshold = this.thresholds[category];
    const poolReady = this.pool.isReady();

    // Check if pool is ready
    if (!poolReady) {
      return {
        mode: 'sequential',
        reason: 'Worker pool not initialized',
        threshold,
        elementCount,
      };
    }

    // Check pool configuration
    const config = this.pool.getConfig();
    if (!config.enabled) {
      return {
        mode: 'sequential',
        reason: 'Parallel processing disabled',
        threshold,
        elementCount,
      };
    }

    // Check element count against threshold
    if (elementCount < threshold) {
      return {
        mode: 'sequential',
        reason: `Element count (${elementCount}) below threshold (${threshold})`,
        threshold,
        elementCount,
      };
    }

    // All checks passed - use parallel
    return {
      mode: 'parallel',
      reason: `Element count (${elementCount}) exceeds threshold (${threshold})`,
      threshold,
      elementCount,
    };
  }

  /**
   * Simple boolean check for parallel execution
   */
  shouldParallelize(elementCount: number, category: OperationCategory = 'general'): boolean {
    return this.dispatch(elementCount, category).mode === 'parallel';
  }

  /**
   * Calculate optimal chunk count based on operation and data size
   */
  calculateChunks(elementCount: number, category: OperationCategory = 'general'): number {
    const dispatch = this.dispatch(elementCount, category);

    if (dispatch.mode === 'sequential') {
      return 1;
    }

    const stats = this.pool.stats();
    const workerCount = Math.max(1, stats.totalWorkers);

    // For different operations, optimal chunk count varies
    switch (category) {
      case 'matmul':
      case 'decomposition':
        // CPU-bound: use all workers
        return workerCount;

      case 'elementwise':
      case 'map':
        // Memory-bound: slightly more chunks than workers for load balancing
        return Math.min(workerCount * 2, Math.ceil(elementCount / 10000));

      case 'reduce':
        // Reduction needs aggregation step: moderate chunk count
        return Math.min(workerCount, Math.ceil(elementCount / 50000));

      case 'sort':
        // Merge overhead: limit chunks
        return Math.min(workerCount, 8);

      default:
        return workerCount;
    }
  }
}

/**
 * Global threshold dispatcher instance
 */
export const thresholdDispatcher = new ThresholdDispatcher();

/**
 * Convenience function to check if operation should be parallelized
 */
export function shouldParallelize(
  elementCount: number,
  category: OperationCategory = 'general'
): boolean {
  return thresholdDispatcher.shouldParallelize(elementCount, category);
}

/**
 * Convenience function to get dispatch decision
 */
export function dispatch(
  elementCount: number,
  category: OperationCategory = 'general'
): DispatchResult {
  return thresholdDispatcher.dispatch(elementCount, category);
}

/**
 * Convenience function to calculate optimal chunk count
 */
export function calculateChunks(
  elementCount: number,
  category: OperationCategory = 'general'
): number {
  return thresholdDispatcher.calculateChunks(elementCount, category);
}
