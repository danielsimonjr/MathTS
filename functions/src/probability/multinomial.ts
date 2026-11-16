import { deepForEach } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import { multinomialExact } from './multinomial-exact.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for multinomial
interface MultinomialDependencies {
  typed: TypedFunction;
  add: TypedFunction;
  divide: TypedFunction;
  multiply: TypedFunction;
  factorial: TypedFunction;
  isInteger: TypedFunction;
  isPositive: TypedFunction;
}

const name = 'multinomial';
const dependencies = ['typed', 'add', 'divide', 'multiply', 'factorial', 'isInteger', 'isPositive'];

export const createMultinomial = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, add, divide, multiply, factorial, isInteger, isPositive }: MultinomialDependencies) => {
    /**
     * Multinomial Coefficients compute the number of ways of picking a1, a2, ..., ai unordered outcomes from `n` possibilities.
     *
     * multinomial takes one array of integers as an argument.
     * The following condition must be enforced: every ai <= 0
     *
     * Syntax:
     *
     *     math.multinomial(a) // a is an array type
     *
     * Examples:
     *
     *    math.multinomial([1,2,1]) // returns 12
     *
     * See also:
     *
     *    combinations, factorial
     *
     * @param {number[] | BigNumber[]} a    Integer numbers of objects in the subset
     * @return {Number | BigNumber}         Multinomial coefficient.
     */
    return typed(name, {
      'Array | Matrix': function (a: unknown[] | object): unknown {
        const parts: unknown[] = [];
        let allNumbers = true;
        deepForEach(a as unknown[], function (ai: unknown) {
          if (!isInteger(ai) || !isPositive(ai)) {
            throw new TypeError('Positive integer value expected in function multinomial');
          }
          if (typeof ai !== 'number') allNumbers = false;
          parts.push(ai);
        });
        // Plain numbers use the exact kernel of the typed function, so parse() and
        // evaluate() agree (#1001). Other entry types (BigNumber, boolean) keep the
        // generic path.
        if (allNumbers) return multinomialExact(parts as number[]);

        let sum: unknown = 0;
        let denom: unknown = 1;
        for (const ai of parts) {
          sum = add(sum, ai);
          denom = multiply(denom, factorial(ai));
        }
        return divide(factorial(sum), denom);
      },
    });
  }
);
