// Type definitions for expression module
// Re-export from internal types

// Typed function type - a callable with signatures metadata
export type TypedFunction = ((...args: unknown[]) => unknown) & {
  signatures: Record<string, (...args: unknown[]) => unknown>;
};

// TypedFunctionConstructor can be defined inline if needed
export type TypedFunctionConstructor = {
  (...args: unknown[]): unknown;
  create: () => TypedFunctionConstructor;
  isTypedFunction: (fn: unknown) => boolean;
};
