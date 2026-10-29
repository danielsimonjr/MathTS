import { flatten } from '../utils/array.js';
import { flattenSetPair } from './flatten-pair.js';
import { factory } from '../utils/factory.js';
import type { MathArray, Matrix, MathNumericType } from '../../types/index.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { IndexInterface } from '../type/matrix/types.js';

// Type definitions for setSymDifference
type Index = IndexInterface;

interface SetSymDifferenceDependencies {
  typed: TypedFunction;
  size: (arr: MathArray | Matrix) => number[];
  concat: TypedFunction;
  subset: (arr: number[], index: Index) => number;
  setDifference: (a1: MathNumericType[], a2: MathNumericType[]) => MathNumericType[];
  Index: new (i: number) => Index;
}

const name = 'setSymDifference';
const dependencies = ['typed', 'size', 'concat', 'subset', 'setDifference', 'Index'];

export const createSetSymDifference = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, size, concat, subset, setDifference, Index }: SetSymDifferenceDependencies) => {
    /**
     * Create the symmetric difference of two (multi)sets.
     * Multi-dimension arrays will be converted to single-dimension arrays before the operation.
     *
     * Syntax:
     *
     *    math.setSymDifference(set1, set2)
     *
     * Examples:
     *
     *    math.setSymDifference([1, 2, 3, 4], [3, 4, 5, 6])            // returns [1, 2, 5, 6]
     *    math.setSymDifference([[1, 2], [3, 4]], [[3, 4], [5, 6]])    // returns [1, 2, 5, 6]
     *
     * See also:
     *
     *    setUnion, setIntersect, setDifference
     *
     * @param {Array | Matrix}    a1  A (multi)set
     * @param {Array | Matrix}    a2  A (multi)set
     * @return {Array | Matrix}    The symmetric difference of two (multi)sets
     */
    return typed(name, {
      'Array | Matrix, Array | Matrix': function (
        a1: MathArray | Matrix,
        a2: MathArray | Matrix
      ): MathNumericType[] | Matrix {
        return flattenSetPair(
          a1,
          a2,
          { size, subset, Index, flatten },
          (b1, b2) =>
            concat(setDifference(b1, b2), setDifference(b2, b1)) as MathNumericType[] | Matrix
        );
      },
    });
  }
);
