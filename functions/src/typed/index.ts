/**
 * Typed Functions Index (Parallel-First)
 *
 * Re-exports all typed functions that use polymorphic dispatch
 * via @danielsimonjr/mathts-core's mathTyped system with parallel-first execution
 * through @danielsimonjr/mathts-parallel's ComputePool.
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

// Special functions (erf, beta, bessel, etc.)
export * from './special.js';
export { typedSpecial } from './special.js';

// Probability distribution functions
export * from './distributions.js';
export { typedDistributions } from './distributions.js';

// Geometry functions (pure math)
export * from './geometry.js';


// Numerical integration functions (plain exports - callback arguments)
export * from './integration.js';

// Interpolation functions (plain exports - return functions)
export * from './interpolation.js';

// Extended combinatorics functions (mathTyped dispatch)
export * from './combinatorics.js';

// =============================================================================
// Combined Exports
// =============================================================================

import { typedArithmetic } from './arithmetic.js';
import { typedTrigonometry } from './trigonometry.js';
import { typedStatistics } from './statistics.js';
import { typedSignal } from './signal.js';
import { fibonacci, lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial } from './combinatorics.js';
import { typedSpecial } from './special.js';
import { typedDistributions } from './distributions.js';

/**
 * All typed functions combined (parallel-first)
 *
 * This includes all arithmetic, trigonometric, statistics, signal
 * processing, special, and probability distribution functions.
 */
export const typedFunctions = {
  ...typedArithmetic,
  ...typedTrigonometry,
  ...typedStatistics,
  ...typedSignal,
  fibonacci,
  lucas,
  doubleFactorial,
  risingFactorial,
  fallingFactorial,
  subfactorial,
  ...typedSpecial,
  ...typedDistributions,
};
