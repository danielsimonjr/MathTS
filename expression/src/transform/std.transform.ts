import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  std: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'std';
const dependencies = ['typed', 'std'];

/**
 * Attach a transform function to math.std
 * Adds a property transform containing the transform function.
 *
 * This transform changed the `dim` parameter of function std
 * from one-based to zero based
 */
export const createStdTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, std }: Dependencies) => {
    return typed('std', {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return std(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
