/**
 * @mathts/core - Core types and utilities for MathTS
 * @packageDocumentation
 */

// Type definitions
export type { MathTSConfig, BackendType, NumericType } from './types.js';

// Configuration
export { createConfig, defaultConfig } from './config.js';

// Utilities
export { isNumeric, isComplex, isMatrix } from './utils.js';

// typed-function integration
export {
  mathTyped,
  createMathTSTyped,
  typed,
  create,
  MATHTS_TYPES,
  MATHTS_CONVERSIONS,
  isNumber,
  isBoolean,
  isString,
  isBigInt,
  isArray,
  isFunction,
  isObject,
  isNull,
  isUndefined,
  isDenseMatrix,
  isSparseMatrix,
  isFraction,
  isBigNumber,
  isUnit,
} from './typed/index.js';

export type { TypedInstance, TypeDef, ConversionDef } from './typed/index.js';

// Factory pattern
export {
  FunctionRegistry,
  createFactory,
  createTypedFunction,
  registry,
  math,
  DEFAULT_CONFIG,
} from './factory/index.js';

export type {
  MathTSConfig as FactoryMathTSConfig,
  FactoryFunction,
  FactoryDependencies,
  FactoryImport,
} from './factory/index.js';

// Version
export const VERSION = '0.1.0';
