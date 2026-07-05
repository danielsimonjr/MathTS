import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  subset: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'subset';
const dependencies = ['typed', 'subset'];

export const createSubsetTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, subset }: Dependencies) => {
    /**
     * Attach a transform function to math.subset
     * Adds a property transform containing the transform function.
     *
     * This transform creates a range which includes the end value
     */
    return typed('subset', {
      '...any': function (args: unknown[]): unknown {
        try {
          return subset(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
