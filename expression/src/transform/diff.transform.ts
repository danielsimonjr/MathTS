import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  diff: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'diff';
const dependencies = ['typed', 'diff'];

export const createDiffTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, diff }: Dependencies) => {
    /**
     * Attach a transform function to math.diff
     * Adds a property transform containing the transform function.
     *
     * This transform creates a range which includes the end value
     */
    return typed(name, {
      '...any': function (args: unknown[]): unknown {
        args = lastDimToZeroBase(args);

        try {
          return diff(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
