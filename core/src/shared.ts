/**
 * Shared utility functions used across core utility modules.
 * This file must have ZERO imports from other core utility files
 * to serve as the base of the dependency graph and break circular imports.
 */

/**
 * A safe hasOwnProperty
 * @param {Object} object
 * @param {string} property
 */
export function hasOwnProperty(object: unknown, property: string): boolean {
  return !!object && Object.hasOwnProperty.call(object, property);
}

/**
 * True when `text` ends with `search`. (Equivalent to `String.prototype.endsWith`;
 * kept as a named helper so relocated modules read the same as their mathjs origin.)
 */
export function endsWith(text: string, search: string): boolean {
  const start = text.length - search.length;
  return text.substring(start, text.length) === search;
}

/**
 * Warn to the console at most once per distinct message, deduped for the process
 * lifetime. Used for deprecation notices (e.g. `Unit.toNumber`).
 */
export const warnOnce = (() => {
  const seen: Record<string, boolean> = {};

  return function warnOnce(...args: unknown[]): void {
    const message = args.join(', ');
    if (!seen[message]) {
      seen[message] = true;
      console.warn('Warning:', ...args);
    }
  };
})();

/** A function whose results are cached; clear the cache with `delete fn.cache`. */
export interface MemoizedFunction {
  (...args: unknown[]): unknown;
  cache?: Map<string, unknown>;
}

/**
 * Memoize a pure function, caching results in an unbounded `Map` keyed by a string
 * hash of the arguments (default `JSON.stringify`; override via `hasher`). The cache
 * is exposed as `fn.cache` and can be reset with `delete fn.cache` — the next call
 * lazily recreates it. (The relocated `Unit` relies on that reset when `createUnit`/
 * `deleteUnit` invalidate the unit-name lookup cache.)
 */
export function memoize(
  fn: (...args: unknown[]) => unknown,
  { hasher }: { hasher?: (args: unknown[]) => string } = {}
): MemoizedFunction {
  const hash = hasher ?? ((args: unknown[]): string => JSON.stringify(args));

  const memoized: MemoizedFunction = function (...args: unknown[]): unknown {
    if (!(memoized.cache instanceof Map)) {
      memoized.cache = new Map<string, unknown>();
    }
    const key = hash(args);
    if (memoized.cache.has(key)) {
      return memoized.cache.get(key);
    }
    const value = fn.apply(fn, args);
    memoized.cache.set(key, value);
    return value;
  };

  return memoized;
}
