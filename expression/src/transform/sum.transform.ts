import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  sum: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

/**
 * Attach a transform function to math.sum
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `dim` parameter of function sum
 * from one-based to zero based
 */
const name = 'sum';
const dependencies = ['typed', 'sum'];

export const createSumTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, sum }: Dependencies) => {
    return typed(name, {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return sum(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
