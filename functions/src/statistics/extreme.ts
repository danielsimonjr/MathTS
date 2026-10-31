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
  nan?: (value: unknown) => unknown;
  cmp?: (value: unknown, best: unknown) => unknown;
}

/**
 * @private
 */
export function _reduceExtremeNumber(
  array: number[],
  nan: (value: unknown) => unknown,
  cmp: (value: unknown, best: unknown) => unknown,
  fnName: 'max' | 'min'
): unknown {
  let res: unknown;
  for (let i = 0; i < array.length; i++) {
    const value = array[i];
    if (nan(value)) {
      res = value;
    } else if (res === undefined || cmp(value, res)) {
      res = value;
    }
  }
  if (res === undefined) {
    throw new Error(`Cannot calculate ${fnName} of an empty array`);
  }
  return res;
}

function plainArrayAllNumbers(array: unknown[]): boolean {
  if (array.constructor !== Array) return false;
  for (let i = 0; i < array.length; i++) {
    if (typeof array[i] !== 'number') return false;
  }
  return true;
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
  if (nan && cmp && Array.isArray(array) && plainArrayAllNumbers(array as unknown[])) {
    try {
      const res = _reduceExtremeNumber(array as number[], nan, cmp, fnName);
      if (typeof res === 'string') {
        return numeric(res, safeNumberType(res, config));
      }
      return res;
    } catch (err) {
      throw improveErrorMessage(err, fnName, undefined);
    }
  }

  let res: unknown;

  deepForEach(array, function (value: unknown) {
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
