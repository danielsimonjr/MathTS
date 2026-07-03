import { describe, it, expect } from 'vitest';

import { subset, index, range, matrix, lyap, sylvester } from '../src/factories/index.js';

/**
 * `sylvester` and `lyap` were shipped **smoke-only** (`typeof … === 'function'`)
 * and broken: `sylvester(A,B,C)` threw in `subset(G, index(k,k))` →
 * `MathJSDenseMatrix.get`. Root cause: the factory `subset(matrix, Index)` calls
 * `matrix.subset(indexObject)`, but the bridge `MathJSDenseMatrix.subset` only
 * understood a plain coordinate `number[]` — it passed the whole `Index` object
 * to `get`, reading `_data[IndexObject]` = undefined. The bridge now understands
 * mathjs `Index` objects (scalar element + range/array sub-matrix extraction).
 *
 * Oracles are implementation-independent: `subset` against hand-known values, and
 * the Lyapunov solution in closed form (diagonal case) + the defining equation.
 */

const sub = subset as (m: unknown, i: unknown, r?: unknown) => unknown;
const idx = index as (...a: unknown[]) => unknown;
const rng = range as (a: number, b: number) => unknown;
const dense = (v: unknown) => (v as { valueOf(): unknown }).valueOf();

describe('MathJSDenseMatrix.subset — mathjs Index support (regression pin)', () => {
  it('scalar index extracts one element', () => {
    const M = matrix([
      [10, 20],
      [30, 40],
    ]);
    expect(sub(M, idx(0, 1))).toBe(20);
    expect(sub(M, idx(1, 0))).toBe(30);
    expect(sub(M, idx(1, 1))).toBe(40);
  });

  it('range × scalar index extracts a column sub-matrix', () => {
    const M = matrix([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    // column 1, all rows → [[2],[5]]
    expect(dense(sub(M, idx(rng(0, 2), [1])))).toEqual([[2], [5]]);
  });
});

describe('lyap / sylvester — external oracle', () => {
  it('lyap(diag(−1,−2), I) = diag(0.5, 0.25) (closed form of A·P + P·Aᵀ + Q = 0)', () => {
    // Diagonal A ⇒ 2·aᵢ·Pᵢᵢ = −Qᵢᵢ ⇒ Pᵢᵢ = −1/(2aᵢ): P11 = 0.5, P22 = 0.25; off-diag 0.
    const P = dense(
      lyap(
        [
          [-1, 0],
          [0, -2],
        ],
        [
          [1, 0],
          [0, 1],
        ]
      )
    ) as number[][];
    expect(P[0][0]).toBeCloseTo(0.5, 9);
    expect(P[1][1]).toBeCloseTo(0.25, 9);
    expect(P[0][1]).toBeCloseTo(0, 9);
    expect(P[1][0]).toBeCloseTo(0, 9);
  });

  it('sylvester solves A·X + X·B = C (verify the defining equation)', () => {
    // Diagonal A,B: A=diag(1,2), B=diag(3,4), C=diag(4,12) ⇒ (aᵢ+bᵢ)Xᵢᵢ = Cᵢᵢ ⇒ X=diag(1,2).
    const X = dense(
      sylvester(
        [
          [1, 0],
          [0, 2],
        ],
        [
          [3, 0],
          [0, 4],
        ],
        [
          [4, 0],
          [0, 12],
        ]
      )
    ) as number[][];
    expect(X[0][0]).toBeCloseTo(1, 9);
    expect(X[1][1]).toBeCloseTo(2, 9);
    expect(X[0][1]).toBeCloseTo(0, 9);
    expect(X[1][0]).toBeCloseTo(0, 9);
  });
});
