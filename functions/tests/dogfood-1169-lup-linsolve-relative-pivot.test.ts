/**
 * Dogfood #1169 - lup and linsolve of a matrix whose entries are all near 1e-100.
 *
 * lup compared each entry with an absolute tolerance, so every entry of a 1e-100 matrix
 * read as zero: no row swap, no multiplier, and an all-zero U for a sparse input. linsolve
 * tested its pivot against the absolute value 1e-15 and threw "singular" for a regular matrix.
 * The pivot of each of them is now relative to its own matrix (lup) or the terms that cancelled in it (linsolve).
 * Expected values: SciPy `lu` of the matrix scaled by 1e100, and the exact solution [0, 1].
 */
import { describe, it, expect } from 'vitest';
import { lup, linsolve, matrix, sparse } from '../src/index.js';

const S = 1e-100;
// A = S * [[3, 1], [4, 2]]
const A = [
  [3 * S, 1 * S],
  [4 * S, 2 * S],
];
// SciPy: P A = L U with L = [[1, 0], [0.75, 1]], U = S * [[4, 2], [0, -0.5]], p = [1, 0]
const L_WANT = [
  [1, 0],
  [0.75, 1],
];
const U_WANT_UNIT = [
  [4, 2],
  [0, -0.5],
];
const P_WANT = [1, 0];

/** Every entry of `got` equals `want * unit` within a relative `tol` of `unit`; zero stays zero. */
function expectScaled(got: unknown, want: number[][], unit: number, tol = 1e-14): void {
  const g = got as number[][];
  expect(g.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    expect(g[i].length).toBe(want[i].length);
    for (let j = 0; j < want[i].length; j++) {
      if (want[i][j] === 0) expect(g[i][j]).toBe(0);
      else expect(Math.abs(g[i][j] / unit - want[i][j])).toBeLessThanOrEqual(tol * 4);
    }
  }
}

function expectFactorsReproduce(L: number[][], U: number[][], p: number[]): void {
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      let s = 0;
      for (let k = 0; k < A.length; k++) s += L[i][k] * U[k][j];
      expect(Math.abs(s - A[p[i]][j])).toBeLessThanOrEqual(1e-114);
    }
  }
}

describe('#1169 lup of a matrix near 1e-100', () => {
  it('Array input pivots and divides as the 1e100-scaled control does', () => {
    const r = lup(A) as { L: number[][]; U: number[][]; p: number[] };
    expectScaled(r.L, L_WANT, 1);
    expectScaled(r.U, U_WANT_UNIT, S);
    expect(r.p).toEqual(P_WANT);
    expectFactorsReproduce(r.L, r.U, r.p);
  });

  it('DenseMatrix input gives the same factors', () => {
    const r = lup(matrix(A)) as unknown as {
      L: { toArray(): number[][] };
      U: { toArray(): number[][] };
      p: number[];
    };
    expectScaled(r.L.toArray(), L_WANT, 1);
    expectScaled(r.U.toArray(), U_WANT_UNIT, S);
    expect(r.p).toEqual(P_WANT);
  });

  it('SparseMatrix input keeps its tiny values (U was all zeros)', () => {
    const r = lup(sparse(A)) as unknown as {
      L: { toArray(): number[][] };
      U: { toArray(): number[][] };
      p: number[];
    };
    expectScaled(r.L.toArray(), L_WANT, 1);
    expectScaled(r.U.toArray(), U_WANT_UNIT, S);
    expect(r.p).toEqual(P_WANT);
    expectFactorsReproduce(r.L.toArray(), r.U.toArray(), r.p);
  });

  it('the unit-scale control is unchanged', () => {
    const r = lup(
      sparse([
        [3, 1],
        [4, 2],
      ])
    ) as unknown as { L: { toArray(): number[][] }; U: { toArray(): number[][] }; p: number[] };
    expectScaled(r.L.toArray(), L_WANT, 1);
    expectScaled(r.U.toArray(), U_WANT_UNIT, 1);
    expect(r.p).toEqual(P_WANT);
  });
});

describe('#1169 linsolve pivot is relative to its row', () => {
  const solve = linsolve as (a: unknown, b: unknown) => number[];

  it('solves the 1e-100 system to [0, 1]', () => {
    const x = solve(A, [1e-100, 2e-100]);
    expect(Math.abs(x[0])).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(x[1] - 1)).toBeLessThanOrEqual(1e-15);
  });

  it('a wide diagonal still solves', () => {
    const x = solve(
      [
        [1e10, 0],
        [0, 1e-7],
      ],
      [1, 1]
    );
    expect(Math.abs(x[0] / 1e-10 - 1)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(x[1] / 1e7 - 1)).toBeLessThanOrEqual(1e-15);
    const y = solve(
      [
        [1e10, 0],
        [0, 1e-4],
      ],
      [1, 1]
    );
    expect(Math.abs(y[0] / 1e-10 - 1)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(y[1] / 1e4 - 1)).toBeLessThanOrEqual(1e-15);
  });

  it('a singular or numerically singular matrix still throws', () => {
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2]
      )
    ).toThrow('linsolve: singular matrix');
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4 + 1e-15],
        ],
        [1, 2]
      )
    ).toThrow('linsolve: singular matrix');
    expect(() =>
      solve(
        [
          [1e10, 1],
          [1, 1e-10],
        ],
        [1, 1]
      )
    ).toThrow('linsolve: singular matrix');
  });

  it('a mildly ill-conditioned matrix still returns a solution', () => {
    const x = solve(
      [
        [1, 1],
        [1, 1 + 1e-14],
      ],
      [1, 2]
    );
    expect(x).toHaveLength(2);
    expect(x.every(Number.isFinite)).toBe(true);
  });
});
