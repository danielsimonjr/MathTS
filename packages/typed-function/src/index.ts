/**
 * @danielsimonjr/mathts-typed-function
 *
 * Utility helpers for typed-function integration in MathTS.
 * This package provides type test functions and signature utilities.
 *
 * NOTE: For creating typed functions, use typed-function directly:
 * ```typescript
 * import typed, { create } from 'typed-function';
 * ```
 *
 * Or use @danielsimonjr/mathts-core which provides mathTyped pre-configured with MathTS types:
 * ```typescript
 * import { mathTyped } from '@danielsimonjr/mathts-core';
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
// Symbol-based Type Identification (Issue 1)
// =============================================================================

/**
 * Global symbol for type identification that survives minification,
 * compilation, and cross-module boundaries.
 *
 * Classes should set this symbol on their instances:
 * ```typescript
 * class DenseMatrix {
 *   [TYPED_FUNCTION_TYPE] = 'DenseMatrix';
 * }
 * ```
 */
export const TYPED_FUNCTION_TYPE = Symbol.for('typed-function:type');

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
 * Extended type definition with optional factory for safe conversions (Issue 2)
 */
export interface ExtendedTypeDef extends TypeDef {
  /** Optional factory function used for conversions instead of calling the constructor directly */
  factory?: (...args: unknown[]) => unknown;
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
// Symbol-based Type Test Factory (Issue 1)
// =============================================================================

/**
 * Create a type test that checks the TYPED_FUNCTION_TYPE symbol.
 * This is the most resilient approach -- symbols survive minification,
 * bundler compilation, and cross-realm boundaries.
 *
 * @param typeName - The expected type name (e.g., 'DenseMatrix')
 * @returns A type test function
 *
 * @example
 * ```typescript
 * const isDenseMatrix = createSymbolTypeTest('DenseMatrix');
 * // Works after esbuild/webpack compilation
 * isDenseMatrix(new DenseMatrix()); // true
 * ```
 */
export function createSymbolTypeTest(typeName: string): (x: unknown) => boolean {
  return (x: unknown): boolean =>
    x !== null &&
    x !== undefined &&
    typeof x === 'object' &&
    (x as Record<symbol, unknown>)[TYPED_FUNCTION_TYPE] === typeName;
}

// =============================================================================
// Robust Type Test Factory (Issue 5 - Prototype Chain Breakage)
// =============================================================================

/**
 * Create a robust type test that uses multiple strategies in order:
 * 1. Symbol-based check (most reliable, survives all compilation)
 * 2. Instance property check (e.g., `x.isMatrix === true`)
 * 3. Prototype chain check (legacy fallback, `x.constructor.prototype.isX`)
 *
 * This layered approach ensures type detection works regardless of how
 * the code was compiled or bundled.
 *
 * @param typeName - The type name to check for via symbol
 * @param instanceProp - Instance property name to check (e.g., 'isMatrix')
 * @param protoProp - Optional prototype property to check as fallback.
 *                     Defaults to instanceProp if not specified.
 * @returns A type test function
 *
 * @example
 * ```typescript
 * const isMatrix = createRobustTypeTest('Matrix', 'isMatrix');
 * // Works with symbol: class Matrix { [TYPED_FUNCTION_TYPE] = 'Matrix' }
 * // Works with instance prop: class Matrix { isMatrix = true }
 * // Works with prototype: Matrix.prototype.isMatrix = true
 * ```
 */
export function createRobustTypeTest(
  typeName: string,
  instanceProp: string,
  protoProp?: string
): (x: unknown) => boolean {
  const proto = protoProp ?? instanceProp;
  return (x: unknown): boolean => {
    if (x === null || x === undefined || typeof x !== 'object') {
      return false;
    }
    const obj = x as Record<string | symbol, unknown>;

    // Strategy 1: Symbol-based (most reliable)
    if (obj[TYPED_FUNCTION_TYPE] === typeName) {
      return true;
    }

    // Strategy 2: Instance property check (works after minification)
    if (obj[instanceProp] === true) {
      return true;
    }

    // Strategy 3: Prototype chain check (legacy fallback)
    try {
      const ctor = obj.constructor as { prototype?: Record<string, unknown> } | undefined;
      if (ctor && typeof ctor.prototype === 'object' && ctor.prototype !== null) {
        return ctor.prototype[proto] === true;
      }
    } catch {
      // constructor access can throw in edge cases (e.g., Object.create(null))
    }

    return false;
  };
}

/**
 * Create a type test that combines a specific subtype check with a parent type check.
 * Uses the same layered strategy as createRobustTypeTest.
 *
 * For example, DenseMatrix is identified by its own `isDenseMatrix` property
 * AND is also a Matrix (has `isMatrix`).
 *
 * @param typeName - Symbol type name (e.g., 'DenseMatrix')
 * @param instanceProp - Instance property (e.g., 'isDenseMatrix')
 * @param parentProp - Parent type property (e.g., 'isMatrix')
 * @returns A type test function
 */
export function createRobustSubtypeTest(
  typeName: string,
  instanceProp: string,
  parentProp: string
): (x: unknown) => boolean {
  const subtypeTest = createRobustTypeTest(typeName, instanceProp);
  const parentTest = createRobustTypeTest(typeName, parentProp);
  return (x: unknown): boolean => subtypeTest(x) || (
    // Check instance prop + parent via any strategy
    x !== null && x !== undefined && typeof x === 'object' &&
    (x as Record<string, unknown>)[instanceProp] === true &&
    parentTest(x)
  );
}

// =============================================================================
// Safe Conversion Factory (Issue 2 - Explicit `new` in Conversions)
// =============================================================================

/**
 * Create a safe conversion function that properly handles class constructors.
 * In strict mode (and after esbuild compilation), ES6 classes MUST be called
 * with `new`. This wrapper detects whether a function is a class constructor
 * and uses `new` accordingly.
 *
 * @param TargetClass - The class or constructor function to wrap
 * @param transform - Optional transform to apply to the input before construction.
 *                    If not provided, the value is passed directly.
 * @returns A conversion function safe for use in typed-function conversions
 *
 * @example
 * ```typescript
 * // Instead of: convert: (x) => Complex(x, 0)  // FAILS with compiled classes
 * // Use:
 * const toComplex = createSafeConversion(Complex, (x) => [x, 0]);
 * typed.addConversion({ from: 'number', to: 'Complex', convert: toComplex });
 * ```
 */
export function createSafeConversion<T>(
  TargetClass: new (...args: unknown[]) => T,
  transform?: (value: unknown) => unknown[]
): (value: unknown) => T {
  return (value: unknown): T => {
    const args = transform ? transform(value) : [value];
    return new TargetClass(...args);
  };
}

/**
 * Create a ConversionDef with safe constructor invocation.
 *
 * @param from - Source type name
 * @param to - Target type name
 * @param TargetClass - The class constructor
 * @param transform - Optional transform for constructor arguments
 * @returns A ConversionDef safe for typed-function
 */
export function createSafeConversionDef<T>(
  from: string,
  to: string,
  TargetClass: new (...args: unknown[]) => T,
  transform?: (value: unknown) => unknown[]
): ConversionDef {
  return {
    from,
    to,
    convert: createSafeConversion(TargetClass, transform),
  };
}

// =============================================================================
// Type Registration Utilities
// =============================================================================

/**
 * Create a TypeDef that uses symbol-based identification.
 * Convenience wrapper that combines createSymbolTypeTest with TypeDef creation.
 *
 * @param name - The type name (must match the symbol value set on instances)
 * @returns A TypeDef for use with typed.addType()
 */
export function createSymbolTypeDef(name: string): TypeDef {
  return {
    name,
    test: createSymbolTypeTest(name),
  };
}

/**
 * Create a TypeDef that uses robust multi-strategy identification.
 * Combines symbol, instance property, and prototype chain checks.
 *
 * @param name - The type name
 * @param instanceProp - Instance property to check (e.g., 'isMatrix')
 * @param protoProp - Optional prototype property (defaults to instanceProp)
 * @returns A TypeDef for use with typed.addType()
 */
export function createRobustTypeDef(
  name: string,
  instanceProp: string,
  protoProp?: string
): TypeDef {
  return {
    name,
    test: createRobustTypeTest(name, instanceProp, protoProp),
  };
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
