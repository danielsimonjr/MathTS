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

export function createChain(
  math: Record<string, unknown>
): (value: unknown) => Chain {
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
