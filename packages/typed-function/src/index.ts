/**
 * @mathts/typed-function
 *
 * Utility helpers for typed-function integration in MathTS.
 * This package provides type test functions and signature utilities.
 *
 * NOTE: For creating typed functions, use typed-function directly:
 * ```typescript
 * import typed, { create } from 'typed-function';
 * ```
 *
 * Or use @mathts/core which provides mathTyped pre-configured with MathTS types:
 * ```typescript
 * import { mathTyped } from '@mathts/core';
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Re-export typed-function for convenience
// =============================================================================

export { default as typed, create } from 'typed-function';
export type { TypedFunction } from 'typed-function';

// =============================================================================
// Type Definition Interfaces
// =============================================================================

/**
 * Type definition for typed-function
 */
export interface TypeDef {
  name: string;
  test: (x: unknown) => boolean;
}

/**
 * Conversion definition for typed-function
 */
export interface ConversionDef {
  from: string;
  to: string;
  convert: (value: unknown) => unknown;
}

/**
 * Signature map for typed functions
 */
export type SignatureMap<T = unknown> = {
  [signature: string]: (...args: unknown[]) => T;
};

/**
 * Type test function
 */
export type TypeTest<T> = (x: unknown) => x is T;

/**
 * Type conversion function
 */
export type TypeConverter<From, To> = (value: From) => To;

// =============================================================================
// Primitive Type Tests
// =============================================================================

export const isNumber = (x: unknown): x is number =>
  typeof x === 'number';

export const isBoolean = (x: unknown): x is boolean =>
  typeof x === 'boolean';

export const isString = (x: unknown): x is string =>
  typeof x === 'string';

export const isBigInt = (x: unknown): x is bigint =>
  typeof x === 'bigint';

export const isArray = (x: unknown): x is unknown[] =>
  Array.isArray(x);

export const isFunction = (x: unknown): x is (...args: unknown[]) => unknown =>
  typeof x === 'function';

export const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const isNull = (x: unknown): x is null =>
  x === null;

export const isUndefined = (x: unknown): x is undefined =>
  x === undefined;

export const isNullOrUndefined = (x: unknown): x is null | undefined =>
  x === null || x === undefined;

// =============================================================================
// Numeric Type Tests
// =============================================================================

export const isFiniteNumber = (x: unknown): x is number =>
  typeof x === 'number' && isFinite(x);

export const isInteger = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x);

export const isPositiveInteger = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x > 0;

export const isNonNegativeInteger = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0;

export const isNaN = (x: unknown): x is number =>
  typeof x === 'number' && Number.isNaN(x);

// =============================================================================
// Collection Type Tests
// =============================================================================

export const isTypedArray = (x: unknown): x is ArrayBufferView =>
  ArrayBuffer.isView(x) && !(x instanceof DataView);

export const isFloat64Array = (x: unknown): x is Float64Array =>
  x instanceof Float64Array;

export const isFloat32Array = (x: unknown): x is Float32Array =>
  x instanceof Float32Array;

export const isInt32Array = (x: unknown): x is Int32Array =>
  x instanceof Int32Array;

export const isUint32Array = (x: unknown): x is Uint32Array =>
  x instanceof Uint32Array;

export const isArrayBuffer = (x: unknown): x is ArrayBuffer =>
  x instanceof ArrayBuffer;

// =============================================================================
// Signature Utilities
// =============================================================================

/**
 * Parse a signature string into component types
 *
 * @param signature - Signature string (e.g., "number, number")
 * @returns Array of type names
 */
export function parseSignature(signature: string): string[] {
  return signature
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Build a signature string from type names
 *
 * @param types - Array of type names
 * @returns Signature string
 */
export function buildSignature(...types: string[]): string {
  return types.join(', ');
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when no matching signature is found
 */
export class NoMatchingSignatureError extends Error {
  constructor(
    public readonly functionName: string,
    public readonly actualTypes: string[],
    public readonly availableSignatures: string[]
  ) {
    super(
      `No matching signature found for ${functionName}(${actualTypes.join(', ')}). ` +
      `Available signatures: ${availableSignatures.join('; ')}`
    );
    this.name = 'NoMatchingSignatureError';
  }
}

/**
 * Error thrown when type conversion fails
 */
export class TypeConversionError extends Error {
  constructor(
    public readonly fromType: string,
    public readonly toType: string,
    public readonly originalError?: Error
  ) {
    super(
      `Cannot convert from ${fromType} to ${toType}` +
      (originalError ? `: ${originalError.message}` : '')
    );
    this.name = 'TypeConversionError';
  }
}
