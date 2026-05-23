/**
 * typed-function integration exports
 */

export {
  // typed-function instance and factory
  mathTyped,
  createMathTSTyped,
  typed,
  create,
  createTypedFunction,
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

  // TypedArray test functions (for parallel-first operations)
  isFloat64Array,
  isFloat32Array,
  isInt32Array,
  isUint32Array,
  isUint8Array,

  // Matrix type test functions (duck typing until Matrix class is implemented)
  isMatrix,
  isDenseMatrix,
  isSparseMatrix,

  // Unit type test function
  isUnit,

  // WASM support
  initTypedWasm,
  isTypedWasmAvailable,
} from './mathts-typed.js';

export type {
  TypedFunction,
  TypedInstance,
  TypeDef,
  ConversionDef,
  SignatureFunction,
  ReferTo,
  ReferToSelf,
} from './mathts-typed.js';

export { registerNativeTypes } from './type-bridge.js';
