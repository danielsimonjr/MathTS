/**
 * Typed Functions Index (Parallel-First)
 *
 * Re-exports all typed functions that use polymorphic dispatch
 * via @mathts/core's mathTyped system with parallel-first execution
 * through @mathts/parallel's ComputePool.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL array transformations (Float64Array)
 * - Use workers for ALL numerical computations that can be batched
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Typed Functions (Parallel-First Unified)
// =============================================================================

// Arithmetic functions (includes parallel Float64Array support)
export * from './arithmetic.js';
export { typedArithmetic } from './arithmetic.js';

// Trigonometric functions (includes parallel Float64Array support)
export * from './trigonometry.js';
export { typedTrigonometry } from './trigonometry.js';

// Statistics functions (parallel-first)
export * from './statistics.js';
export { typedStatistics } from './statistics.js';

// Signal processing functions (parallel-first)
export * from './signal.js';
export { typedSignal } from './signal.js';

// =============================================================================
// Combined Exports
// =============================================================================

import { typedArithmetic } from './arithmetic.js';
import { typedTrigonometry } from './trigonometry.js';
import { typedStatistics } from './statistics.js';
import { typedSignal } from './signal.js';

/**
 * All typed functions combined (parallel-first)
 *
 * This includes all arithmetic, trigonometric, statistics, and signal
 * processing functions with automatic parallel execution for Float64Array.
 */
export const typedFunctions = {
  ...typedArithmetic,
  ...typedTrigonometry,
  ...typedStatistics,
  ...typedSignal,
};
