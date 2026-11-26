/**
 * Type surface of the GC12 fluent `chain` API (mathjs 15.3.0 Chain parity,
 * #1575 G20). Declared beside {@link ./chain.ts} so the runtime module stays
 * executable-code only.
 */
import type { mathTyped } from '@danielsimonjr/mathts-core';

/** The fluent chain object mathjs `chain()` returns: every instance method returns
 * another `Chain` (via `ChainMethods`), and `done()` unwraps the held value. */
export type Chain = ChainMethods & ChainUnwrap;

/** Method index for {@link Chain}: any method name resolves to a chain-returning
 * function, so the type stays open like mathjs's own `Chain` declaration. */
export interface ChainMethods {
  [method: string]: (...args: unknown[]) => Chain;
}

/** The fixed non-method surface of a {@link Chain}: unwrappers plus the mathjs
 * serialization brand fields. */
export interface ChainUnwrap {
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  toJSON(): { mathjs: 'Chain'; value: unknown };
  type: 'Chain';
  isChain: true;
  value: unknown;
}

/** Renders a chain value to a string, as `Chain.toString` does — the compat
 * instance's `format` by default, overridable through `createChain` options. */
export type FormatFn = (value: unknown, options?: Record<string, unknown>) => string;

/** The slice of the core typed dispatcher a chain needs: recognize typed functions
 * and resolve the single implementation matching a call's argument list. */
export type TypedLike = typeof mathTyped & {
  isTypedFunction: (value: unknown) => boolean;
  resolve: (
    fn: unknown,
    args: unknown[]
  ) => { params: unknown[]; implementation: (...args: unknown[]) => unknown } | null;
};

/** The runtime shape a created chain object carries before the proxy wraps it. */
export interface CompatChainInstance {
  type: 'Chain';
  isChain: true;
  value: unknown;
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  toJSON(): { mathjs: 'Chain'; value: unknown };
}

/** Constructor surface of the concrete `Chain` class handed out by
 * `createChain`: constructible with an optional initial value, with the
 * mathjs `Chain.fromJSON` static. */
export interface CompatChainCtor {
  new (value?: unknown): CompatChainInstance & Chain;
  fromJSON(json: { value: unknown }): CompatChainInstance & Chain;
}

/** Options for `createChain`: override the `format` used by `Chain.toString`, the
 * typed dispatcher used for method resolution, and the instance's `on` used to
 * pick up `import`-ed functions as chain methods. */
export interface CreateChainOptions {
  format?: FormatFn;
  typed?: TypedLike;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
}
