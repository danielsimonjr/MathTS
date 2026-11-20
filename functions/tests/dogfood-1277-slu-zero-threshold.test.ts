/**
 * Dogfood #1277 - slu and lusolve with the pivoting threshold 0.
 *
 * csLu prefers the diagonal entry when |x[col]| >= max * threshold. With the threshold 0 the
 * test reads 0 >= 0, so a diagonal entry that is exactly zero became the pivot although the
 * column had a nonzero entry. slu returned factors with infinite entries, and lusolve called
 * a regular matrix singular. A zero entry is now never the diagonal preference.
 */
import { describe, it, expect } from 'vitest';
import { lusolve as lusolveFn, slu as sluFn, sparse } from '../src/factories/index.js';

type Sparse = { toArray(): number[][] };
type Slu = { L: Sparse; U: Sparse; p: number[]; q: number[] | null };
const slu = sluFn as (a: unknown, order: number, threshold: number) => Slu;
const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => { toArray(): number[][] };

const SINGULAR = 'Linear system cannot be solved since matrix is singular';
const SWAP = [
  [0, 1],
  [1, 0],
];

describe('#1277 threshold 0 never takes a zero pivot', () => {
  it('slu of [[0,1],[1,0]] has finite factors with a nonzero diagonal in U', () => {
    const f = slu(sparse(SWAP), 0, 0);
    const L = f.L.toArray();
    const U = f.U.toArray();
    for (const v of [...L.flat(), ...U.flat()]) expect(Number.isFinite(v)).toBe(true);
    for (let k = 0; k < U.length; k++) expect(U[k][k]).not.toBe(0);
    // L U = A(p, :): the row r of A is the row p[r] of L U.
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        let sum = 0;
        for (let k = 0; k < 2; k++) sum += L[f.p[r]][k] * U[k][c];
        expect(sum).toBe(SWAP[r][c]);
      }
    }
  });

  it('lusolve with the threshold 0 solves [[0,1],[1,0]]', () => {
    expect(lusolve(sparse(SWAP), [[1], [2]], 0, 0).toArray()).toEqual([[2], [1]]);
  });

  it('lusolve with the threshold 0.001 is the same (control)', () => {
    expect(lusolve(sparse(SWAP), [[1], [2]], 0, 0.001).toArray()).toEqual([[2], [1]]);
  });

  it('a singular matrix throws the singular-matrix error at the threshold 0', () => {
    const singular = sparse([
      [1, 2, 3],
      [0, 0, 0],
      [4, 5, 7],
    ]);
    expect(() => slu(singular, 0, 0)).toThrow(SINGULAR);
    expect(() => lusolve(singular, [[1], [2], [3]], 0, 0)).toThrow(SINGULAR);
  });

  it('a threshold above 0 still prefers the diagonal entry', () => {
    const A = [
      [4, 1],
      [3, 2],
    ];
    const f = slu(sparse(A), 0, 0.5);
    // 4 >= 0.5 * 4, so row 0 is the pivot of column 0: p = [0, 1] and U[0][0] = 4.
    expect(f.p).toEqual([0, 1]);
    expect(f.U.toArray()[0][0]).toBe(4);
  });
});
