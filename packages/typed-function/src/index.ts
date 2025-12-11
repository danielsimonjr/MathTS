/**
 * @mathts/typed-function
 *
 * Type dispatch system for MathTS with runtime polymorphism.
 * Wraps the typed-function library with MathTS-specific types and conversions.
 *
 * @packageDocumentation
 */

import typed, {
  create,
  type TypedInstance,
  type TypeDef,
  type ConversionDef,
} from 'typed-function';

// =============================================================================
// Type Definition Interfaces
// =============================================================================

/**
 * Signature map for typed functions
 */
export type SignatureMap<T = unknown> = {
  [signature: string]: (...args: unknown[]) => T;
};

/**
 * Configuration for creating typed instances
 */
export interface TypedConfig {
  /** Custom types to register */
  types?: TypeDef[];
  /** Custom conversions to register */
  conversions?: ConversionDef[];
  /** Insert types before this type (default: 'any') */
  insertBefore?: string;
}

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
// Base Type Definitions
// =============================================================================

/**
 * Base types that are always available in typed-function
 */
export const BASE_TYPES: TypeDef[] = [
  { name: 'bigint', test: isBigInt },
  { name: 'Float64Array', test: isFloat64Array },
  { name: 'Float32Array', test: isFloat32Array },
  { name: 'Int32Array', test: isInt32Array },
  { name: 'Uint32Array', test: isUint32Array },
  { name: 'ArrayBuffer', test: isArrayBuffer },
];

/**
 * Base conversions between primitive types
 */
export const BASE_CONVERSIONS: ConversionDef[] = [
  // boolean -> number
  {
    from: 'boolean',
    to: 'number',
    convert: (b: unknown) => (b ? 1 : 0),
  },
  // string -> number (with validation)
  {
    from: 'string',
    to: 'number',
    convert: (s: unknown) => {
      const n = parseFloat(s as string);
      if (Number.isNaN(n)) throw new Error(`Cannot convert "${s}" to number`);
      return n;
    },
  },
  // bigint -> number
  {
    from: 'bigint',
    to: 'number',
    convert: (n: unknown) => Number(n as bigint),
  },
  // number -> bigint
  {
    from: 'number',
    to: 'bigint',
    convert: (n: unknown) => BigInt(Math.trunc(n as number)),
  },
  // string -> bigint
  {
    from: 'string',
    to: 'bigint',
    convert: (s: unknown) => BigInt(s as string),
  },
];

// =============================================================================
// Typed Instance Factory
// =============================================================================

/**
 * Create a new typed-function instance with optional configuration
 *
 * @param config - Configuration for types and conversions
 * @returns A configured typed-function instance
 *
 * @example
 * ```typescript
 * const myTyped = createTyped({
 *   types: [{ name: 'MyType', test: isMyType }],
 *   conversions: [{ from: 'number', to: 'MyType', convert: createMyType }],
 * });
 *
 * const add = myTyped('add', {
 *   'number, number': (a, b) => a + b,
 *   'MyType, MyType': (a, b) => a.add(b),
 * });
 * ```
 */
export function createTyped(config: TypedConfig = {}): TypedInstance {
  const instance = create();

  // Add base types first
  instance.addTypes(BASE_TYPES, config.insertBefore ?? 'any');

  // Add custom types if provided
  if (config.types && config.types.length > 0) {
    instance.addTypes(config.types, config.insertBefore ?? 'any');
  }

  // Add base conversions
  instance.addConversions(BASE_CONVERSIONS);

  // Add custom conversions if provided
  if (config.conversions && config.conversions.length > 0) {
    instance.addConversions(config.conversions);
  }

  return instance;
}

/**
 * Default typed instance with base types and conversions
 */
export const baseTyped = createTyped();

// =============================================================================
// Type Registry
// =============================================================================

/**
 * Registry for managing custom types and conversions
 */
export class TypeRegistry {
  private types: Map<string, TypeDef> = new Map();
  private conversions: Map<string, ConversionDef> = new Map();
  private instance: TypedInstance | null = null;

  /**
   * Register a new type
   *
   * @param name - Type name
   * @param test - Type test function
   */
  registerType<T>(name: string, test: TypeTest<T>): this {
    this.types.set(name, { name, test: test as (x: unknown) => boolean });
    this.instance = null; // Invalidate cached instance
    return this;
  }

  /**
   * Register a type conversion
   *
   * @param from - Source type name
   * @param to - Target type name
   * @param convert - Conversion function
   */
  registerConversion<From, To>(
    from: string,
    to: string,
    convert: TypeConverter<From, To>
  ): this {
    const key = `${from}->${to}`;
    this.conversions.set(key, {
      from,
      to,
      convert: convert as (value: unknown) => unknown,
    });
    this.instance = null; // Invalidate cached instance
    return this;
  }

  /**
   * Check if a type is registered
   */
  hasType(name: string): boolean {
    return this.types.has(name);
  }

  /**
   * Check if a conversion is registered
   */
  hasConversion(from: string, to: string): boolean {
    return this.conversions.has(`${from}->${to}`);
  }

  /**
   * Get all registered type names
   */
  getTypeNames(): string[] {
    return Array.from(this.types.keys());
  }

  /**
   * Build a typed-function instance from the registry
   */
  build(): TypedInstance {
    if (!this.instance) {
      this.instance = createTyped({
        types: Array.from(this.types.values()),
        conversions: Array.from(this.conversions.values()),
      });
    }
    return this.instance;
  }

  /**
   * Clear all registered types and conversions
   */
  clear(): void {
    this.types.clear();
    this.conversions.clear();
    this.instance = null;
  }
}

// =============================================================================
// Typed Function Helpers
// =============================================================================

/**
 * Create a typed function with automatic argument spreading
 *
 * @param name - Function name
 * @param signatures - Signature map
 * @param typedInstance - Typed instance to use (default: baseTyped)
 *
 * @example
 * ```typescript
 * const multiply = createTypedFunction('multiply', {
 *   'number, number': (a, b) => a * b,
 *   'Array, number': (arr, n) => arr.map(x => x * n),
 * });
 * ```
 */
export function createTypedFunction<T>(
  name: string,
  signatures: SignatureMap<T>,
  typedInstance: TypedInstance = baseTyped
): (...args: unknown[]) => T {
  return typedInstance(name, signatures);
}

/**
 * Extend an existing typed function with new signatures
 *
 * @param fn - Existing typed function
 * @param signatures - Additional signatures
 * @param typedInstance - Typed instance to use (default: baseTyped)
 */
export function extendTypedFunction<T>(
  fn: (...args: unknown[]) => T,
  signatures: SignatureMap<T>,
  typedInstance: TypedInstance = baseTyped
): (...args: unknown[]) => T {
  // Get the original function name from the typed function
  const name = (fn as unknown as { name?: string }).name ?? 'anonymous';

  // Create extended signatures object by merging
  const extendedSignatures = { ...signatures };

  // Use the typed instance to create a new function that includes both
  return typedInstance(name, {
    ...extendedSignatures,
    // Reference the original function for unknown signatures
    '...any': (...args: unknown[]) => fn(...args),
  });
}

/**
 * Compose multiple typed functions into a pipeline
 *
 * @param fns - Functions to compose (executed left to right)
 */
export function pipeTyped<T>(
  ...fns: Array<(arg: unknown) => unknown>
): (input: unknown) => T {
  return (input: unknown) =>
    fns.reduce((acc, fn) => fn(acc), input) as T;
}

/**
 * Compose multiple typed functions (executed right to left)
 *
 * @param fns - Functions to compose
 */
export function composeTyped<T>(
  ...fns: Array<(arg: unknown) => unknown>
): (input: unknown) => T {
  return pipeTyped<T>(...fns.reverse());
}

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

/**
 * Check if a value matches a type name
 *
 * @param value - Value to check
 * @param typeName - Type name to match
 * @param typedInstance - Typed instance with type definitions
 */
export function matchesType(
  value: unknown,
  typeName: string,
  typedInstance: TypedInstance = baseTyped
): boolean {
  try {
    // Try to find the type test in the typed instance
    const testFn = typedInstance.find(null as unknown as (x: unknown) => unknown, [typeName]);
    return testFn !== undefined;
  } catch {
    // Fallback to basic type checking
    switch (typeName) {
      case 'number':
        return typeof value === 'number';
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'bigint':
        return typeof value === 'bigint';
      case 'Array':
        return Array.isArray(value);
      case 'Object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'any':
        return true;
      default:
        return false;
    }
  }
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

// =============================================================================
// Re-exports from typed-function
// =============================================================================

export { typed, create };
export type { TypedInstance, TypeDef, ConversionDef };
