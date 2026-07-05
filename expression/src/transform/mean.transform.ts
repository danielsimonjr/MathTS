import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  mean: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'mean';
const dependencies = ['typed', 'mean'];

export const createMeanTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, mean }: Dependencies) => {
    /**
     * Attach a transform function to math.mean
     * Adds a property transform containing the transform function.
     *
     * This transform changed the last `dim` parameter of function mean
     * from one-based to zero based
     */
    return typed('mean', {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return mean(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
