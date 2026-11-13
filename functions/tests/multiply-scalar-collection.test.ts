/**
 * #911: `multiply(Unit, number[])` threw "Too few arguments".
 *
 * Root cause: the scalar x collection signatures of `multiply` named `number` as the
 * only scalar. A `Unit`, `Complex`, `Fraction` or `BigNumber` scalar had no signature
 * against an array or a matrix, in either order. Each of them now scales a collection
 * element by element, the way `number` already did.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction, Unit } from '@danielsimonjr/mathts-core';
import { add, multiply, matrix, sparse } from '../src/index.js';

const mul = multiply as unknown as (a: unknown, b: unknown) => unknown;
const plus = add as unknown as (a: unknown, b: unknown) => unknown;
const m = (n: number): Unit => new Unit(n, 'm');

function texts(value: unknown): string[] {
  expect(Array.isArray(value)).toBe(true);
  return (value as unknown[]).map(String);
}

describe('multiply: a Unit scales an array or a matrix (#911)', () => {
  it('scales a number array by a Unit, in either order', () => {
    expect(texts(mul(m(2), [1, 2, 3]))).toEqual(['2 m', '4 m', '6 m']);
    expect(texts(mul([1, 2, 3], m(2)))).toEqual(['2 m', '4 m', '6 m']);
  });

  it('scales a nested array by a Unit', () => {
    const out = mul(m(2), [
      [1, 2],
      [3, 4],
    ]) as unknown[][];
    expect(out.map((row) => row.map(String))).toEqual([
      ['2 m', '4 m'],
      ['6 m', '8 m'],
    ]);
  });

  it('keeps the dimension rule when the elements carry units', () => {
    expect(texts(mul(m(2), [new Unit(3, 's')]))).toEqual(['6 m s']);
    // The operand order sets the order of the factors, as for two scalar Units.
    expect(texts(mul([new Unit(3, 's')], m(2)))).toEqual(['6 s m']);
    expect(String(mul(new Unit(3, 's'), m(2)))).toBe('6 s m');
  });

  it('scales a matrix by a Unit and returns a matrix', () => {
    const left = mul(m(2), matrix([1, 2, 3])) as { toArray(): unknown[]; constructor: unknown };
    const right = mul(matrix([1, 2, 3]), m(2)) as { toArray(): unknown[] };
    expect(left.toArray().map(String)).toEqual(['2 m', '4 m', '6 m']);
    expect(right.toArray().map(String)).toEqual(['2 m', '4 m', '6 m']);
    expect(Array.isArray(left)).toBe(false);
  });

  it('matches the per-element map that the issue gives as its workaround', () => {
    const scaled = mul(m(2), [1.5, -2, 0]) as Unit[];
    const mapped = [1.5, -2, 0].map((x) => mul(x, m(2)) as Unit);
    expect(scaled.map((u) => u.toNumeric('m'))).toEqual(mapped.map((u) => u.toNumeric('m')));
  });

  it('keeps the dimension check of add on the unit array that multiply returns', () => {
    const lengths = mul(m(1), [1, 2]);
    const times = mul(new Unit(1, 's'), [1, 2]);
    expect(() => plus(lengths, times)).toThrow(/different dimensions/);
    expect(texts(plus(lengths, lengths))).toEqual(['2 m', '4 m']);
  });

  it('leaves the number x array path as it was', () => {
    expect(mul(2, [1, 2, 3])).toEqual([2, 4, 6]);
    expect(mul([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
});

describe('multiply: every non-number scalar scales a collection (#911 class)', () => {
  it('scales an array by a Complex, in either order', () => {
    const z = new Complex(1, 1);
    const left = mul(z, [1, 2]) as Complex[];
    const right = mul([1, 2], z) as Complex[];
    expect(left.map((c) => [c.re, c.im])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(right.map((c) => [c.re, c.im])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('scales an array by a Fraction and by a BigNumber', () => {
    const half = new Fraction(1, 2);
    const scaledFraction = mul(half, [2, 4]) as Fraction[];
    expect(scaledFraction.map(String)).toEqual(['1', '2']);
    const ten = new BigNumber('10');
    const scaledBig = mul([1, 2], ten) as BigNumber[];
    expect(scaledBig.map(String)).toEqual(['10', '20']);
  });

  it('keeps a sparse matrix sparse when a Complex scales it', () => {
    const out = mul(
      new Complex(2, 0),
      sparse([
        [1, 0],
        [0, 3],
      ])
    ) as { storage(): string; toArray(): unknown[][] };
    expect(out.storage()).toBe('sparse');
    expect((out.toArray()[1][1] as Complex).re).toBe(6);
  });

  it('scales a matrix by a Complex', () => {
    const out = mul(new Complex(0, 1), matrix([1, 2])) as { toArray(): Complex[] };
    expect(out.toArray().map((c) => [c.re, c.im])).toEqual([
      [0, 1],
      [0, 2],
    ]);
  });
});
