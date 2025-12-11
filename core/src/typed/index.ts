/**
 * typed-function integration exports
 */

export {
  mathTyped,
  createMathTSTyped,
  typed,
  create,
  MATHTS_TYPES,
  MATHTS_CONVERSIONS,
  // Type test functions
  isNumber,
  isBoolean,
  isString,
  isBigInt,
  isArray,
  isFunction,
  isObject,
  isNull,
  isUndefined,
  isComplex,
  isMatrix,
  isDenseMatrix,
  isSparseMatrix,
  isFraction,
  isBigNumber,
  isUnit,
} from './mathts-typed.js';

export type { TypedInstance, TypeDef, ConversionDef } from './mathts-typed.js';
