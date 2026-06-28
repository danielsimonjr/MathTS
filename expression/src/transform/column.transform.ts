import { errorTransform } from './utils/errorTransform.js';
import { factory } from '../utils/factory.js';
import { createColumn } from '../../function/matrix/column.js';
import { isNumber } from '../utils/is.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  typed: TypedFunction;
  Index: new (...args: unknown[]) => unknown;
  matrix: (...args: unknown[]) => unknown;
  range: (...args: unknown[]) => unknown;
}

const name = 'column';
const dependencies = ['typed', 'Index', 'matrix', 'range'];

/**
 * Attach a transform function to matrix.column
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `index` parameter of function column
 * from zero-based to one-based
 */
export const createColumnTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, Index, matrix, range }: Dependencies) => {
    const column = createColumn({ typed, Index, matrix, range });

    // @see: comment of column itself
    return typed('column', {
      '...any': function (args: unknown[]): unknown {
        // change last argument from zero-based to one-based
        const lastIndex = args.length - 1;
        const last = args[lastIndex];
        if (isNumber(last)) {
          args[lastIndex] = last - 1;
        }

        try {
          return column(...args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
