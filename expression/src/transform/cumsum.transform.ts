import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  cumsum: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

/**
 * Attach a transform function to math.cumsum
 * Adds a property transform containing the transform function.
 *
 * This transform changes the last `dim` parameter of function cumsum
 * from one-based to zero based
 */
const name = 'cumsum';
const dependencies = ['typed', 'cumsum'];

export const createCumSumTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, cumsum }: Dependencies) => {
    return typed(name, {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return cumsum(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
