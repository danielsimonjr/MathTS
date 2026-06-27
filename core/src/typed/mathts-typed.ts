/**
 * MathTS typed-function Integration
 *
 * Creates a configured typed-function instance with MathTS types
 * for runtime type dispatch across numeric types, matrices, and more.
 *
 * This module directly uses the typed-function library API without
 * any intermediate abstraction layers.
 *
 * Supports WASM-accelerated dispatch when available.
 *
 * @packageDocumentation
 */

import typed, { create } from 'typed-function';
import type {
  TypedFunction,
  TypedInstance,
  SignatureFunction,
  ReferTo,
  ReferToSelf,
} from 'typed-function';

// WASM initialization state
let wasmInitialized = false;
let wasmAvailable = false;

/**
 * Initialize WASM dispatch for typed-function (optional, improves performance)
 *
 * Uses the unified typed.init() API to enable WASM-accelerated dispatch
 * with automatic fallback to pure JS when WASM is unavailable.
 *
 * @param options - Initialization options
 * @returns Promise resolving to true if WASM was initialized successfully
 */
export async function initTypedWasm(options: { preferWasm?: boolean } = {}): Promise<boolean> {
  if (wasmInitialized) return wasmAvailable;

  try {
    // Use typed-function's unified init API
    if (typeof typed.init === 'function') {
      await typed.init({ preferWasm: options.preferWasm ?? true });
      wasmAvailable = typed.isWasmEnabled?.() ?? false;
    }
  } catch {
    // WASM not available, fallback to pure JS
    wasmAvailable = false;
  }

  wasmInitialized = true;
  return wasmAvailable;
}

/**
 * Check if WASM dispatch is available
 */
export function isTypedWasmAvailable(): boolean {
  // Check typed-function's native method first, fall back to our tracked state
  return typed.isWasmEnabled?.() ?? wasmAvailable;
}

import { Complex, isComplex as _isComplex } from '../types/complex.js';
import { Fraction, isFraction as _isFraction } from '../types/fraction.js';
import { BigNumber, isBigNumber as _isBigNumber } from '../types/bignumber.js';

// =============================================================================
// Re-export typed-function types for convenience
// =============================================================================

export type { TypedFunction, TypedInstance, SignatureFunction, ReferTo, ReferToSelf };

/**
 * Any concrete implementation accepted when *declaring* a typed signature.
 *
 * typed-function's published `SignatureFunction` is `(...args: unknown[]) =>
 * unknown`, which is correct for *internal/output* positions (where the stored
 * impl is later CALLED with validated args) but wrong as an *input* type:
 * under `strictFunctionTypes`, function parameters are contravariant, so a
 * concrete impl such as `(a: number, b: number) => number` is NOT assignable
 * to an `unknown[]` parameter list (`unknown` is not assignable to `number`).
 * The correct top-type for "any function" in an input position uses `never`
 * parameters — every function is assignable to it because `never` is
 * assignable to every parameter type. This is exactly the set of values
 * typed-function genuinely accepts when declaring signatures.
 */
export type SignatureImpl = (...args: never[]) => unknown;

/** Signature record accepted by the MathTS typed factory (see {@link SignatureImpl}). */
export type SignatureRecord = Record<string, SignatureImpl | ReferTo | ReferToSelf>;

/**
 * The MathTS typed-function factory type.
 *
 * Structurally identical to typed-function's {@link TypedInstance} except its
 * call signatures accept implementations declared with concrete parameter
 * types (see {@link SignatureImpl}). All instance methods are inherited
 * unchanged via `Omit<TypedInstance, never>` (a mapped type, which drops the
 * overly-strict published call signatures while preserving every method).
 */
export interface MathTSTyped extends Omit<TypedInstance, never> {
  (name: string, signatures: SignatureRecord): TypedFunction;
  (signatures: SignatureRecord): TypedFunction;
  // Mirror of typed-function's variadic overload (compose/merge form), kept so
  // `MathTSTyped` remains assignable to `TypedInstance`.
  (
    ...args: Array<string | SignatureRecord | TypedFunction | (SignatureImpl & { signature: string })>
  ): TypedFunction;
}

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

// =============================================================================
// Primitive Type Test Functions
// =============================================================================

export const isNumber = (x: unknown): x is number => typeof x === 'number';

export const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';

export const isString = (x: unknown): x is string => typeof x === 'string';

export const isBigInt = (x: unknown): x is bigint => typeof x === 'bigint';

export const isArray = (x: unknown): x is unknown[] => Array.isArray(x);

export const isFunction = (x: unknown): x is (...args: unknown[]) => unknown =>
  typeof x === 'function';

export const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const isNull = (x: unknown): x is null => x === null;

export const isUndefined = (x: unknown): x is undefined => x === undefined;

// =============================================================================
// TypedArray Test Functions
// =============================================================================

export const isFloat64Array = (x: unknown): x is Float64Array => x instanceof Float64Array;

export const isFloat32Array = (x: unknown): x is Float32Array => x instanceof Float32Array;

export const isInt32Array = (x: unknown): x is Int32Array => x instanceof Int32Array;

export const isUint32Array = (x: unknown): x is Uint32Array => x instanceof Uint32Array;

export const isUint8Array = (x: unknown): x is Uint8Array => x instanceof Uint8Array;

// =============================================================================
// MathTS Type Test Functions (using actual class implementations)
// =============================================================================

/**
 * Check if value is a Complex number
 */
export const isComplex = (x: unknown): x is Complex => _isComplex(x);

/**
 * Check if value is a Fraction
 */
export const isFraction = (x: unknown): x is Fraction => _isFraction(x);

/**
 * Check if value is a BigNumber
 */
export const isBigNumber = (x: unknown): x is BigNumber => _isBigNumber(x);

/**
 * Check if value is a Matrix (duck typing until Matrix class is implemented)
 */
export const isMatrix = (x: unknown): boolean =>
  isObject(x) &&
  'rows' in x &&
  'cols' in x &&
  'get' in x &&
  typeof (x as { type?: string }).type === 'string';

/**
 * Check if value is a DenseMatrix
 */
export const isDenseMatrix = (x: unknown): boolean =>
  isMatrix(x) && (x as { type?: string }).type === 'DenseMatrix';

/**
 * Check if value is a SparseMatrix
 */
export const isSparseMatrix = (x: unknown): boolean =>
  isMatrix(x) && (x as { type?: string }).type === 'SparseMatrix';

/**
 * Check if value is a Unit
 *
 * Recognises both the native {@link Unit} class (which exposes `value`,
 * `dimensions`, and `notation`) and the legacy duck-typed shape used by
 * mathjs-compatibility shims (`{ value, unit, type }`).
 */
export const isUnit = (x: unknown): boolean => {
  if (!isObject(x)) return false;
  const o = x as { type?: string; value?: unknown; unit?: unknown; dimensions?: unknown };
  if (typeof o.type !== 'string') return false;
  // Native Unit class.
  if (o.type === 'Unit' && 'value' in o && 'dimensions' in o) return true;
  // Legacy duck-typing path.
  if ('value' in o && 'unit' in o) return true;
  return false;
};

// =============================================================================
// MathTS Core Type Definitions for typed-function
// =============================================================================

/**
 * Extended type definition with optional WASM mask support
 */
export interface MathTSTypeDef extends TypeDef {
  /** Optional WASM type mask for accelerated dispatch (auto-registered when WASM available) */
  wasmMask?: number;
}

/**
 * MathTS-specific types to add to typed-function.
 * Note: Most primitive types (number, boolean, string, etc.) are already built into typed-function
 *
 * When WASM is available, custom type masks are automatically registered for efficient dispatch.
 */
export const MATHTS_TYPES: MathTSTypeDef[] = [
  // bigint is not built into typed-function
  { name: 'bigint', test: isBigInt },

  // MathTS numeric types (ordered by specificity for conversion priority)
  // WASM masks use typed.masks.OBJECT | typed.masks.custom(N) pattern
  { name: 'Complex', test: isComplex },
  { name: 'Fraction', test: isFraction },
  { name: 'BigNumber', test: isBigNumber },

  // TypedArrays (for parallel-first WASM operations)
  { name: 'Float64Array', test: isFloat64Array },
  { name: 'Float32Array', test: isFloat32Array },
  { name: 'Int32Array', test: isInt32Array },
  { name: 'Uint32Array', test: isUint32Array },
  { name: 'Uint8Array', test: isUint8Array },

  // Matrix types
  { name: 'DenseMatrix', test: isDenseMatrix },
  { name: 'SparseMatrix', test: isSparseMatrix },
  { name: 'Matrix', test: isMatrix },

  // Other types
  { name: 'Unit', test: isUnit },
];

// =============================================================================
// MathTS Type Conversions
// =============================================================================

export const MATHTS_CONVERSIONS: ConversionDef[] = [
  // -------------------------------------------------------------------------
  // To Complex conversions
  // -------------------------------------------------------------------------
  {
    from: 'number',
    to: 'Complex',
    convert: (n: unknown) => Complex.fromNumber(n as number),
  },
  {
    from: 'Fraction',
    to: 'Complex',
    convert: (f: unknown) => Complex.fromNumber((f as Fraction).toNumber()),
  },
  {
    from: 'BigNumber',
    to: 'Complex',
    convert: (bn: unknown) => Complex.fromNumber((bn as BigNumber).valueOf()),
  },
  {
    from: 'string',
    to: 'Complex',
    convert: (s: unknown) => Complex.parse(s as string),
  },

  // -------------------------------------------------------------------------
  // To Fraction conversions
  // -------------------------------------------------------------------------
  {
    from: 'number',
    to: 'Fraction',
    convert: (n: unknown) => Fraction.fromNumber(n as number),
  },
  {
    from: 'bigint',
    to: 'Fraction',
    convert: (n: unknown) => new Fraction(n as bigint, 1n),
  },
  {
    from: 'string',
    to: 'Fraction',
    convert: (s: unknown) => Fraction.parse(s as string),
  },

  // -------------------------------------------------------------------------
  // To BigNumber conversions
  // -------------------------------------------------------------------------
  {
    from: 'number',
    to: 'BigNumber',
    convert: (n: unknown) => BigNumber.fromNumber(n as number),
  },
  {
    from: 'bigint',
    to: 'BigNumber',
    convert: (n: unknown) => BigNumber.fromBigInt(n as bigint),
  },
  {
    from: 'Fraction',
    to: 'BigNumber',
    convert: (f: unknown) => BigNumber.fromNumber((f as Fraction).toNumber()),
  },
  {
    from: 'string',
    to: 'BigNumber',
    convert: (s: unknown) => BigNumber.parse(s as string),
  },

  // -------------------------------------------------------------------------
  // To number conversions
  // -------------------------------------------------------------------------
  {
    from: 'boolean',
    to: 'number',
    convert: (b: unknown) => (b ? 1 : 0),
  },
  {
    from: 'string',
    to: 'number',
    convert: (s: unknown) => {
      const n = parseFloat(s as string);
      if (isNaN(n)) throw new Error(`Cannot convert "${s}" to number`);
      return n;
    },
  },
  {
    from: 'bigint',
    to: 'number',
    convert: (n: unknown) => Number(n as bigint),
  },
  {
    from: 'Fraction',
    to: 'number',
    convert: (f: unknown) => (f as Fraction).toNumber(),
  },
  {
    from: 'BigNumber',
    to: 'number',
    convert: (bn: unknown) => (bn as BigNumber).valueOf(),
  },

  // -------------------------------------------------------------------------
  // To bigint conversions
  // -------------------------------------------------------------------------
  {
    from: 'number',
    to: 'bigint',
    convert: (n: unknown) => BigInt(Math.trunc(n as number)),
  },
  {
    from: 'Fraction',
    to: 'bigint',
    convert: (f: unknown) => (f as Fraction).trunc().numerator,
  },
  {
    from: 'BigNumber',
    to: 'bigint',
    convert: (bn: unknown) => (bn as BigNumber).toBigInt(),
  },
  {
    from: 'string',
    to: 'bigint',
    convert: (s: unknown) => BigInt(s as string),
  },

  // -------------------------------------------------------------------------
  // Matrix conversions (placeholder until Matrix is implemented)
  // -------------------------------------------------------------------------
  {
    from: 'Array',
    to: 'Matrix',
    convert: (a: unknown) => {
      const arr = a as number[][];
      return {
        rows: arr.length,
        cols: arr[0]?.length ?? 0,
        data: arr.flat(),
        type: 'DenseMatrix',
        get: (r: number, c: number) => arr[r]?.[c],
      };
    },
  },
  {
    from: 'Matrix',
    to: 'Array',
    convert: (m: unknown) => {
      const matrix = m as { rows: number; cols: number; get: (r: number, c: number) => number };
      const result: number[][] = [];
      for (let i = 0; i < matrix.rows; i++) {
        result[i] = [];
        for (let j = 0; j < matrix.cols; j++) {
          result[i][j] = matrix.get(i, j);
        }
      }
      return result;
    },
  },
  {
    from: 'DenseMatrix',
    to: 'SparseMatrix',
    convert: (m: unknown) => {
      // Placeholder - will implement proper CSR conversion
      return { ...(m as object), type: 'SparseMatrix' };
    },
  },
];

// =============================================================================
// typed-function Instance Factory
// =============================================================================

/**
 * Create a new MathTS typed instance
 *
 * This creates an isolated typed universe with MathTS types and conversions.
 * Uses typed-function's addType() API which automatically registers WASM
 * type masks when available.
 *
 * @returns A new typed-function instance configured for MathTS
 *
 * @example
 * ```typescript
 * const myTyped = createMathTSTyped();
 *
 * const add = myTyped('add', {
 *   'number, number': (a, b) => a + b,
 *   'Complex, Complex': (a, b) => a.add(b),
 *   'Fraction, Fraction': (a, b) => a.add(b),
 *   'BigNumber, BigNumber': (a, b) => a.add(b),
 * });
 * ```
 */
export function createMathTSTyped(): TypedInstance {
  // Create a fresh typed-function instance using the library's create() API
  const instance = create();

  // Add MathTS types using the streamlined addType API
  // This automatically registers WASM type masks when available
  if (typeof instance.addType === 'function') {
    // Use new addType API (typed-function 5.x)
    for (const typeDef of MATHTS_TYPES) {
      instance.addType(typeDef);
    }
  } else {
    // Fallback to legacy addTypes API
    instance.addTypes(MATHTS_TYPES, 'any');
  }

  // Add MathTS conversions directly to the instance
  instance.addConversions(MATHTS_CONVERSIONS);

  return instance;
}

/**
 * Default MathTS typed instance
 *
 * This is the primary typed-function instance used throughout MathTS.
 * It comes pre-configured with all MathTS types and conversions.
 *
 * @example
 * ```typescript
 * import { mathTyped, Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
 *
 * // Create a polymorphic add function
 * const add = mathTyped('add', {
 *   'number, number': (a, b) => a + b,
 *   'Complex, Complex': (a, b) => a.add(b),
 *   'Fraction, Fraction': (a, b) => a.add(b),
 *   'BigNumber, BigNumber': (a, b) => a.add(b),
 * });
 *
 * // Works with automatic type coercion
 * add(1, 2);                              // 3
 * add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)
 * add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)
 * add(1, new Complex(2, 3));              // Complex(3, 3) - auto-converts
 * ```
 */
// Safe downcast: `MathTSTyped` only widens the input parameter type of the
// call signatures (and is itself assignable to `TypedInstance`), so the runtime
// factory genuinely satisfies it — the published call signature was simply too
// strict for declaring concrete-typed implementations.
export const mathTyped: MathTSTyped = createMathTSTyped() as MathTSTyped;

// =============================================================================
// Re-export typed-function for convenience
// =============================================================================

/**
 * The default typed-function export (for creating functions without MathTS types)
 */
export { typed };

/**
 * Create a new typed-function instance (typed-function's create)
 */
export { create };

/**
 * TypeRegistry class for managing custom type registrations
 * This is a MathTS utility, not from typed-function
 */
export class TypeRegistry {
  private types: Map<string, TypeDef> = new Map();
  private conversions: Map<string, ConversionDef> = new Map();
  private instance: TypedInstance | null = null;

  /**
   * Register a new type
   */
  registerType<T>(name: string, test: (x: unknown) => x is T): this {
    this.types.set(name, { name, test: test as (x: unknown) => boolean });
    this.instance = null;
    return this;
  }

  /**
   * Register a type conversion
   */
  registerConversion<From, To>(from: string, to: string, convert: (value: From) => To): this {
    const key = `${from}->${to}`;
    this.conversions.set(key, {
      from,
      to,
      convert: convert as (value: unknown) => unknown,
    });
    this.instance = null;
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
      const inst = create();
      inst.addTypes(Array.from(this.types.values()), 'any');
      inst.addConversions(Array.from(this.conversions.values()));
      this.instance = inst;
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

/**
 * Helper to create a typed function with the MathTS typed instance
 */
export function createTypedFunction<T>(
  name: string,
  signatures: { [signature: string]: (...args: unknown[]) => T },
  typedInstance: TypedInstance = mathTyped
): (...args: unknown[]) => T {
  return typedInstance(name, signatures) as (...args: unknown[]) => T;
}
