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

  export function create(): TypedFunction;

  const typed: TypedFunction;
  export default typed;
}
