// function utils

import { lruQueue } from './lruQueue.js';

/**
 * Memoize a given function by caching the computed result.
 * The cache of a memoized function can be cleared by deleting the `cache`
 * property of the function.
 *
 * @param {function} fn                     The function to be memoized.
 *                                          Must be a pure function.
 * @param {Object} [options]
 * @param {function(args: Array): string} [options.hasher]
 *    A custom hash builder. Is JSON.stringify by default.
 * @param {number | undefined} [options.limit]
 *    Maximum number of values that may be cached. Undefined indicates
 *    unlimited (default)
 * @return {function}                       Returns the memoized function
 */
export interface MemoizeCache {
  values: Map<string, unknown>;
  lru: ReturnType<typeof lruQueue>;
}

export interface MemoizedFunction {
  (...args: unknown[]): unknown;
  cache?: MemoizeCache;
}

export function memoize(
  fn: (...args: unknown[]) => unknown,
  {
    hasher,
    limit,
  }: { hasher?: (args: unknown[]) => string; limit?: number } = {}
): MemoizedFunction {
  const effectiveLimit = limit == null ? Number.POSITIVE_INFINITY : limit;
  const effectiveHasher = hasher == null ? (args: unknown[]): string => JSON.stringify(args) : hasher;

  const memoized: MemoizedFunction = function (...args: unknown[]): unknown {
    if (typeof memoized.cache !== 'object') {
      memoized.cache = {
        values: new Map<string, unknown>(),
        lru: lruQueue(effectiveLimit || Number.POSITIVE_INFINITY),
      };
    }
    const hash = effectiveHasher(args);

    if (memoized.cache.values.has(hash)) {
      memoized.cache.lru.hit(hash);
      return memoized.cache.values.get(hash);
    }

    const newVal = fn.apply(fn, args);
    memoized.cache.values.set(hash, newVal);
    const evicted = memoized.cache.lru.hit(hash);
    if (evicted !== undefined) {
      memoized.cache.values.delete(evicted);
    }

    return newVal;
  };

  return memoized;
}

/**
 * Memoize a given function by caching all results and the arguments,
 * and comparing against the arguments of previous results before
 * executing again.
 * This is less performant than `memoize` which calculates a hash,
 * which is very fast to compare. Use `memoizeCompare` only when it is
 * not possible to create a unique serializable hash from the function
 * arguments.
 * The isEqual function must compare two sets of arguments
 * and return true when equal (can be a deep equality check for example).
 * @param {function} fn
 * @param {function(a: *, b: *) : boolean} isEqual
 * @returns {function}
 */
interface CompareCacheEntry {
  args: unknown[];
  res: unknown;
}

interface MemoizeCompareFunction {
  (...args: unknown[]): unknown;
  cache: CompareCacheEntry[];
}

export function memoizeCompare(
  fn: (...args: unknown[]) => unknown,
  isEqual: (a: unknown[], b: unknown[]) => boolean
): MemoizeCompareFunction {
  const memoize = function (...args: unknown[]): unknown {
    for (let c = 0; c < memoize.cache.length; c++) {
      const cached = memoize.cache[c];

      if (isEqual(args, cached.args)) {
        memoize.cache.splice(c, 1);
        memoize.cache.unshift(cached);
        return cached.res;
      }
    }

    const res = fn.apply(fn, args);
    memoize.cache.unshift({ args, res });

    return res;
  } as MemoizeCompareFunction;

  memoize.cache = [];

  return memoize;
}
