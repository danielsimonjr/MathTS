/**
 * #1259 in core: the modulus of a Complex, `BigNumber.hypotN`, `norm2` and `scaledDistance`
 * follow the IEEE 754 rule of `hypot`. An infinite value gives +Infinity, also with a NaN.
 * Else a NaN value gives NaN. The oracle is `Math.hypot`.
 *
 * mathjs 15.2.0 gives NaN for the modulus of `Infinity + NaN i` and for a pair of infinite
 * parts. MathTS deviates from mathjs on purpose (lead ruling: one rule on every path).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '../src/types/complex.js';
import { BigNumber } from '../src/types/bignumber.js';
import { norm2, scaledDistance } from '../src/numeric/stable.js';

const pairs: Array<[number, number]> = [
  [Infinity, NaN],
  [-Infinity, NaN],
  [NaN, Infinity],
  [NaN, -Infinity],
  [Infinity, Infinity],
  [-Infinity, Infinity],
  [Infinity, 0],
  [0, -Infinity],
  [Infinity, 5],
  [3, NaN],
  [NaN, 4],
  [1e200, NaN],
  [NaN, 1e-200],
  [NaN, NaN],
  [NaN, 0],
  [0, NaN],
  [3, 4],
  [1e200, 1e200],
  [1e-200, 1e-200],
  [1e-320, 0],
];

const lists: number[][] = [
  [Infinity, NaN],
  [NaN, Infinity],
  [NaN, 1, -Infinity],
  [Infinity, Infinity],
  [3, 4, Infinity, -Infinity],
  [NaN, 1],
  [3, 4],
  [],
];

describe('Complex.abs follows the IEEE rule (#1259)', () => {
  it.each(pairs)('abs(%s + %s i)', (re, im) => {
    expect(new Complex(re, im).abs()).toBe(Math.hypot(re, im));
  });

  it.each([
    [Infinity, NaN],
    [NaN, -Infinity],
  ])('log(%s + %s i) has the real part Infinity (it reads the modulus)', (re, im) => {
    expect(new Complex(re, im).log().re).toBe(Infinity);
  });
});

describe('BigNumber.hypotN follows the IEEE rule (#1259)', () => {
  it.each(lists)('hypotN(%s, ...)', (...xs) => {
    const r = BigNumber.hypotN(xs.map((x) => BigNumber.fromNumber(x)));
    expect(r.toNumber()).toBe(Math.hypot(...xs));
  });
});

describe('norm2 and scaledDistance follow the IEEE rule (#1259)', () => {
  it.each(lists)('norm2(%s, ...)', (...xs) => {
    expect(norm2(xs)).toBe(Math.hypot(...xs));
    expect(norm2(new Float64Array(xs))).toBe(Math.hypot(...xs));
  });

  it.each(lists)('scaledDistance(%s, ..., 0)', (...xs) => {
    const zeros = xs.map(() => 0);
    expect(scaledDistance(xs, zeros)).toBe(Math.hypot(...xs));
  });
});
