import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  max: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'max';
const dependencies = ['typed', 'max'];

export const createMaxTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, max }: Dependencies) => {
    /**
     * Attach a transform function to math.max
     * Adds a property transform containing the transform function.
     *
     * This transform changed the last `dim` parameter of function max
     * from one-based to zero based
     */
    return typed('max', {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return max(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
