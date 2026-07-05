import { errorTransform } from './utils/errorTransform.js';
import { factory } from '../utils/factory.js';
import { isBigNumber, isNumber } from '../utils/is.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  mapSlices: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'mapSlices';
const dependencies = ['typed', 'mapSlices'];

/**
 * Attach a transform function to math.mapSlices
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `dim` parameter of function mapSlices
 * from one-based to zero based
 */
export const createMapSlicesTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, mapSlices }: Dependencies) => {
    // @see: comment of concat itself
    return typed('mapSlices', {
      '...any': function (args: unknown[]): unknown {
        // change dim from one-based to zero-based
        const dim = args[1];

        if (isNumber(dim)) {
          args[1] = dim - 1;
        } else if (isBigNumber(dim)) {
          args[1] = (dim as unknown as { minus(n: number): unknown }).minus(1);
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
