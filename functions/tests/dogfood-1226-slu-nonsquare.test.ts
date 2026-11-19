/**
 * Dogfood #1226 - slu of a non-empty non-square sparse matrix.
 *
 * The CSparse LU is square-only, so slu throws the same RangeError as lusolve
 * (`Matrix must be square (size: [m, n])`) for every order, instead of an
 * internal TypeError. Square input and the empty factorization (#1209) are unchanged.
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
      expect(call).toThrow(`Matrix must be square (size: ${size})`);
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
    expect(call).toThrow('Matrix must be square (size: [2, 3])');
  });

  it('still validates order before the shape', () => {
    expect(() => slu(sparse([[1, 2, 3]]), 7, 1)).toThrow(/order must be an integer/);
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
