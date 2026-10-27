import { deepForEach } from '../utils/collection.js';
import { safeNumberType } from '../utils/number.js';
import { improveErrorMessage } from './utils/improveErrorMessage.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

interface MatrixType {
  forEach(callback: (value: unknown) => void, skipZeros: boolean, recurse: boolean): void;
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
  deps: {
    isNaN: TypedFunction;
    numeric: TypedFunction;
    config: ConfigOptions;
  }
): unknown {
  const { isNaN: mathIsNaN, numeric, config } = deps;
  let res: unknown;

  deepForEach(array as Parameters<typeof deepForEach>[0], function (value: unknown) {
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
