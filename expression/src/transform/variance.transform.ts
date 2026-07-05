import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  variance: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'variance';
const dependencies = ['typed', 'variance'];

/**
 * Attach a transform function to math.var
 * Adds a property transform containing the transform function.
 *
 * This transform changed the `dim` parameter of function var
 * from one-based to zero based
 */
export const createVarianceTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, variance }: Dependencies) => {
    return typed(name, {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return variance(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
