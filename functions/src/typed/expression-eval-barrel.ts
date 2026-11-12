/**
 * Typed surface for `factories/evaluate.ts` and the `@danielsimonjr/mathts-functions/evaluate`
 * subpath — same symbols as `typed/index.ts` but without the WebGPU opt-in graph
 * (`@danielsimonjr/mathts-gpu`, `gpu.js`, fused GPU dispatch).
 *
 * @packageDocumentation
 */

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

// Bitwise functions (Int32Array elementwise via ComputePool)
export * from './bitwise.js';
export { typedBitwise } from './bitwise.js';

// Logical functions (and / or / xor / not / nullish across all numeric types)
export * from './logical.js';
export { typedLogical } from './logical.js';

// Complex helper functions (arg / conj / im / re across numeric + Complex types)
export * from './complex.js';
export { typedComplex } from './complex.js';

// Set functions
export * from './set.js';
export { typedSet } from './set.js';

// Special functions (erf, beta, bessel, etc.)
export * from './special.js';
export * from './fused.js';
export { typedSpecial } from './special.js';

// Probability distribution functions
export * from './distributions.js';
export { typedDistributions } from './distributions.js';
export { workerKernel } from './worker-kernels.js';

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

// Matrix operations (characteristic polynomial, RREF, Cholesky, etc.)
export * from './matrix-ops.js';

// Relational functions (deepEqual, unequal, compareNatural, compareText,
//                       compareUnits, equalScalar, equalText)
export * from './relational.js';
export { typedRelational } from './relational.js';

// String formatting functions (bin, hex, oct, format, print)
export * from './string.js';
export { typedString } from './string.js';

// Probability & combinatorics functions
export * from './probability.js';
export { typedProbability } from './probability.js';

// Unit dimensional-analysis functions (to, toBest)
export * from './unit.js';
export { typedUnit } from './unit.js';
