import { isBigNumber, isCollection, isNumber } from '../utils/is.js';
import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  cumsum: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

/**
 * Attach a transform function to math.sum
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `dim` parameter of function sum
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
        // change last argument dim from one-based to zero-based
        if (args.length === 2 && isCollection(args[0])) {
          const dim = args[1];
          if (isNumber(dim)) {
            args[1] = dim - 1;
          } else if (isBigNumber(dim)) {
            args[1] = (dim as unknown as { minus(n: number): unknown }).minus(1);
          }
        }

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
