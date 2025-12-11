/**
 * typed-function integration exports
 */

export {
  // typed-function instance and factory
  mathTyped,
  createMathTSTyped,
  typed,
  create,
  createTyped,
  TypeRegistry,

  // Type definitions and conversions
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

  // MathTS type test functions (re-exported from types for convenience)
  isComplex,
  isFraction,
  isBigNumber,

  // Matrix type test functions (duck typing until Matrix class is implemented)
  isMatrix,
  isDenseMatrix,
  isSparseMatrix,

  // Unit type test function
  isUnit,
} from './mathts-typed.js';

export type { TypedInstance, TypeDef, ConversionDef } from './mathts-typed.js';
