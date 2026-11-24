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
    'BigNumber, BigNumber': wrap,
    ...(!BigNumber && { 'Fraction, Fraction': wrap }),
  }) as TypedFunction;
}

export const createXgcd = /* #__PURE__ */ factory(name, dependencies, buildXgcd);
export const createSelectedXgcd = /* #__PURE__ */ factory(
  name,
  [...dependencies, 'BigNumber'],
  buildXgcd
);
