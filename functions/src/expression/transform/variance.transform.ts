import { factory } from '../../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { createVariance } from '../../statistics/variance.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';
import type { TypedFunction, VariadicArgs } from './types.js';

interface VarianceDependencies {
  typed: TypedFunction;
  add: TypedFunction;
  subtract: TypedFunction;
  multiply: TypedFunction;
  divide: TypedFunction;
  mapSlices: TypedFunction;
  isNaN: (x: unknown) => boolean;
}

const name = 'variance';
const dependencies = ['typed', 'add', 'subtract', 'multiply', 'divide', 'mapSlices', 'isNaN'];

/**
 * Attach a transform function to math.var
 * Adds a property transform containing the transform function.
 *
 * This transform changed the `dim` parameter of function var
 * from one-based to zero based
 */
export const createVarianceTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    add,
    subtract,
    multiply,
    divide,
    mapSlices,
    isNaN: mathIsNaN,
  }: VarianceDependencies) => {
    const variance = createVariance({
      typed,
      add,
      subtract,
      multiply,
      divide,
      mapSlices,
      isNaN: mathIsNaN,
    });

    return typed(name, {
      '...any': function (args: VariadicArgs): unknown {
        args = lastDimToZeroBase(args);

        try {
          return variance.apply(null, args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
