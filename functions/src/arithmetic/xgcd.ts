import type { BigNumber as Decimal } from '@danielsimonjr/mathts-core';
import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';
import { xgcd as typedXgcd } from '../typed/arithmetic.js';

interface XgcdDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  matrix: (arr: unknown[]) => unknown;
  BigNumber?: new (value: string) => unknown;
}

const name = 'xgcd';
const dependencies = ['typed', 'config', 'matrix'];

function buildXgcd({ typed, config, matrix, BigNumber }: XgcdDependencies): TypedFunction {
  /**
   * Calculate the extended greatest common divisor for two values.
   * See https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm.
   *
   * The values come from the typed `xgcd`, the one implementation of the package: its Bezout
   * coefficients are exact integers for a number, a bigint, a BigNumber or a Fraction. This
   * function wraps the result in a matrix, as mathjs does, unless `config.matrix` is `'Array'`.
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
   * @param {number | BigNumber | Fraction} a  An integer number
   * @param {number | BigNumber | Fraction} b  An integer number
   * @return {Array | Matrix}   Returns an array containing 3 integers `[div, m, n]`
   *                            where `div = gcd(a, b)` and `a*m + b*n = div`
   */
  const wrap = (a: unknown, b: unknown): unknown => {
    const res = (typedXgcd as (x: unknown, y: unknown) => unknown[])(a, b);
    const values =
      BigNumber && typeof a === 'object' ? res.map((value) => new BigNumber(String(value))) : res;
    return config.matrix === 'Array' ? values : matrix(values);
  };

  return typed(name, {
    'number, number': wrap,
    'bigint, bigint': wrap,
    'number, bigint': wrap,
    'bigint, number': wrap,
    'BigNumber, BigNumber': wrap,
    ...(!BigNumber && { 'Fraction, Fraction': wrap }),
  }) as TypedFunction;
}

export const createXgcd = /* #__PURE__ */ factory(name, dependencies, buildXgcd);
/** Extended Euclid using the floating-point operations of mathjs. */
function mathjsXgcdNumber(a: number, b: number): number[] {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error('Parameters in function xgcd must be integer numbers');
  }
  let x = 1;
  let nextX = 0;
  let y = 0;
  let nextY = 1;
  while (b) {
    const quotient = Math.floor(a / b);
    [a, b] = [b, a - quotient * b];
    [x, nextX] = [nextX, x - quotient * nextX];
    [y, nextY] = [nextY, y - quotient * nextY];
  }
  return a < 0 ? [-a, -x, -y] : [a, a ? x : 0, y];
}

export const createSelectedXgcd = /* #__PURE__ */ factory(
  name,
  [...dependencies, 'BigNumber'],
  ({
    typed,
    config,
    matrix,
    BigNumber,
  }: Omit<XgcdDependencies, 'BigNumber'> & {
    BigNumber: new (value: number) => Decimal;
  }) => {
    const wrap = (values: unknown[]) => (config.matrix === 'Array' ? values : matrix(values));
    return typed(name, {
      'number, number': (a: number, b: number) => wrap(mathjsXgcdNumber(a, b)),
      'bigint, bigint': (a: bigint, b: bigint) =>
        wrap((typedXgcd as (x: unknown, y: unknown) => unknown[])(a, b)),
      'number, bigint': (a: number, b: bigint) =>
        wrap((typedXgcd as (x: unknown, y: unknown) => unknown[])(a, b)),
      'bigint, number': (a: bigint, b: number) =>
        wrap((typedXgcd as (x: unknown, y: unknown) => unknown[])(a, b)),
      'BigNumber, BigNumber': (a: Decimal, b: Decimal) => {
        if (!a.isInteger() || !b.isInteger())
          throw new Error('Parameters in function xgcd must be integer numbers');
        let x = new BigNumber(1),
          nextX = new BigNumber(0);
        let y = new BigNumber(0),
          nextY = new BigNumber(1);
        while (!b.isZero()) {
          const quotient = a.div(b).floor();
          let remainder = a.mod(b);
          if (remainder.isNegative() && !remainder.isZero()) remainder = remainder.plus(b.abs());
          [a, b] = [b, remainder];
          [x, nextX] = [nextX, x.minus(quotient.times(nextX))];
          [y, nextY] = [nextY, y.minus(quotient.times(nextY))];
        }
        return wrap(
          a.isNegative() && !a.isZero() ? [a.neg(), x.neg(), y.neg()] : [a, a.isZero() ? 0 : x, y]
        );
      },
    });
  }
);
