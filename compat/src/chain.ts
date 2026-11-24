/**
 * GC12 — mathjs-style fluent `chain` API.
 *
 *   chain(3).add(4).multiply(2).done()   // 14
 *
 * Each math function `f` becomes a chain method that calls `f(value, ...args)`
 * and returns a new chain wrapping the result. `.done()` / `.valueOf()` unwrap.
 */
export type Chain = ChainMethods & ChainUnwrap;

/**
 * Every math function name is a chain method that returns the next chain.
 *
 * This lives in its own interface because TypeScript requires each declared member of
 * an interface to be assignable to its index signature, and `done(): unknown` is not
 * assignable to a method that returns `Chain`. The old single interface typed the
 * index signature as returning `Chain | unknown`, which is just `unknown`, so
 * `chain(3).add(4).multiply(2)` did not type-check. In the intersection, the declared
 * members of `ChainUnwrap` take precedence and every other name is a method that returns the next chain.
 */
export interface ChainMethods {
  [method: string]: (...args: unknown[]) => Chain;
}

/** The members that end a chain. */
export interface ChainUnwrap {
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
}

class CompatChain {
  get isChain(): true {
    return true;
  }
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
 * @returns A chain constructor and its callable factory bound to the same instance.
 */
export function createChain(math: Record<string, unknown>): {
  chain: (value?: unknown) => Chain;
  Chain: new (value?: unknown) => Chain;
} {
  const Constructor = class Chain extends CompatChain {
    constructor(value?: unknown) {
      super();
      const base = Object.assign(this, {
        done: () => value,
        valueOf: () => value,
        toString: () => String(value),
      });
      return new Proxy(base, {
        get(target, prop: string | symbol) {
          if (prop in target || typeof prop === 'symbol') {
            return (target as unknown as Record<string | symbol, unknown>)[prop];
          }
          const fn = math[prop];
          if (typeof fn === 'function') {
            return (...args: unknown[]) =>
              chain((fn as (...values: unknown[]) => unknown)(value, ...args));
          }
          return undefined;
        },
      });
    }
  };
  const ChainConstructor = Constructor as unknown as new (value?: unknown) => Chain;

  function chain(value?: unknown): Chain {
    return new ChainConstructor(value);
  }

  return { chain, Chain: ChainConstructor };
}
