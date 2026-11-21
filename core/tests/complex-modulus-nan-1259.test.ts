/**
 * #1259, same mechanism in `Complex`: the modulus of a number with a NaN part is NaN.
 *
 * `hypotFast` fell through to `Math.hypot`, which follows IEEE 754: an infinite part gives
 * Infinity even when the other part is NaN. So `abs(Infinity + NaN i)` was Infinity, and `log`
 * and `sqrt`, which read the modulus, had an Infinity part. mathjs 15.2.0 gives NaN for the modulus
 * and NaN + NaN i for `log` and `sqrt` (the values below were read from it).
 *
 * Rows that keep their value, with the reason: an infinite part with a zero or finite other part
 * has the modulus Infinity, and so has a pair of infinite parts (the IEEE value; mathjs gives NaN
 * there through a scaling step of complex.js, and the design of `hypotFast` keeps the IEEE value).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '../src/types/complex.js';

const nanRows: Array<[number, number]> = [
  [Infinity, NaN],
  [-Infinity, NaN],
  [NaN, Infinity],
  [NaN, -Infinity],
];

describe('the modulus of a Complex with a NaN part (#1259)', () => {
  it.each(nanRows)('abs(%s + %s i) is NaN', (re, im) => {
    expect(new Complex(re, im).abs()).toBeNaN();
  });

  it.each(nanRows)('log(%s + %s i) is NaN + NaN i', (re, im) => {
    const z = new Complex(re, im).log();
    expect(z.re).toBeNaN();
    expect(z.im).toBeNaN();
  });

  it.each(nanRows)('sqrt(%s + %s i) is NaN + NaN i', (re, im) => {
    const z = new Complex(re, im).sqrt();
    expect(z.re).toBeNaN();
    expect(z.im).toBeNaN();
  });

  it('a finite part with a NaN part is NaN, in the fast path and in the slow path', () => {
    expect(new Complex(3, NaN).abs()).toBeNaN();
    expect(new Complex(NaN, 4).abs()).toBeNaN();
    expect(new Complex(1e200, NaN).abs()).toBeNaN();
    expect(new Complex(NaN, 1e-200).abs()).toBeNaN();
    expect(new Complex(NaN, NaN).abs()).toBeNaN();
    expect(new Complex(NaN, 0).abs()).toBeNaN();
    expect(new Complex(0, NaN).abs()).toBeNaN();
  });
});

describe('the modulus keeps its value where no part is NaN (pins)', () => {
  it.each([
    [Infinity, 0, Infinity],
    [0, -Infinity, Infinity],
    [Infinity, 5, Infinity],
    [-Infinity, -Infinity, Infinity],
    [3, 4, 5],
    [1e200, 1e200, 1.414213562373095e200],
    [1e-200, 1e-200, 1.414213562373095e-200],
    [1e-320, 0, 1e-320],
  ])('abs(%s + %s i) is %s', (re, im, want) => {
    expect(new Complex(re, im).abs()).toBe(want);
  });
});
