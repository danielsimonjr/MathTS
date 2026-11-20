/**
 * Dogfood #1287 (same class as #1169) - lsolve, usolve and lusolve read a right side near 1e-15
 * and below as zero. The tolerance of `equalScalar` is absolute, so `x = 0` came back for
 * a regular system, for the Matrix, SparseMatrix and prefactored paths (the Array path of
 * `lusolve` was right). The closed form of the system [[2,1],[1,3]] x = s [1,2] is x = s [0.2, 0.6].
 */
import { describe, it, expect } from 'vitest';
import { lsolve, lup, lusolve, matrix, slu, sparse, usolve } from '../src/index.js';

const A = [
  [2, 1],
  [1, 3],
];

function column(v: unknown): number[] {
  const rows = (v as { toArray?: () => number[][] }).toArray?.() ?? (v as number[][]);
  return rows.map((r) => r[0]);
}

function expectClose(actual: number[], expected: number[], tol = 1e-13): void {
  expected.forEach((e, i) => {
    expect(Math.abs(actual[i] - e)).toBeLessThanOrEqual(tol * Math.abs(e));
  });
}

describe('#1287 lusolve of a regular system with a small right side', () => {
  for (const s of [1e-14, 1e-15, 1e-16, 1e-100, 1e-300]) {
    const b = [[s], [2 * s]];
    const expected = [0.2 * s, 0.6 * s];
    it(`s = ${s}: Array, Matrix, SparseMatrix, lup and slu factorizations`, () => {
      expectClose(column(lusolve(A, b)), expected);
      expectClose(column(lusolve(matrix(A), b)), expected);
      expectClose(column(lusolve(sparse(A), b)), expected);
      expectClose(column(lusolve(lup(A), b)), expected);
      expectClose(column(lusolve(slu(sparse(A), 1, 0.001), b)), expected);
    });
  }
});

describe('#1287 lsolve and usolve with a small right side', () => {
  const b = [[1e-16], [2e-16]];
  it('lsolve: [[2,0],[1,3]] x = 1e-16 [1,2] gives 1e-16 [0.5, 0.5]', () => {
    const L = [
      [2, 0],
      [1, 3],
    ];
    expectClose(column(lsolve(L, b)), [0.5e-16, 0.5e-16]);
    expectClose(column(lsolve(matrix(L), b)), [0.5e-16, 0.5e-16]);
    expectClose(column(lsolve(sparse(L), b)), [0.5e-16, 0.5e-16]);
  });
  it('usolve: [[2,1],[0,3]] x = 1e-16 [1,2] gives 1e-16 [1/6, 2/3]', () => {
    const U = [
      [2, 1],
      [0, 3],
    ];
    expectClose(column(usolve(U, b)), [1e-16 / 6, (2 * 1e-16) / 3]);
    expectClose(column(usolve(matrix(U), b)), [1e-16 / 6, (2 * 1e-16) / 3]);
    expectClose(column(usolve(sparse(U), b)), [1e-16 / 6, (2 * 1e-16) / 3]);
  });
});

describe('#1287 a zero diagonal entry still has the degenerate-row rule', () => {
  const Lsing = [
    [1, 0],
    [1, 0],
  ];
  it('a right side that is a rounding residue gives x = 0 for the row', () => {
    // 0.1 + 0.2 = 0.30000000000000004, so the second right side is 0.3 - x0 = -5.6e-17
    const r = [[0.1 + 0.2], [0.3]];
    expect(column(lsolve(Lsing, r))).toEqual([0.1 + 0.2, 0]);
    expect(column(lsolve(sparse(Lsing), r))).toEqual([0.1 + 0.2, 0]);
  });
  it('a right side that is not zero throws the singular-matrix error', () => {
    expect(() => lsolve(Lsing, [[1], [2]])).toThrow(/singular/);
    expect(() => lsolve(sparse(Lsing), [[1], [2]])).toThrow(/singular/);
  });
});
