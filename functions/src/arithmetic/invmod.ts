import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

// Type definitions for invmod
interface InvmodDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  xgcd: TypedFunction;

  mod: TypedFunction;

  isInteger: (x: unknown) => boolean;
  BigNumber?: new (value: number) => unknown;

  equalScalar: TypedFunction;

  isZero: TypedFunction;
}

const name = 'invmod';
const dependencies = [
  'typed',
  'config',
  'BigNumber',
  'xgcd',
  'equalScalar',
  'mod',
  'isInteger',
  'isZero',
];

function buildInvmod({
  typed,
  xgcd,
  equalScalar,
  mod,
  isInteger,
  isZero,
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
    'bigint, bigint': invmodUnchecked,
    'number | BigNumber, number | BigNumber | bigint': invmod,
    'bigint, number | BigNumber': invmod,
  }) as TypedFunction;

  function invmod(a: unknown, b: unknown): unknown {
    if (!isInteger(a) || !isInteger(b)) {
      throw new Error(`Arguments of invmod must be integers, not ${String(a)} and ${String(b)}`);
    }
    return invmodUnchecked(a, b);
  }

  function invmodUnchecked(a: unknown, b: unknown): unknown {
    if (isZero(b)) return NaN;
    a = mod(a, b); // reduce the size of the problem
    const res = xgcd(a, b) as { valueOf(): unknown[] };
    const [gcd, invValue] = res.valueOf();
    if (!equalScalar(gcd, 1)) return NaN;
    // Make sure we end up in the proper value range mod b (#3710)
    return mod(invValue, b);
  }
}

export const createInvmod = /* #__PURE__ */ factory(name, dependencies, buildInvmod);
export const createSelectedInvmod = /* #__PURE__ */ factory(name, dependencies, buildInvmod);
