import { factory } from '../utils/factory.js';
import { isInteger } from '../utils/number.js';
import { product } from '../utils/product.js';
import type { TypedFunction } from '../core/function/typed.js';
import {
  binomialProductBigNumber,
  isPositiveInteger,
  type BigNumberBinomialType,
} from './bigint-binomial.js';

interface CombinationsWithRepDependencies {
  typed: TypedFunction;
}

const name = 'combinationsWithRep';
const dependencies = ['typed'];

export const createCombinationsWithRep = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: CombinationsWithRepDependencies) => {
    /**
     * Compute the number of ways of picking `k` unordered outcomes from `n`
     * possibilities, allowing individual outcomes to be repeated more than once.
     *
     * CombinationsWithRep only takes integer arguments.
     * The following condition must be enforced: k <= n + k -1.
     *
     * Syntax:
     *
     *     math.combinationsWithRep(n, k)
     *
     * Examples:
     *
     *    math.combinationsWithRep(7, 5) // returns 462
     *
     * See also:
     *
     *    combinations, permutations, factorial
     *
     * @param {number | BigNumber} n    Total number of objects in the set
     * @param {number | BigNumber} k    Number of objects in the subset
     * @return {number | BigNumber}     Number of possible combinations with replacement.
     */
    return typed(name, {
      'number, number': function (n: number, k: number): number {
        if (!isInteger(n) || n < 0) {
          throw new TypeError('Positive integer value expected in function combinationsWithRep');
        }
        if (!isInteger(k) || k < 0) {
          throw new TypeError('Positive integer value expected in function combinationsWithRep');
        }
        if (n < 1) {
          throw new TypeError('k must be less than or equal to n + k - 1');
        }

        if (k < n - 1) {
          const prodrange = product(n, n + k - 1);
          return prodrange / product(1, k);
        }
        const prodrange = product(k + 1, n + k - 1);
        return prodrange / product(1, n - 1);
      },

      'BigNumber, BigNumber': function (n: BigNumberBinomialType, k: BigNumberBinomialType) {
        const BigNumber = n.constructor;
        const one = new BigNumber(1);

        if (!isPositiveInteger(n) || !isPositiveInteger(k)) {
          throw new TypeError('Positive integer value expected in function combinationsWithRep');
        }
        if (n.lt(one)) {
          throw new TypeError(
            'k must be less than or equal to n + k - 1 in function combinationsWithRep'
          );
        }

        return binomialProductBigNumber(n.plus(k).minus(1), k);
      },
    });
  }
);
