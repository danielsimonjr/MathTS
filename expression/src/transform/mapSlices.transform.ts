import { errorTransform } from './utils/errorTransform.js';
import { factory } from '../utils/factory.js';
import { dimToZeroBase, isNumberOrBigNumber } from './utils/dimToZeroBase.js';

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
 * This transform changes the second `dim` argument of function mapSlices
 * from one-based to zero based
 */
export const createMapSlicesTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, mapSlices }: Dependencies) => {
    // @see: comment of concat itself
    return typed('mapSlices', {
      '...any': function (args: unknown[]): unknown {
        const dim = args[1];
        if (isNumberOrBigNumber(dim)) {
          args[1] = dimToZeroBase(dim);
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
