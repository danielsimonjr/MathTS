import { errorTransform } from './utils/errorTransform.js';
import { factory } from '../utils/factory.js';
import { dimToZeroBase, isNumberOrBigNumber } from './utils/dimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  mapSlices: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'apply';
const dependencies = ['typed', 'mapSlices'];

/**
 * Attach a transform function to math.apply
 * Adds a property transform containing the transform function.
 *
 * This transform changes the second `dim` argument of function apply
 * from one-based to zero based
 *
 * In mathjs 15.3.0 `apply` is the former name of `mapSlices`: the transform
 * factory for `mapSlices` carries `formerly: 'apply'`, so
 * `math.expression.transform.apply` is the same one-based transform. This file
 * provides the `apply`-named factory so the compat instance can build both
 * transform keys (#1572).
 */
export const createApplyTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, mapSlices }: Dependencies) => {
    // @see: comment of concat itself
    return typed('apply', {
      '...any': function (args: unknown[]): unknown {
        const dim = args[1];
        if (isNumberOrBigNumber(dim)) {
          args[1] = dimToZeroBase(dim);
        }

        try {
          return mapSlices(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
