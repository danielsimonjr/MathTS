/**
 * Dogfood #1226 - slu of a non-empty non-square sparse matrix.
 *
 * The CSparse LU is square-only, so slu throws
 * `RangeError: Matrix must be square (size: [m, n]); use lup for a rectangular matrix`
 * for every order, instead of an internal TypeError. lusolve with order and threshold
 * throws its own solver RangeError (lstsq hint) before slu. Square input and the empty
 * factorization (#1209) are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { slu as sluFn, lusolve as lusolveFn, sparse } from '../src/factories/index.js';

type R = { L: { toArray(): unknown }; U: { toArray(): unknown }; p: number[]; q: number[] | null };
const slu = sluFn as (a: unknown, order: number, threshold: number) => R;
const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => unknown;

const shapes: Array<[string, number[][], string]> = [
  [
    '2x3',
    [
      [1, 2, 3],
      [4, 5, 6],
    ],
    '[2, 3]',
  ],
  [
    '3x2',
    [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
    '[3, 2]',
  ],
  ['1x3', [[1, 2, 3]], '[1, 3]'],
  ['3x1', [[1], [2], [3]], '[3, 1]'],
];

describe('#1226 slu of a non-square sparse matrix', () => {
  for (const [label, data, size] of shapes) {
    it.each([0, 1, 2, 3])(`${label} order %i throws the square RangeError`, (order) => {
      const call = () => slu(sparse(data), order, 1);
      expect(call).toThrow(RangeError);
      expect(call).toThrow(
        `Matrix must be square (size: ${size}); use lup for a rectangular matrix`
      );
    });
  }

  it('lusolve with order and threshold gives the square RangeError', () => {
    const call = () =>
      lusolve(
        sparse([
          [1, 2, 3],
          [4, 5, 6],
        ]),
        [1, 2],
        1,
        1
      );
    expect(call).toThrow(RangeError);
    expect(call).toThrow(
      'Matrix must be square (size: [2, 3]); for a rectangular least-squares system use lstsq'
    );
  });

  it('lusolve with order and threshold checks the shape before the order', () => {
    expect(() => lusolve(sparse([[1, 2, 3]]), [1], 7, 1)).toThrow(
      'Matrix must be square (size: [1, 3]); for a rectangular least-squares system use lstsq'
    );
  });

  it('still validates order before the shape', () => {
    expect(() => slu(sparse([[1, 2, 3]]), 7, 1)).toThrow(/order must be an integer/);
  });

  it('still validates threshold before the shape', () => {
    expect(() => slu(sparse([[1, 2, 3]]), 1, 5)).toThrow(
      'Partial pivoting threshold must be a number from 0 to 1'
    );
  });

  it('a 1x1 matrix factorizes', () => {
    const r = slu(sparse([[2]]), 0, 1);
    expect(r.L.toArray()).toEqual([[1]]);
    expect(r.U.toArray()).toEqual([[2]]);
    expect(r.p).toEqual([0]);
  });

  it.each([
    [2, 0],
    [0, 3],
  ])('an empty %ix%i matrix still returns the empty factorization (#1209)', (m, n) => {
    const a = sparse(m === 0 ? [] : Array.from({ length: m }, () => [] as number[]));
    if (n > 0) (a as { resize(size: number[]): void }).resize([m, n]);
    const r = slu(a, 1, 1);
    const k = Math.min(m, n);
    expect((r.L as unknown as { size(): number[] }).size()).toEqual([m, k]);
    expect((r.U as unknown as { size(): number[] }).size()).toEqual([k, n]);
    expect(r.p).toEqual(Array.from({ length: m }, (_, i) => i));
    expect(r.q).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  it('square input is unchanged', () => {
    const r = slu(
      sparse([
        [4, 3],
        [6, 3],
      ]),
      0,
      1
    );
    expect(r.U.toArray()).toEqual([
      [6, 3],
      [0, 1],
    ]);
    expect(r.p).toEqual([1, 0]);
  });
});
