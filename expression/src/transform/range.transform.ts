import { factory } from '../utils/factory.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  range: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'range';
const dependencies = ['typed', 'range'];

export const createRangeTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, range }: Dependencies) => {
    /**
     * Attach a transform function to math.range
     * Adds a property transform containing the transform function.
     *
     * This transform creates a range which includes the end value
     */
    return typed('range', {
      '...any': function (args: unknown[]): unknown {
        const lastIndex = args.length - 1;
        const last = args[lastIndex];
        if (typeof last !== 'boolean') {
          // append a parameter includeEnd=true
          args.push(true);
        }

        return range(...args);
      },
    });
  },
  { isTransformFunction: true }
);
