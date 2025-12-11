/**
 * Type declarations for typed-function
 */

declare module 'typed-function' {
  export interface TypedFunction {
    (name: string, signatures: Record<string, (...args: unknown[]) => unknown>): (...args: unknown[]) => unknown;
    (signatures: Record<string, (...args: unknown[]) => unknown>): (...args: unknown[]) => unknown;

    addType(type: { name: string; test: (x: unknown) => boolean }, beforeType?: string): void;
    addTypes(types: Array<{ name: string; test: (x: unknown) => boolean }>, beforeType?: string): void;
    addConversion(conversion: { from: string; to: string; convert: (x: unknown) => unknown }): void;
    addConversions(conversions: Array<{ from: string; to: string; convert: (x: unknown) => unknown }>): void;

    find(fn: (...args: unknown[]) => unknown, signature: string[]): (...args: unknown[]) => unknown | undefined;
    convert(value: unknown, type: string): unknown;
    getTypeOf(value: unknown): string;

    types: Array<{ name: string; test: (x: unknown) => boolean }>;
    conversions: Array<{ from: string; to: string; convert: (x: unknown) => unknown }>;
  }

  // Type alias for TypedFunction instance
  export type TypedInstance = TypedFunction;

  // Signature function type
  export type SignatureFunction = (...args: unknown[]) => unknown;

  // Reference helpers for self-referential functions
  export type ReferTo = {
    referTo: string[];
  };

  export type ReferToSelf = {
    referToSelf: (self: SignatureFunction) => SignatureFunction;
  };

  export function create(): TypedFunction;

  const typed: TypedFunction;
  export default typed;
}
