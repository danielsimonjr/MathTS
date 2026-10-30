import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';
import { xgcdNumber } from '../plain/number/index.js';

// Type definitions for xgcd
interface BigNumberType {
  isInteger(): boolean;
  isZero(): boolean;
  lessThan(other: BigNumberType): boolean;
  negate(): BigNumberType;
  divide(other: BigNumberType): BigNumberType;
  mod(other: BigNumberType): BigNumberType;
  floor(): BigNumberType;
  subtract(other: BigNumberType): BigNumberType;
  times(other: BigNumberType): BigNumberType;
}

interface BigNumberConstructor {
  fromNumber(value: number): BigNumberType;
}

interface FractionType {
  isInteger(): boolean;
  isZero(): boolean;
  lessThan(other: FractionType): boolean;
  negate(): FractionType;
  divide(other: FractionType | number): FractionType;
  mod(other: FractionType): FractionType;
  floor(): FractionType;
  subtract(other: FractionType | number): FractionType;
  multiply(other: FractionType | number): FractionType;
}

interface FractionConstructor {
  new (numerator: number | bigint, denominator?: number | bigint): FractionType;
}

interface XgcdDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  matrix: (arr: unknown[]) => unknown;
  BigNumber: BigNumberConstructor;
  Fraction?: FractionConstructor;
}

interface XgcdRing<T> {
  from(v: 0 | 1): T;
  isInt(v: T): boolean;
  floorDiv(a: T, b: T): T;
  minus(a: T, b: T): T;
  times(a: T, b: T): T;
  lt(a: T, b: T): boolean;
  neg(a: T): T;
}

const name = 'xgcd';
const dependencies = ['typed', 'config', 'matrix', 'BigNumber', '?Fraction'];

const XGCD_INTEGER_MSG = 'Parameters in function xgcd must be integer numbers';

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
    const bigNumberRing: XgcdRing<BigNumberType> = {
      from: (v) => BigNumber.fromNumber(v),
      isInt: (v) => v.isInteger(),
      floorDiv: (a, b) => a.divide(b).floor(),
      minus: (a, b) => a.subtract(b),
      times: (a, b) => a.times(b),
      lt: (a, b) => a.lessThan(b),
      neg: (a) => a.negate(),
    };

    const typedSignatures: Record<string, unknown> = {
      'number, number': function (a: number, b: number): unknown {
        const res = xgcdNumber(a, b);

        return config.matrix === 'Array' ? res : matrix(res);
      },
      'BigNumber, BigNumber': _xgcdBigNumber,
    };

    if (Fraction) {
      typedSignatures['Fraction, Fraction'] = _xgcdFraction;
    }

    return typed(name, typedSignatures) as TypedFunction;

    function _xgcdRing<T extends { isZero(): boolean; mod(b: T): T }>(
      ring: XgcdRing<T>,
      a: T,
      b: T
    ): unknown {
      // source: https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
      let t: T;
      let q: T;
      let r: T;

      const zero = ring.from(0);
      const one = ring.from(1);
      let x: T = zero;
      let lastx: T = one;
      let y: T = one;
      let lasty: T = zero;

      if (!ring.isInt(a) || !ring.isInt(b)) {
        throw new Error(XGCD_INTEGER_MSG);
      }

      while (!b.isZero()) {
        q = ring.floorDiv(a, b);
        r = a.mod(b);

        t = x;
        x = ring.minus(lastx, ring.times(q, x));
        lastx = t;

        t = y;
        y = ring.minus(lasty, ring.times(q, y));
        lasty = t;

        a = b;
        b = r;
      }

      let res: (T | number)[];
      if (ring.lt(a, zero)) {
        res = [ring.neg(a), ring.neg(lastx), ring.neg(lasty)];
      } else {
        res = [a, !a.isZero() ? lastx : 0, lasty];
      }
      return config.matrix === 'Array' ? res : matrix(res);
    }

    function _xgcdBigNumber(a: BigNumberType, b: BigNumberType): unknown {
      return _xgcdRing(bigNumberRing, a, b);
    }

    function _xgcdFraction(a: FractionType, b: FractionType): unknown {
      if (!Fraction) {
        throw new Error('Fraction is not available');
      }

      const fractionRing: XgcdRing<FractionType> = {
        from: (v) => new Fraction(v),
        isInt: (v) => v.isInteger(),
        floorDiv: (a, b) => a.divide(b).floor(),
        minus: (a, b) => a.subtract(b),
        times: (a, b) => a.multiply(b),
        lt: (a, b) => a.lessThan(b),
        neg: (a) => a.negate(),
      };

      return _xgcdRing(fractionRing, a, b);
    }
  }
);
