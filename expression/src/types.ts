// Type definitions for expression module
// Re-export from internal types

// Typed function type - a callable with signatures metadata
export type TypedFunction = ((...args: any[]) => any) & {
  signatures: Record<string, (...args: any[]) => any>;
};

// TypedFunctionConstructor can be defined inline if needed
export type TypedFunctionConstructor = {
  (...args: any[]): any
  create: () => TypedFunctionConstructor
  isTypedFunction: (fn: unknown) => boolean
}
