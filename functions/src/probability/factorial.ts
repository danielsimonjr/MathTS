import { deepMap } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for factorial
interface BigNumberType {
  add(n: number): BigNumberType;
  isNegative(): boolean;
  isInteger(): boolean;
  isFinite(): boolean;
  toNumber(): number;
}

interface BigNumberConstructor {
  fromNumber(n: number): BigNumberType;
}

interface FactorialDependencies {
  typed: TypedFunction;
  gamma: TypedFunction;
  BigNumber?: BigNumberConstructor;
}

const name = 'factorial';
const dependencies = ['typed', 'gamma', '?BigNumber'];

export const createFactorial = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, gamma, BigNumber }: FactorialDependencies) => {
    /**
     * Compute the factorial of a value
     *
     * Factorial only supports an integer value as argument.
     * For matrices, the function is evaluated element wise.
     *
     * Syntax:
     *
     *    math.factorial(n)
     *
     * Examples:
     *
     *    math.factorial(5)    // returns 120
     *    math.factorial(3)    // returns 6
     *
     * See also:
     *
     *    combinations, combinationsWithRep, gamma, permutations
     *
     * @param {number | BigNumber | Array | Matrix} n   An integer number
     * @return {number | BigNumber | Array | Matrix}    The factorial of `n`
     */
    return typed(name, {
      number: function (n: number): number {
        if (n < 0) {
          throw new Error('Value must be non-negative');
        }

        return gamma(n + 1) as number;
      },

      BigNumber: function (n: BigNumberType): unknown {
        if (n.isNegative()) {
          throw new Error('Value must be non-negative');
        }

        if (n.isFinite() && !n.isInteger()) {
          throw new Error('Integer BigNumber expected');
        }

        // `add` rounds to the precision, so an n with more digits than the precision gave the
        // factorial of the rounded n + 1: at precision 5, factorial(100000) was 99999!. The
        // BigNumber constructor is an optional dependency, so a scope without it keeps `add`.
        const value = n.toNumber();
        return gamma(
          BigNumber && Number.isSafeInteger(value) ? BigNumber.fromNumber(value + 1) : n.add(1)
        );
      },

      'Array | Matrix': typed.referToSelf(
        (self: TypedFunction): ((n: unknown) => unknown) =>
          (n: unknown): unknown =>
            deepMap(n as unknown[], self)
      ),
    });
  }
);

export const createSelectedFactorial = /* #__PURE__ */ factory(
  name,
  ['typed', 'gamma'],
  (deps: FactorialDependencies) => createFactorial({ ...deps })
);
