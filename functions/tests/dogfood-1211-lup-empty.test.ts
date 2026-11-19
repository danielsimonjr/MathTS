/**
 * Dogfood #1211 — lup of an empty matrix.
 *
 * For an m x n input with a zero dimension, L is m x k and U is k x n
 * (k = min(m, n)), and p is the identity on the m rows. This is the shape
 * that slu (#1209) and qr (#1205) return. Array input returns nested Arrays
 * that keep the shape (a 1 x 0 L is [[]]), as the non-empty Array path does.
 * size() never holds undefined.
 */

import { describe, it, expect } from 'vitest';
import { lup as lupFn, matrix, zeros, lusolve, det, inv } from '../src/factories/index.js';

type M = { valueOf(): unknown; size(): number[] };
type R = { L: unknown; U: unknown; p: number[] };
const lup = lupFn as (x: unknown) => R;

function sizes(x: unknown): [number[], number[]] {
  const r = lup(x) as unknown as { L: M; U: M };
  return [r.L.size(), r.U.size()];
}

describe('#1211 lup of an empty matrix', () => {
  it('Array [] gives empty L and U and an empty p', () => {
    expect(lup([])).toEqual({ L: [], U: [], p: [] });
  });

  it('Array [[]] (1 x 0) keeps the 1 x 0 shape of L', () => {
    expect(lup([[]])).toEqual({ L: [[]], U: [], p: [0] });
  });

  it('Array [[], [], []] (3 x 0) keeps the 3 x 0 shape of L', () => {
    expect(lup([[], [], []])).toEqual({ L: [[], [], []], U: [], p: [0, 1, 2] });
  });

  it('DenseMatrix matrix([]) has sizes without undefined', () => {
    const [ls, us] = sizes(matrix([]));
    expect(ls).toEqual([0, 0]);
    expect(us).toEqual([0, 0]);
    expect(lup(matrix([])).p).toEqual([]);
  });

  it('DenseMatrix matrix([[]]) gives L 1 x 0 and U 0 x 0 that keep their Array shape', () => {
    const r = lup(matrix([[]])) as unknown as { L: M; U: M; p: number[] };
    expect(r.L.size()).toEqual([1, 0]);
    expect(r.U.size()).toEqual([0, 0]);
    expect(r.L.valueOf()).toEqual([[]]);
    expect(r.U.valueOf()).toEqual([]);
    expect(r.p).toEqual([0]);
  });

  it('DenseMatrix 3 x 0 keeps the row count of L in valueOf', () => {
    const r = lup(zeros(3, 0)) as unknown as { L: M; U: M; p: number[] };
    expect(r.L.size()).toEqual([3, 0]);
    expect(r.U.size()).toEqual([0, 0]);
    expect(r.L.valueOf()).toEqual([[], [], []]);
    expect(r.p).toEqual([0, 1, 2]);
  });

  it('DenseMatrix 0 x 3 gives L 0 x 0 and U 0 x 3', () => {
    const [ls, us] = sizes(zeros(0, 3));
    expect(ls).toEqual([0, 0]);
    expect(us).toEqual([0, 3]);
  });

  it('SparseMatrix empty inputs give L m x k and U k x n', () => {
    expect(sizes(matrix([], 'sparse'))).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(sizes(matrix([[]], 'sparse'))).toEqual([
      [1, 0],
      [0, 0],
    ]);
    expect(sizes(zeros([3, 0], 'sparse'))).toEqual([
      [3, 0],
      [0, 0],
    ]);
    expect(sizes(zeros([0, 3], 'sparse'))).toEqual([
      [0, 0],
      [0, 3],
    ]);
  });

  it('lusolve, det and inv of the empty inputs stay as before', () => {
    expect(() => (lusolve as (a: unknown, b: unknown) => unknown)([], [])).toThrow(/singular/);
    expect((det as (a: unknown) => unknown)([])).toBe(1);
    expect((det as (a: unknown) => unknown)([[]])).toBe(1);
    expect(() => (inv as (a: unknown) => unknown)([])).toThrow(/square/);
  });

  it('a non-empty 1-D input throws the two-dimensional RangeError', () => {
    expect(() => lup([1, 2])).toThrow(RangeError);
    expect(() => lup([1, 2])).toThrow('Matrix must be two dimensional (size: [2])');
    expect(() => lup(matrix([1, 2]))).toThrow('Matrix must be two dimensional (size: [2])');
  });

  it('a 3-D input throws the two-dimensional RangeError', () => {
    const a = [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ];
    expect(() => lup(a)).toThrow('Matrix must be two dimensional (size: [2, 2, 2])');
    expect(() => lup(matrix(a))).toThrow(RangeError);
  });

  it('a non-empty 2-D input keeps its factorization', () => {
    expect(
      lup([
        [2, 1],
        [4, 3],
      ])
    ).toEqual({
      L: [
        [1, 0],
        [0.5, 1],
      ],
      U: [
        [4, 3],
        [0, -0.5],
      ],
      p: [1, 0],
    });
  });
});
