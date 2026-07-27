import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';
import { xgcdNumber } from '../plain/number/index.js';

// Type definitions for xgcd
interface BigNumberType {
  isInt(): boolean;
  isZero(): boolean;
  lt(other: BigNumberType): boolean;
  neg(): BigNumberType;
  div(other: BigNumberType): BigNumberType;
  mod(other: BigNumberType): BigNumberType;
  floor(): BigNumberType;
  minus(other: BigNumberType): BigNumberType;
  times(other: BigNumberType): BigNumberType;
}

interface BigNumberConstructor {
  new (value: number): BigNumberType;
}

interface FractionType {
  isInteger(): boolean;
  isZero(): boolean;
  lessThan(other: FractionType): boolean;
  negate(): FractionType;
  divide(other: FractionType): FractionType;
  mod(other: FractionType): FractionType;
  floor(): FractionType;
  subtract(other: FractionType): FractionType;
  multiply(other: FractionType): FractionType;
}

interface FractionConstructor {
  new (num: number | bigint, den?: number | bigint): FractionType;
}

interface XgcdDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  matrix: (arr: unknown[]) => unknown;
  BigNumber: BigNumberConstructor;
  Fraction?: FractionConstructor;
}

const name = 'xgcd';
const dependencies = ['typed', 'config', 'matrix', 'BigNumber', '?Fraction'];

export const createXgcd = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, matrix, BigNumber, Fraction }: XgcdDependencies): TypedFunction => {
    /**
     * Calculate the extended greatest common divisor for two values.
     * See https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm.
     *
     * Syntax:
     *
     *    math.xgcd(a, b)
     *
     * Examples:
     *
     *    math.xgcd(8, 12)             // returns [4, -1, 1]
     *    math.gcd(8, 12)              // returns 4
     *    math.xgcd(36163, 21199)      // returns [1247, -7, 12]
     *
     * See also:
     *
     *    gcd, lcm
     *
     * @param {number | BigNumber} a  An integer number
     * @param {number | BigNumber} b  An integer number
     * @return {Array}              Returns an array containing 3 integers `[div, m, n]`
     *                              where `div = gcd(a, b)` and `a*m + b*n = div`
     */
    return typed(name, {
      'number, number': function (a: number, b: number): unknown {
        const res = xgcdNumber(a, b);

        return config.matrix === 'Array' ? res : matrix(res);
      },
      'BigNumber, BigNumber': _xgcdBigNumber,
      'Fraction, Fraction': _xgcdFraction,
    }) as TypedFunction;

    /**
     * Calculate xgcd for two Fractions
     * @param {Fraction} a
     * @param {Fraction} b
     * @return {Fraction[]} result
     * @private
     */
    function _xgcdFraction(a: FractionType, b: FractionType): unknown {
      if (!Fraction) {
        throw new Error('Fraction dependency is missing');
      }

      let // used to swap two variables
        t: FractionType;

      let // quotient
        q: FractionType;

      let // remainder
        r: FractionType;

      const zero = new Fraction(0n, 1n);
      const one = new Fraction(1n, 1n);
      let x: FractionType = zero;
      let lastx: FractionType = one;
      let y: FractionType = one;
      let lasty: FractionType = zero;

      if (!a.isInteger() || !b.isInteger()) {
        throw new Error('Parameters in function xgcd must be integer numbers');
      }

      while (!b.isZero()) {
        q = a.divide(b).floor();
        r = a.mod(b);

        t = x;
        x = lastx.subtract(q.multiply(x));
        lastx = t;

        t = y;
        y = lasty.subtract(q.multiply(y));
        lasty = t;

        a = b;
        b = r;
      }

      let res: FractionType[];
      if (a.lessThan(zero)) {
        res = [a.negate(), lastx.negate(), lasty.negate()];
      } else {
        res = [a, !a.isZero() ? lastx : zero, lasty];
      }
      return config.matrix === 'Array' ? res : matrix(res as unknown[]);
    }

    /**
     * Calculate xgcd for two BigNumbers
     * @param {BigNumber} a
     * @param {BigNumber} b
     * @return {BigNumber[]} result
     * @private
     */
    function _xgcdBigNumber(a: BigNumberType, b: BigNumberType): unknown {
      // source: https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
      let // used to swap two variables
        t: BigNumberType;

      let // quotient
        q: BigNumberType;

      let // remainder
        r: BigNumberType;

      const zero = new BigNumber(0);
      const one = new BigNumber(1);
      let x: BigNumberType = zero;
      let lastx: BigNumberType = one;
      let y: BigNumberType = one;
      let lasty: BigNumberType = zero;

      if (!a.isInt() || !b.isInt()) {
        throw new Error('Parameters in function xgcd must be integer numbers');
      }

      while (!b.isZero()) {
        q = a.div(b).floor();
        r = a.mod(b);

        t = x;
        x = lastx.minus(q.times(x));
        lastx = t;

        t = y;
        y = lasty.minus(q.times(y));
        lasty = t;

        a = b;
        b = r;
      }

      let res: (BigNumberType | number)[];
      if (a.lt(zero)) {
        res = [a.neg(), lastx.neg(), lasty.neg()];
      } else {
        res = [a, !a.isZero() ? lastx : 0, lasty];
      }
      return config.matrix === 'Array' ? res : matrix(res);
    }
  }
);
