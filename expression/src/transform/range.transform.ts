import { factory } from '../utils/factory.js';
import { createRange } from '../../function/matrix/range.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  typed: TypedFunction;
  config: Record<string, unknown>;
  matrix?: (...args: unknown[]) => unknown;
  bignumber?: (...args: unknown[]) => unknown;
  equal: TypedFunction;
  smaller: TypedFunction;
  smallerEq: TypedFunction;
  larger: TypedFunction;
  largerEq: TypedFunction;
  add: TypedFunction;
  isZero: (x: unknown) => boolean;
  isPositive: (x: unknown) => boolean;
}

const name = 'range';
const dependencies = [
  'typed',
  'config',
  '?matrix',
  '?bignumber',
  'equal',
  'smaller',
  'smallerEq',
  'larger',
  'largerEq',
  'add',
  'isZero',
  'isPositive',
];

export const createRangeTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    config,
    matrix,
    bignumber,
    equal,
    smaller,
    smallerEq,
    larger,
    largerEq,
    add,
    isZero,
    isPositive,
  }: Dependencies) => {
    const range = createRange({
      typed,
      config,
      matrix,
      bignumber,
      equal,
      smaller,
      smallerEq,
      larger,
      largerEq,
      add,
      isZero,
      isPositive,
    });

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
