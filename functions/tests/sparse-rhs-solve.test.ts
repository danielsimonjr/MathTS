import { describe, it, expect } from 'vitest';
// A matrix-package SparseMatrix as the right-hand side b of every triangular and LU
// solver, for an array, DenseMatrix and SparseMatrix coefficient matrix.
import {
  lsolve,
  usolve,
  lsolveAll,
  usolveAll,
  lusolve,
  matrix,
} from '@danielsimonjr/mathts-functions';
import { SparseMatrix } from '@danielsimonjr/mathts-matrix';

const LOWER = [
  [2, 0],
  [1, 3],
];
const UPPER = [
  [2, 1],
  [0, 3],
];
const coo = (M: number[][]) =>
  M.flatMap((r, i) => r.map((v, j) => ({ row: i, col: j, value: v }))).filter((e) => e.value !== 0);
const sparse = (M: number[][]) => SparseMatrix.fromCOO(M.length, M[0].length, coo(M));
const column = (x: unknown): number[] => {
  const v = x as { toArray?: () => number[][]; valueOf(): unknown };
  const rows = (typeof v.toArray === 'function' ? v.toArray() : v.valueOf()) as number[][];
  return rows.map((r) => r[0]);
};
const forms = (M: number[][]): Array<[string, unknown]> => [
  ['array', M],
  ['DenseMatrix', matrix(M)],
  ['SparseMatrix', sparse(M)],
];
// b = [4, 3]^T with a structural zero pattern kept sparse.
const B = [[4], [3]];
const bSparse = () => sparse(B);

describe('solvers accept a matrix-package SparseMatrix right-hand side', () => {
  for (const [label, L] of forms(LOWER)) {
    it(`lsolve(${label}, sparse b)`, () => {
      const x = column((lsolve as (...a: unknown[]) => unknown)(L, bSparse()));
      expect(x[0]).toBeCloseTo(2, 12);
      expect(x[1]).toBeCloseTo(1 / 3, 12);
    });
    it(`lsolveAll(${label}, sparse b)`, () => {
      const all = (lsolveAll as (...a: unknown[]) => unknown[])(L, bSparse());
      expect(all).toHaveLength(1);
      expect(column(all[0])[1]).toBeCloseTo(1 / 3, 12);
    });
  }
  for (const [label, U] of forms(UPPER)) {
    it(`usolve(${label}, sparse b)`, () => {
      const x = column((usolve as (...a: unknown[]) => unknown)(U, bSparse()));
      expect(x[0]).toBeCloseTo(1.5, 12);
      expect(x[1]).toBeCloseTo(1, 12);
    });
    it(`usolveAll(${label}, sparse b)`, () => {
      const all = (usolveAll as (...a: unknown[]) => unknown[])(U, bSparse());
      expect(all).toHaveLength(1);
      expect(column(all[0])[0]).toBeCloseTo(1.5, 12);
    });
    it(`lusolve(${label}, sparse b)`, () => {
      const x = column((lusolve as (...a: unknown[]) => unknown)(U, bSparse()));
      expect(x[0]).toBeCloseTo(1.5, 12);
      expect(x[1]).toBeCloseTo(1, 12);
    });
  }

  it('a sparse b with a zero entry keeps the zero', () => {
    const x = column((usolve as (...a: unknown[]) => unknown)(UPPER, sparse([[4], [0]])));
    expect(x).toEqual([2, 0]);
  });

  it('a sparse b of the wrong shape throws a RangeError', () => {
    expect(() => (usolve as (...a: unknown[]) => unknown)(UPPER, sparse([[1], [2], [3]]))).toThrow(
      RangeError
    );
  });
});
