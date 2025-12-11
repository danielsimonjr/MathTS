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

export type { TypedInstance, TypeDef, ConversionDef } from './typed/index.js';

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
// Version
// =============================================================================

export const VERSION = '0.1.0';
