/**
 * Issue #960 — `divide(scalar, M)` is `multiply(scalar, inv(M))` for a square M (mathjs parity).
 *
 * Non-square input throws mathjs's RangeError. Scalar-over-collection for vectors is no longer
 * a dispatch error. Collection / scalar broadcasting (#911) is unchanged.
 */

import { describe, it, expect } from 'vitest';
import { divide, multiply, inv, matrix } from '../src/index.js';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

type Fn = (...args: unknown[]) => unknown;
const divideFn = divide as unknown as Fn;
const multiplyFn = multiply as unknown as Fn;
const invFn = inv as unknown as Fn;

const M = [
  [1, 2],
  [3, 4],
];

describe('dogfood #960 divide(scalar, square matrix) equals multiply(scalar, inv(matrix))', () => {
  it('number scalar on an Array matches mathjs [[-4, 2], [3, -1]]', () => {
    expect(divideFn(2, M)).toEqual([
      [-4, 2],
      [3, -1],
    ]);
  });

  it('number scalar on a DenseMatrix equals multiply(s, inv(M))', () => {
    const A = matrix(M);
    const expected = multiplyFn(2, invFn(A));
    expect(divideFn(2, A)).toEqual(expected);
  });

  it.each([
    ['number', 2],
    ['Complex', Complex.fromNumber(0).add(new Complex(0, 1))],
    ['Fraction', new Fraction(1, 3)],
    ['BigNumber', new BigNumber('0.5')],
  ])('%s scalar equals multiply(s, inv(M)) on an Array', (_name, s) => {
    expect(divideFn(s, M)).toEqual(multiplyFn(s, invFn(M)));
  });

  it('a Unit scalar equals multiply(s, inv(M)) on a DenseMatrix', async () => {
    const { Unit } = await import('@danielsimonjr/mathts-core');
    const s = new (Unit as unknown as new (v: number, u: string) => unknown)(2, 'm');
    const A = matrix(M);
    expect(divideFn(s, A)).toEqual(multiplyFn(s, invFn(A)));
  });

  it('a non-square Array throws mathjs RangeError text (2 x 3)', () => {
    expect(() => divideFn(2, [[1, 2, 3]])).toThrow(RangeError);
    expect(() => divideFn(2, [[1, 2, 3]])).toThrow('Matrix must be square (size: [1, 3])');
  });

  it('a vector throws the mathjs text (size: [2])', () => {
    expect(() => divideFn(2, [1, 2])).toThrow('Matrix must be square (size: [2])');
  });

  it('a singular square matrix propagates the inverse error of inv', () => {
    const singular = [
      [1, 2],
      [2, 4],
    ];
    let expected = '';
    try {
      invFn(singular);
    } catch (e) {
      expected = (e as Error).message;
    }
    expect(expected).not.toBe('');
    expect(() => divideFn(2, singular)).toThrow(expected);
  });

  it('collection / scalar broadcasting is unchanged (#911)', () => {
    expect(divideFn([2, 4], 2)).toEqual([1, 2]);
  });
});
