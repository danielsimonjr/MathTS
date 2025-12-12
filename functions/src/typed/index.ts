/**
 * Typed Functions Index
 *
 * Re-exports all typed functions that use polymorphic dispatch
 * via @mathts/core's mathTyped system.
 *
 * @packageDocumentation
 */

// Arithmetic functions
export * from './arithmetic.js';
export { typedArithmetic } from './arithmetic.js';

// Trigonometric functions
export * from './trigonometry.js';
export { typedTrigonometry } from './trigonometry.js';

// Parallel-first functions (workerpool integration)
export * from './parallel-arithmetic.js';
export { parallelArithmetic } from './parallel-arithmetic.js';

// Parallel-first signal processing functions
export * from './parallel-signal.js';
export { parallelSignal } from './parallel-signal.js';

// Parallel-first statistics functions
export * from './parallel-statistics.js';
export { parallelStatistics } from './parallel-statistics.js';

// Combined export
import { typedArithmetic } from './arithmetic.js';
import { typedTrigonometry } from './trigonometry.js';
import { parallelArithmetic } from './parallel-arithmetic.js';
import { parallelSignal } from './parallel-signal.js';
import { parallelStatistics } from './parallel-statistics.js';

/**
 * All typed functions combined
 */
export const typedFunctions = {
  ...typedArithmetic,
  ...typedTrigonometry,
};

/**
 * All parallel-first functions combined
 */
export const typedParallelFunctions = {
  ...parallelArithmetic,
  ...parallelSignal,
  ...parallelStatistics,
};
