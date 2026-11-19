/**
 * Dogfood #1205 — qr of an empty matrix.
 *
 * qr returns the complete factorization: Q is m x m and R is m x n. An empty
 * input follows the same rule (NumPy `mode='complete'`). A matrix with no rows
 * gives a 0 x 0 Q and an R of the input size. A matrix with m rows and no columns gives the m x m
 * identity Q and an m x 0 R. No input throws an internal error.
 */

import { describe, it, expect } from 'vitest';
import { qr as qrFn, matrix, zeros } from '../src/factories/index.js';

const qr = qrFn as (x: unknown) => { Q: unknown; R: unknown };

describe('#1205 qr of an empty matrix', () => {
  it('Array [] gives empty Q and R', () => {
    expect(qr([])).toEqual({ Q: [], R: [] });
  });

  it('Array [[]] (1 x 0) gives Q = [[1]] and R = [[]]', () => {
    expect(qr([[]])).toEqual({ Q: [[1]], R: [[]] });
  });

  it('Array [[], [], []] (3 x 0) gives the 3 x 3 identity and a 3 x 0 R', () => {
    expect(qr([[], [], []])).toEqual({
      Q: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      R: [[], [], []],
    });
  });

  it('DenseMatrix matrix([]) gives a 0 x 0 Q and an R of the input size', () => {
    type M = { valueOf(): unknown; size(): number[] };
    const r = qr(matrix([])) as { Q: M; R: M };
    expect(r.Q.valueOf()).toEqual([]);
    expect(r.R.valueOf()).toEqual([]);
    expect(r.Q.size()).toEqual([0, 0]);
    expect(r.R.size()).toEqual([0]);
  });

  it('DenseMatrix matrix([[]]) keeps the shapes', () => {
    const r = qr(matrix([[]])) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([1, 1]);
    expect(r.R.size()).toEqual([1, 0]);
  });

  it('DenseMatrix matrix([[], [], []]) gives a 3 x 3 Q and a 3 x 0 R', () => {
    const r = qr(matrix([[], [], []])) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([3, 3]);
    expect(r.R.size()).toEqual([3, 0]);
  });

  it.each(['dense', 'sparse'])('%s zeros(0, 3) gives a 0 x 0 Q and a 0 x 3 R', (format) => {
    const r = qr(zeros([0, 3], format)) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([0, 0]);
    expect(r.R.size()).toEqual([0, 3]);
  });

  it.each(['dense', 'sparse'])('%s zeros(3, 0) gives a 3 x 3 Q and a 3 x 0 R', (format) => {
    const r = qr(zeros([3, 0], format)) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([3, 3]);
    expect(r.R.size()).toEqual([3, 0]);
  });

  it('DenseMatrix zeros(0, 0) gives a 0 x 0 Q and a 0 x 0 R', () => {
    const r = qr(zeros([0, 0], 'dense')) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([0, 0]);
    expect(r.R.size()).toEqual([0, 0]);
  });

  it('a non-empty input is unchanged', () => {
    const A = [
      [3, 0],
      [4, 5],
    ];
    const r = qr(A) as { Q: number[][]; R: number[][] };
    expect(Math.abs(r.R[0][0])).toBeCloseTo(5);
    expect(Math.abs(r.R[1][1])).toBeCloseTo(3);
    const { Q, R } = r;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect(Q[i][0] * R[0][j] + Q[i][1] * R[1][j]).toBeCloseTo(A[i][j]);
      }
    }
  });
});
