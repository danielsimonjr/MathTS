/**
 * @danielsimonjr/mathts-core - Core types and utilities for MathTS
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

// Dual numbers (forward-mode automatic differentiation)
export { Dual, isDual } from './types/dual.js';
// Shared elementary-function derivative table (used by Dual + autograd's DualTensor)
export { DUAL_UNARY_RULES } from './types/dual-rules.js';
export type { DualUnaryRule, DualUnaryRuleName } from './types/dual-rules.js';

// Named mathematical constants (plain numbers): PI, E, TAU, PHI, SQRT2, …
export { PI, E, TAU, PHI, SQRT2, SQRT1_2, LN2, LN10, LOG2E, LOG10E } from './constants.js';

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

// Polymorphic scalar arithmetic (over number | bigint | Complex | Fraction | BigNumber)
export {
  addScalar,
  subtractScalar,
  multiplyScalar,
  divideScalar,
  pow,
  abs,
  fix,
  round,
  equal,
  isNumeric,
  number,
} from './arithmetic/scalar.js';
export type { NumericScalar } from './arithmetic/scalar.js';

// Units (dimensional analysis)
export {
  Unit,
  isUnit as isUnitValue,
  DimensionMismatchError,
  UnitParseError,
  DIMENSIONLESS,
  dim,
} from './types/unit.js';
export type { Dimensions, UnitDef, UnitInstance } from './types/unit.js';
export {
  BASE_UNITS,
  DERIVED_UNITS,
  ALL_UNITS,
  UNIT_ALIASES,
  getUnitDef,
} from './types/unit-definitions.js';
export { SI_PREFIXES, BEST_PREFIXES, getPrefix } from './types/unit-prefixes.js';

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

  // WASM support for typed-function
  initTypedWasm,
  isTypedWasmAvailable,

  // Type compatibility bridge for mathjs duck-typing
  registerNativeTypes,
} from './typed/index.js';

export type {
  TypedFunction,
  TypedInstance,
  TypeDef,
  ConversionDef,
  SignatureFunction,
  ReferTo,
  ReferToSelf,
} from './typed/index.js';

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
