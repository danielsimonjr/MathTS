/**
 * Dogfood #1209 - slu of an empty matrix.
 *
 * slu returns the same empty factorization as lup: for an m x n input with
 * k = min(m, n), L is m x k, U is k x n, p is the identity on the m rows and
 * q is the identity on the n columns (null for order 0). No input throws the
 * internal "Cannot transpose a 2D matrix with no columns" error.
 */
import { describe, it, expect } from 'vitest';
import { slu as sluFn, lusolve as lusolveFn, sparse, zeros } from '../src/factories/index.js';

type Sz = { size(): number[] };
type R = { L: Sz; U: Sz; p: number[]; q: number[] | null };
const slu = sluFn as (a: unknown, order: number, threshold: number) => R;
const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => unknown;
const empty = (m: number, n: number) => zeros([m, n], 'sparse');

describe('#1209 slu of an empty matrix', () => {
  it.each([0, 1, 2, 3])('sparse([]) order %i gives 0x0 L and U', (order) => {
    const r = slu(sparse([]), order, 1);
    expect(r.L.size()).toEqual([0, 0]);
    expect(r.U.size()).toEqual([0, 0]);
    expect(r.p).toEqual([]);
    expect(r.q).toEqual(order === 0 ? null : []);
  });

  it.each([0, 1, 2, 3])('sparse([[]]) (1x0) order %i', (order) => {
    const r = slu(sparse([[]]), order, 1);
    expect(r.L.size()).toEqual([1, 0]);
    expect(r.U.size()).toEqual([0, 0]);
    expect(r.p).toEqual([0]);
    expect(r.q).toEqual(order === 0 ? null : []);
  });

  it.each([0, 1, 2, 3])('sparse([[],[],[]]) (3x0) order %i', (order) => {
    const r = slu(sparse([[], [], []]), order, 1);
    expect(r.L.size()).toEqual([3, 0]);
    expect(r.U.size()).toEqual([0, 0]);
    expect(r.p).toEqual([0, 1, 2]);
    expect(r.q).toEqual(order === 0 ? null : []);
  });

  it.each([0, 1])('0x3 matrix order %i gives L 0x0, U 0x3, q identity', (order) => {
    const r = slu(empty(0, 3), order, 1);
    expect(r.L.size()).toEqual([0, 0]);
    expect(r.U.size()).toEqual([0, 3]);
    expect(r.p).toEqual([]);
    expect(r.q).toEqual(order === 0 ? null : [0, 1, 2]);
  });

  it('still validates order and threshold first', () => {
    expect(() => slu(sparse([]), 7, 1)).toThrow(/order/);
    expect(() => slu(sparse([]), 1, 2)).toThrow(/threshold/);
  });

  it('toString works on the empty result', () => {
    expect(String(slu(sparse([]), 1, 1))).toContain('p: ');
  });

  it('lusolve with order and threshold fails like the other paths, not with a transpose error', () => {
    const msg = (g: () => unknown) => {
      try {
        g();
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    };
    const viaSlu = msg(() => lusolve(sparse([]), [], 1, 1));
    expect(viaSlu).toBe(msg(() => lusolve([], [])));
    expect(viaSlu).toMatch(/singular/);
  });
});
