/**
 * Parallel Operations
 *
 * High-level parallel operations for matrix and array computations.
 *
 * @packageDocumentation
 */

// Matrix operations
export {
  parallelMatmul,
  parallelMatvec,
  parallelTranspose,
  parallelOuter,
  parallelDot,
  type MatmulOptions,
} from './matmul.js';

// Element-wise operations
export {
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
  type ElementwiseOptions,
} from './elementwise.js';

// Reduction operations
export {
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
  type ReduceOptions,
} from './reduce.js';

// Map and transform operations
export {
  parallelMap,
  parallelFilter,
  parallelFind,
  parallelSort,
  parallelForEach,
  parallelSome,
  parallelEvery,
  parallelCount,
  type MapOptions,
} from './map.js';
