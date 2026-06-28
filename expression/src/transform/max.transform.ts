import { factory } from '../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { createMax } from '../../function/statistics/max.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  typed: TypedFunction;
  config: Record<string, unknown>;
  numeric: TypedFunction;
  larger: TypedFunction;
  isNaN: (x: unknown) => boolean;
}

const name = 'max';
const dependencies = ['typed', 'config', 'numeric', 'larger', 'isNaN'];

export const createMaxTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, numeric, larger, isNaN: mathIsNaN }: Dependencies) => {
    const max = createMax({ typed, config, numeric, larger, isNaN: mathIsNaN });

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
