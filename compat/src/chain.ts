/**
 * GC12 — mathjs-style fluent `chain` API.
 *
 *   chain(3).add(4).multiply(2).done()   // 14
 *
 * Each math function `f` becomes a chain method that calls `f(value, ...args)`
 * and returns a new chain wrapping the result. `.done()` / `.valueOf()` unwrap.
 */
export interface Chain {
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  [method: string]: (...args: unknown[]) => Chain | unknown;
}

/**
 * Build the `chain` factory for one math instance.
 *
 * Each chain method looks up a function of the same name in `math` when the method is read.
 * The method calls that function with the wrapped value first, then the method arguments.
 * The method returns a new chain that wraps the result.
 * `done()` and `valueOf()` return the wrapped value.
 * A name that is not a function in `math` gives `undefined`.
 *
 * @param math - The math instance that supplies the chain methods.
 * @returns A function that wraps a value in a chain.
 */
export function createChain(math: Record<string, unknown>): (value: unknown) => Chain {
  function chain(value: unknown): Chain {
    const base = {
      done: () => value,
      valueOf: () => value,
      toString: () => String(value),
    };
    return new Proxy(base, {
      get(target, prop: string | symbol) {
        if (prop in target || typeof prop === 'symbol') {
          return (target as Record<string | symbol, unknown>)[prop];
        }
        const fn = math[prop as string];
        if (typeof fn === 'function') {
          return (...args: unknown[]) =>
            chain((fn as (...a: unknown[]) => unknown)(value, ...args));
        }
        return undefined;
      },
    }) as unknown as Chain;
  }
  return chain;
}
