import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

// Type definitions for invmod
interface InvmodDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  xgcd: TypedFunction;
  equal: TypedFunction;
  smaller: TypedFunction;
  mod: TypedFunction;
  add: TypedFunction;
  isInteger: (x: unknown) => boolean;
  BigNumber?: new (value: number) => unknown;
}

const name = 'invmod';
const dependencies = ['typed', 'config', 'xgcd', 'equal', 'smaller', 'mod', 'add', 'isInteger'];

function buildInvmod({
  typed,
  xgcd,
  equal,
  smaller,
  mod,
  add,
  isInteger,
  BigNumber,
}: InvmodDependencies): TypedFunction {
  /**
   * Calculate the (modular) multiplicative inverse of a modulo b. Solution to the equation `ax ≣ 1 (mod b)`
   * See https://en.wikipedia.org/wiki/Modular_multiplicative_inverse.
   *
   * Syntax:
   *
   *    math.invmod(a, b)
   *
   * Examples:
   *
   *    math.invmod(8, 12)             // returns NaN
   *    math.invmod(7, 13)             // returns 2
   *    math.invmod(15151, 15122)      // returns 10429
   *
   * See also:
   *
   *    gcd, xgcd
   *
   * @param {number | BigNumber} a  An integer number
   * @param {number | BigNumber} b  An integer number
   * @return {number | BigNumber }  Returns an integer number
   *                              where `invmod(a,b)*a ≣ 1 (mod b)`
   */
  return typed(name, {
    'number, number': invmod,
    'BigNumber, BigNumber': invmod,
  }) as TypedFunction;

  function invmod(a: unknown, b: unknown): unknown {
    if (!isInteger(a) || !isInteger(b))
      throw new Error('Parameters in function invmod must be integer numbers');
    a = mod(a, b);
    if (equal(b, 0)) throw new Error('Divisor must be non zero');
    const res = xgcd(a, b) as { valueOf(): unknown[] };
    const resVal = res.valueOf();
    const [gcd, invValue] = resVal;
    const one = BigNumber ? new BigNumber(1) : 1;
    const zero = BigNumber ? new BigNumber(0) : 0;
    if (!equal(gcd, one)) return NaN;
    let inv = mod(invValue, b);
    if (smaller(inv, zero)) inv = add(inv, b);
    return inv;
  }
}

export const createInvmod = /* #__PURE__ */ factory(name, dependencies, buildInvmod);
export const createSelectedInvmod = /* #__PURE__ */ factory(
  name,
  [...dependencies, 'BigNumber'],
  buildInvmod
);
