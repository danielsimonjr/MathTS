/**
 * Runtime helpers of the GC12 fluent `chain` API (mathjs 15.3.0 Chain parity,
 * #1575 G20), split beside {@link ./chain.ts} so each module stays small.
 */
import type { Chain, CompatChainCtor, CompatChainInstance, TypedLike } from './chain-types.js';

/** Applies one chain step: `f(value, ...rest)` when the function is not a typed
 * function with a rest-parameter conflict; otherwise resolves the single
 * implementation through the typed dispatcher and applies it, so the chain step
 * behaves like the corresponding mathjs call. */
export function chainify(
  wrap: (value?: unknown) => Chain,
  fn: ((...args: unknown[]) => unknown) & { name?: string },
  typed: TypedLike,
  value: unknown,
  rest: unknown[]
): Chain {
  if (rest.length === 0) {
    return wrap(fn(value));
  }
  const args: unknown[] = [value, ...rest];
  if (typed.isTypedFunction(fn)) {
    const sigObject = typed.resolve(fn, args);
    if (sigObject && sigObject.params.length === 1) {
      throw new Error(
        'chain function ' +
          fn.name +
          ' cannot match rest parameter between chain value and additional arguments.'
      );
    }
    const implementation = sigObject?.implementation;
    if (implementation) {
      return wrap(implementation.apply(fn, args));
    }
  }
  return wrap(fn.apply(fn, args));
}

/** Defines `name` on `prototype` as a lazy getter that resolves the function on
 * first access and returns a bound chain method, so an `import`-ed function only
 * touches the resolver when a chain actually uses it. */
export function createLazyProxy(
  prototype: Record<string, unknown>,
  name: string,
  resolver: () => unknown,
  wrap: (value?: unknown) => Chain,
  typed: TypedLike
): void {
  let resolved: ((...args: unknown[]) => Chain) | undefined;
  Object.defineProperty(prototype, name, {
    configurable: true,
    enumerable: false,
    get(): ((...args: unknown[]) => Chain) | undefined {
      if (resolved === undefined) {
        const fn = resolver();
        if (typeof fn !== 'function') {
          return undefined;
        }
        resolved = function resolvedMethod(this: CompatChainInstance, ...rest: unknown[]): Chain {
          return chainify(
            wrap,
            fn as (...args: unknown[]) => unknown & { name?: string },
            typed,
            this.value,
            rest
          );
        };
      }
      return resolved.bind(this);
    },
  });
}

/** Listens on the instance's `import` event and defines every imported function as
 * a lazy chain method on the `Chain` constructor's prototype, mirroring mathjs's
 * `import`-ed chain methods. */
export function attachImportProxies(
  ChainCtor: CompatChainCtor,
  on: ((event: string, callback: (...args: unknown[]) => void) => void) | undefined,
  wrap: (value?: unknown) => Chain,
  typed: TypedLike
): void {
  if (!on) return;
  on('import', (name: unknown, resolver: unknown) => {
    if (typeof name !== 'string' || typeof resolver !== 'function') return;
    createLazyProxy(
      ChainCtor.prototype as Record<string, unknown>,
      name,
      resolver as () => unknown,
      wrap,
      typed
    );
  });
}
