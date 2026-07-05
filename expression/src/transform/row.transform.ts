import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { isNumber } from '../utils/is.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  row: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'row';
const dependencies = ['typed', 'row'];

/**
 * Attach a transform function to matrix.column
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `index` parameter of function column
 * from zero-based to one-based
 */
export const createRowTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, row }: Dependencies) => {
    // @see: comment of row itself
    return typed('row', {
      '...any': function (args: unknown[]): unknown {
        // change last argument from zero-based to one-based
        const lastIndex = args.length - 1;
        const last = args[lastIndex];
        if (isNumber(last)) {
          args[lastIndex] = last - 1;
        }

        try {
          return row(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
