import { factory } from '../../utils/factory.js';
import { errorTransform } from './utils/errorTransform.js';
import { createDiff } from '../../matrix/diff.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';
import type { TypedFunction, MathFunction, VariadicArgs } from './types.js';

interface DiffDependencies {
  typed: TypedFunction;
  matrix: MathFunction;
  subtract: MathFunction;
  number: MathFunction<number>;
  bignumber: MathFunction;
}

const name = 'diff';
const dependencies = ['typed', 'matrix', 'subtract', 'number', 'bignumber'];

export const createDiffTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, subtract, number, bignumber }: DiffDependencies) => {
    const diff = createDiff({ typed, matrix, subtract, number, bignumber });

    /**
     * Attach a transform function to math.diff
     * Adds a property transform containing the transform function.
     *
     * This transform creates a range which includes the end value
     */
    return typed(name, {
      '...any': function (args: VariadicArgs): unknown {
        args = lastDimToZeroBase(args);

        try {
          return diff.apply(null, args);
        } catch (err) {
          throw errorTransform(err as Error);
        }
      },
    });
  },
  { isTransformFunction: true }
);
