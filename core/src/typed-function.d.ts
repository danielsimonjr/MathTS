/**
 * Type declarations for typed-function v5.0
 * @see https://github.com/josdejong/typed-function
 */

declare module 'typed-function' {
  /**
   * A type definition that describes a runtime type check
   */
  export interface TypeDef {
    name: string;
    test: (x: unknown) => boolean;
    isAny?: boolean;
    index?: number;
    conversionsTo?: ConversionDef[];
  }

  /**
   * A conversion definition that describes how to convert between types
   */
  export interface ConversionDef {
    from: string;
    to: string;
    convert: (value: unknown) => unknown;
    index?: number;
  }

  /**
   * Represents a single type within a parameter
   */
  export interface Type {
    name: string;
    typeIndex: number;
    test: (x: unknown) => boolean;
    isAny: boolean;
    conversion: ConversionDef | null;
    conversionIndex: number;
  }

  /**
   * Represents a single parameter in a signature
   */
  export interface Param {
    types: Type[];
    name: string;
    hasAny: boolean;
    hasConversion: boolean;
    restParam: boolean;
    typeSet?: Set<string>;
  }

  /**
   * Function signature type for implementations
   */
  export type SignatureFunction = (...args: unknown[]) => unknown;

  /**
   * A compiled signature with test and implementation functions
   */
  export interface Signature {
    params: Param[];
    fn: SignatureFunction | null;
    test: ((args: ArrayLike<unknown>) => boolean) | null;
    implementation: SignatureFunction | null;
    name?: string;
  }

  /**
   * Internal data structure attached to typed functions
   */
  export interface TypedFunctionData {
    signatures: Signature[];
    signatureMap: Map<string, Signature>;
  }

  /**
   * A typed function with attached metadata
   */
  export interface TypedFunction {
    (...args: unknown[]): unknown;
    signatures: Record<string, SignatureFunction>;
    _typedFunctionData: TypedFunctionData;
    name: string;
  }

  /**
   * Reference to another signature
   */
  export interface ReferTo {
    referTo: {
      references: string[];
      callback: (...fns: SignatureFunction[]) => SignatureFunction;
    };
  }

  /**
   * Reference to the typed function itself
   */
  export interface ReferToSelf {
    referToSelf: {
      callback: (self: TypedFunction) => SignatureFunction;
    };
  }

  /**
   * Options for finding signatures
   */
  export interface FindSignatureOptions {
    exact?: boolean;
  }

  /**
   * Options for adding conversions
   */
  export interface AddConversionOptions {
    override?: boolean;
  }

  /**
   * Error data attached to typed-function errors
   */
  export interface TypedErrorData {
    category: 'wrongType' | 'tooFewArgs' | 'tooManyArgs' | 'mismatch';
    fn: string;
    index?: number;
    actual?: string[];
    expected?: string[];
    expectedLength?: number;
  }

  /**
   * Extended TypeError with additional data
   */
  export interface TypedError extends TypeError {
    data: TypedErrorData;
  }

  /**
   * Function type for testing a single argument
   */
  export type TypeTest = (x: unknown) => boolean;

  /**
   * Function type for testing all arguments of a signature
   */
  export type SignatureTest = (args: ArrayLike<unknown>) => boolean;

  /**
   * Function type for converting a single argument
   */
  export type ArgConverter = (arg: unknown) => unknown;

  /**
   * Handler function called when no signature matches
   */
  export type MismatchHandler = (name: string, args: ArrayLike<unknown>, signatures: Signature[]) => never;

  /**
   * The main typed function factory interface
   */
  export interface TypedInstance {
    /** Create a typed function with name and signature definitions */
    (name: string, signatures: Record<string, SignatureFunction | ReferTo | ReferToSelf>): TypedFunction;
    (signatures: Record<string, SignatureFunction | ReferTo | ReferToSelf>): TypedFunction;
    (...args: Array<string | Record<string, SignatureFunction | ReferTo | ReferToSelf> | TypedFunction | (SignatureFunction & { signature: string })>): TypedFunction;

    /** Create a new isolated typed instance */
    create: () => TypedInstance;

    /** Add a single type to the registry */
    addType: (type: TypeDef, beforeObjectTest?: boolean) => void;

    /** Add multiple types to the registry */
    addTypes: (types: TypeDef[], before?: string | boolean) => void;

    /** Add a type conversion */
    addConversion: (conversion: ConversionDef, options?: AddConversionOptions) => void;

    /** Add multiple type conversions */
    addConversions: (conversions: ConversionDef[], options?: AddConversionOptions) => void;

    /** Remove a type conversion */
    removeConversion: (conversion: ConversionDef) => void;

    /** Clear all types and conversions */
    clear: () => void;

    /** Clear all conversions (keep types) */
    clearConversions: () => void;

    /** Find the implementation function for a signature */
    find: (fn: TypedFunction, signature: string | string[], options?: FindSignatureOptions) => SignatureFunction;

    /** Find the full signature object for a signature */
    findSignature: (fn: TypedFunction, signature: string | string[], options?: FindSignatureOptions) => Signature;

    /** Resolve which signature would be called for given arguments */
    resolve: (fn: TypedFunction, args: ArrayLike<unknown>) => Signature | null;

    /** Convert a value to a specified type */
    convert: (value: unknown, typeName: string) => unknown;

    /** Check if a value is a typed function */
    isTypedFunction: (entity: unknown) => entity is TypedFunction;

    /** Create a reference to other signatures */
    referTo: (...args: [...string[], (...fns: SignatureFunction[]) => SignatureFunction]) => ReferTo;

    /** Create a self-reference */
    referToSelf: (callback: (self: TypedFunction) => SignatureFunction) => ReferToSelf;

    /** Create an error for mismatched arguments */
    createError: (name: string, args: ArrayLike<unknown>, signatures: Signature[]) => TypedError;

    /** Handler called when no signature matches */
    onMismatch: MismatchHandler;

    /** Throw an error on mismatch */
    throwMismatchError: MismatchHandler;

    /** Counter for created typed functions */
    createCount: number;

    /** Whether to warn about deprecated this usage */
    warnAgainstDeprecatedThis: boolean;

    /** Initialize the typed-function instance with optional WASM support */
    init: (options?: { preferWasm?: boolean; wasmPath?: string }) => Promise<boolean>;

    /** Check if WASM dispatch is available and enabled */
    isWasmEnabled: () => boolean;

    /** Reset WASM state (for testing) */
    resetWasm: () => void;
  }

  /**
   * Create a new typed function instance
   */
  export function create(): TypedInstance;

  /**
   * Check if an entity is a typed function
   */
  export function isTypedFunction(entity: unknown): boolean;

  /**
   * Default typed function instance
   */
  const typed: TypedInstance;
  export default typed;
}
