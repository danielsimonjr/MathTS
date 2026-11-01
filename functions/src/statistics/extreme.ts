import { deepForEach } from '../utils/collection.js';
import { safeNumberType } from '../utils/number.js';
import { improveErrorMessage } from './utils/improveErrorMessage.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

interface MatrixType {
  forEach(callback: (value: unknown) => void, skipZeros: boolean, recurse: boolean): void;
}

interface ReduceExtremeDeps {
  isNaN: TypedFunction;
  numeric: TypedFunction;
  config: ConfigOptions;
  /** The `number` implementation of `isNaN`, resolved once by the calling factory. */
  nan?: (value: number) => boolean;
  /** The `number, number` implementation of `larger` (max) or `smaller` (min). */
  cmp?: (value: number, best: number) => boolean;
}

/**
 * Recursively reduce an array or matrix to a single extreme value.
 * `compare` is the typed `larger` (max) or `smaller` (min) the factories close over —
 * called as `compare(value, best)`, same argument order as the pre-merge loops.
 * @private
 */
export function reduceExtreme(
  array: unknown[] | MatrixType,
  compare: (value: unknown, best: unknown) => unknown,
  fnName: 'max' | 'min',
  deps: ReduceExtremeDeps
): unknown {
  const { isNaN: mathIsNaN, numeric, config, nan, cmp } = deps;
  let res: unknown;
  let rest: unknown[] | MatrixType = array;

  if (
    nan !== undefined &&
    cmp !== undefined &&
    Array.isArray(array) &&
    array.constructor === Array
  ) {
    // Walk the leading numbers with the cached number implementations. The first other element
    // hands the running result to the generic walk below, so no comparison is done twice.
    let best: number | undefined;
    let i = 0;
    try {
      for (; i < array.length; i++) {
        const value = array[i];
        if (typeof value !== 'number') break;
        if (nan(value)) {
          best = value;
        } else if (best === undefined || cmp(value, best)) {
          best = value;
        }
      }
    } catch (err) {
      throw improveErrorMessage(err, fnName, array[i]);
    }
    if (i === array.length) {
      if (best === undefined) {
        throw new Error(`Cannot calculate ${fnName} of an empty array`);
      }
      return best;
    }
    res = best;
    rest = array.slice(i);
  }

  deepForEach(rest, function (value: unknown) {
    try {
      if (mathIsNaN(value)) {
        res = value;
      } else if (res === undefined || compare(value, res)) {
        res = value;
      }
    } catch (err) {
      throw improveErrorMessage(err, fnName, value);
    }
  });

  if (res === undefined) {
    throw new Error(`Cannot calculate ${fnName} of an empty array`);
  }

  if (typeof res === 'string') {
    res = numeric(res, safeNumberType(res, config));
  }

  return res;
}
