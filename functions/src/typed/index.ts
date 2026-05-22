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

// Algebra functions (polynomial, expression manipulation)
export * from './algebra.js';
export { typedAlgebra } from './algebra.js';

// Numerical integration functions (plain exports - callback arguments)
export * from './integration.js';

// Interpolation functions (plain exports - return functions)
export * from './interpolation.js';

// Numerical methods (root finding, optimization, ODE, curve fitting, etc.)
export * from './numeric.js';

// Extended combinatorics functions (mathTyped dispatch)
export * from './combinatorics.js';

// Graph theory functions (pure exports)
export * from './graph.js';

// Distribution objects (factory functions returning Distribution objects)
export * from './dist-objects.js';

// Statistical hypothesis tests
export * from './hypothesis.js';

// CAS (Computer Algebra System) functions are re-exported from the package
// entry point (`functions/src/index.ts`), not here: `cas.ts` imports the
// expression evaluator from `factories/evaluate.ts`, which imports this barrel.
// Routing the cas re-export through the entry point keeps the module graph
// acyclic.

// Matrix operations (characteristic polynomial, RREF, Cholesky, etc.)
export * from './matrix-ops.js';

// WebGPU-accelerated matrix operations (gpuMatmul, gpuAdd, gpuTranspose, gpuScale)
export * from './gpu.js';

// =============================================================================
// Combined Exports
// =============================================================================

import { typedArithmetic } from './arithmetic.js';
import { typedTrigonometry } from './trigonometry.js';
import { typedStatistics } from './statistics.js';
import { typedSignal } from './signal.js';
import {
  fibonacci, lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial,
  prime, nextPrime, primePi, primeFactors, divisors, eulerPhi, divisorSigma,
  carmichaelLambda, moebiusMu, jacobiSymbol, chineseRemainder, lucasL,
  partitions, harmonicNumber, integerDigits,
} from './combinatorics.js';
import { typedSpecial } from './special.js';
import { typedDistributions } from './distributions.js';
import { typedAlgebra } from './algebra.js';

/**
 * All typed functions combined (parallel-first)
 *
 * This includes all arithmetic, trigonometric, statistics, signal
 * processing, special, probability distribution, combinatorics,
 * graph theory, distribution objects, hypothesis test, and algebra functions.
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
  prime,
  nextPrime,
  primePi,
  primeFactors,
  divisors,
  eulerPhi,
  divisorSigma,
  carmichaelLambda,
  moebiusMu,
  jacobiSymbol,
  chineseRemainder,
  lucasL,
  partitions,
  harmonicNumber,
  integerDigits,
  ...typedSpecial,
  ...typedDistributions,
  ...typedAlgebra,
};
