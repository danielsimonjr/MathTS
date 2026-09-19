// Type definitions for expression module
// Re-export from internal types

// Typed function type - a callable with signatures metadata
/**
 * A function that also has a `signatures` record.
 * The record maps each signature string to its implementation.
 */
export type TypedFunction = ((...args: unknown[]) => unknown) & {
  signatures: Record<string, (...args: unknown[]) => unknown>;
};

// TypedFunctionConstructor can be defined inline if needed
/**
 * The shape of a typed-function constructor.
 * It is callable, it has `create` to make a new instance, and it has `isTypedFunction` to test a value.
 */
export type TypedFunctionConstructor = {
  (...args: unknown[]): unknown;
  create: () => TypedFunctionConstructor;
  isTypedFunction: (fn: unknown) => boolean;
};
