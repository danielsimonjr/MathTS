import { factory } from '../utils/factory.js';
import { deepMap } from '../utils/collection.js';
import { combinationsNumber } from '../plain/number/combinations.js';
import type { TypedFunction } from '../core/function/typed.js';
import {
  binomialProductBigNumber,
  isPositiveInteger,
  type BigNumberBinomialType,
} from './bigint-binomial.js';

interface Matrix {
  valueOf(): unknown;
}

interface CombinationsDependencies {
  typed: TypedFunction;
}

const name = 'combinations';
const dependencies = ['typed'];

export const createCombinations = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: CombinationsDependencies) => {
    /**
     * Compute the number of ways of picking `k` unordered outcomes from `n`
     * possibilities.
     *
     * Combinations only takes integer arguments.
     * The following condition must be enforced: k <= n.
     *
     * Syntax:
     *
     *     math.combinations(n, k)
     *
     * Examples:
     *
     *    math.combinations(7, 5) // returns 21
     *
     * See also:
     *
     *    combinationsWithRep, permutations, factorial
     *
     * @param {number | BigNumber} n    Total number of objects in the set
     * @param {number | BigNumber} k    Number of objects in the subset
     * @return {number | BigNumber}     Number of possible combinations.
     */
    return typed(name, {
      'number, number': combinationsNumber,

      'BigNumber, BigNumber': function (n: BigNumberBinomialType, k: BigNumberBinomialType) {
        if (!isPositiveInteger(n) || !isPositiveInteger(k)) {
          throw new TypeError('Positive integer value expected in function combinations');
        }
        if (k.gt(n)) {
          throw new TypeError('k must be less than n in function combinations');
        }
        return binomialProductBigNumber(n, k);
      },

      // Collections map elementwise over whichever argument is the collection (as `permutations`
      // does); two collections are not zipped.
      'Array | Matrix, number | BigNumber': typed.referToSelf(
        (self: TypedFunction) =>
          (n: unknown[] | Matrix, k: number | BigNumberBinomialType): unknown[] | Matrix =>
            deepMap(n as unknown[], (nVal) => self(nVal, k)) as unknown[] | Matrix
      ),

      'number | BigNumber, Array | Matrix': typed.referToSelf(
        (self: TypedFunction) =>
          (n: number | BigNumberBinomialType, k: unknown[] | Matrix): unknown[] | Matrix =>
            deepMap(k as unknown[], (kVal) => self(n, kVal)) as unknown[] | Matrix
      ),
    });
  }
);
