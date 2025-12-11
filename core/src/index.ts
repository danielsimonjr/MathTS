/**
 * @mathts/core - Core types and utilities for MathTS
 * @packageDocumentation
 */

// =============================================================================
// Core Type System
// =============================================================================

// Interfaces
export type {
  MathTSValue,
  Scalar,
  BackendType,
  NumericType,
  MatrixBackend,
  IMatrix,
  IComplex,
  IFraction,
  IBigNumber,
  MatrixDimensions,
} from './types/interfaces.js';

// Complex numbers
export {
  Complex,
  isComplex,
  I,
  COMPLEX_ZERO,
  COMPLEX_ONE,
  COMPLEX_NEG_ONE,
} from './types/complex.js';

// Fractions (exact rationals)
export {
  Fraction,
  isFraction,
  FRACTION_ZERO,
  FRACTION_ONE,
  FRACTION_NEG_ONE,
  FRACTION_HALF,
  FRACTION_THIRD,
  FRACTION_QUARTER,
} from './types/fraction.js';

// BigNumber (arbitrary precision decimals)
export {
  BigNumber,
  isBigNumber,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_NEG_ONE,
  BIGNUMBER_TEN,
  BIGNUMBER_PI,
  BIGNUMBER_E,
  BIGNUMBER_LN2,
  BIGNUMBER_LN10,
} from './types/bignumber.js';
export type { BigNumberConfig, RoundingMode } from './types/bignumber.js';

// =============================================================================
// typed-function integration
// =============================================================================

export {
  // typed-function instance and factory
  mathTyped,
  createMathTSTyped,
  typed,
  create,
  createTypedFunction,
  TypeRegistry,

  // Type definitions and conversions for runtime dispatch
  MATHTS_TYPES,
  MATHTS_CONVERSIONS,

  // Primitive type test functions
  isNumber,
  isBoolean,
  isString,
  isBigInt,
  isArray,
  isFunction,
  isObject,
  isNull,
  isUndefined,

  // Matrix type test functions (duck typing until Matrix class)
  isMatrix,
  isDenseMatrix,
  isSparseMatrix,

  // Unit type test function
  isUnit,
} from './typed/index.js';

export type { TypedFunction, TypedInstance, TypeDef, ConversionDef, SignatureFunction, ReferTo, ReferToSelf } from './typed/index.js';

// =============================================================================
// Factory pattern
// =============================================================================

export {
  FunctionRegistry,
  createFactory,
  registry,
  math,
  DEFAULT_CONFIG,
} from './factory/index.js';

export type {
  MathTSConfig,
  FactoryFunction,
  FactoryDependencies,
  FactoryImport,
} from './factory/index.js';

// =============================================================================
// Parallel processing (parallel-first approach)
// =============================================================================

export {
  // Configuration
  DEFAULT_PARALLEL_CONFIG,
  getParallelConfig,
  setParallelConfig,
  resetParallelConfig,

  // Core utilities
  getCpuCount,
  shouldParallelize,
  chunkArray,
  chunkFloat64Array,

  // Parallel array operations
  parallelMap,
  parallelReduce,
  parallelFilter,
  parallelFind,
  parallelEvery,
  parallelSome,

  // Parallel numeric operations
  parallelSum,
  parallelProduct,
  parallelMinMax,
  parallelMean,
  parallelVariance,
  parallelStdDev,

  // Execution utilities
  parallelAll,
  parallelLimit,
  parallelRace,
  parallelBatch,

  // Iterators
  parallelIterator,
  asyncParallelIterator,
} from './parallel/index.js';

export type {
  ParallelConfig,
  ParallelResult,
  ParallelOptions,
} from './parallel/index.js';

// Batch numeric type operations
export {
  // Complex batch operations
  batchComplexAdd,
  batchComplexSubtract,
  batchComplexMultiply,
  batchComplexDivide,
  batchComplexSum,
  batchComplexMap,

  // Fraction batch operations
  batchFractionAdd,
  batchFractionMultiply,
  batchFractionSum,

  // BigNumber batch operations
  batchBigNumberAdd,
  batchBigNumberMultiply,
  batchBigNumberSum,

  // Generic batch operations
  batchBinaryOp,
  batchReduce,
} from './parallel/numeric-batch.js';

// =============================================================================
// Version
// =============================================================================

export const VERSION = '0.1.0';
