import { describe, it, expect } from 'vitest';
// Issue #927: linsolve, lsolve and luSolve must accept a SparseMatrix. Imported by
// package name (built dist). The sparse input is the issue's SPD tridiagonal matrix.
import { linsolve, lsolve } from '@danielsimonjr/mathts-functions';
import { SparseMatrix } from '@danielsimonjr/mathts-matrix';

const entries = [
  { row: 0, col: 0, value: 4 },
  { row: 0, col: 1, value: -1 },
  { row: 1, col: 0, value: -1 },
  { row: 1, col: 1, value: 4 },
  { row: 1, col: 2, value: -1 },
  { row: 2, col: 1, value: -1 },
  { row: 2, col: 2, value: 4 },
];
const DENSE = [
  [4, -1, 0],
  [-1, 4, -1],
  [0, -1, 4],
];

function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe('issue #927: solvers accept SparseMatrix', () => {
  it('linsolve solves the sparse system: x = [2/7, 1/7, 2/7] for b = [1, 0, 1]', () => {
    const S = SparseMatrix.fromCOO(3, 3, entries);
    const x = linsolve(S, [1, 0, 1]) as number[];
    expect(maxAbsDiff(x, [2 / 7, 1 / 7, 2 / 7])).toBeLessThan(1e-12);
  });

  it('linsolve returns [1, 1, 1] for b = S * [1, 1, 1] = [3, 2, 3]', () => {
    const S = SparseMatrix.fromCOO(3, 3, entries);
    const x = linsolve(S, [3, 2, 3]) as number[];
    expect(maxAbsDiff(x, [1, 1, 1])).toBeLessThan(1e-12);
  });

  it('linsolve on the sparse input matches linsolve on the dense input', () => {
    const S = SparseMatrix.fromCOO(3, 3, entries);
    const sparseX = linsolve(S, [1, 0, 1]) as number[];
    const denseX = linsolve(DENSE, [1, 0, 1]) as number[];
    expect(maxAbsDiff(sparseX, denseX)).toBeLessThan(1e-14);
  });

  it('lsolve on a sparse input matches lsolve on the dense input (forward substitution)', () => {
    const S = SparseMatrix.fromCOO(3, 3, entries);
    const sparseX = (lsolve(S, [1, 0, 1]) as unknown as number[][]).map((r) => r[0]);
    const denseX = (lsolve(DENSE, [1, 0, 1]) as unknown as number[][]).map((r) => r[0]);
    expect(maxAbsDiff(sparseX, denseX)).toBeLessThan(1e-14);
  });

  it('lsolve solves a sparse lower-triangular system exactly', () => {
    const L = SparseMatrix.fromCOO(3, 3, [
      { row: 0, col: 0, value: 2 },
      { row: 1, col: 0, value: 1 },
      { row: 1, col: 1, value: 4 },
      { row: 2, col: 1, value: 1 },
      { row: 2, col: 2, value: 2 },
    ]);
    // L * [1, 1, 1] = [2, 5, 3]
    const x = (lsolve(L, [2, 5, 3]) as unknown as number[][]).map((r) => r[0]);
    expect(maxAbsDiff(x, [1, 1, 1])).toBeLessThan(1e-12);
  });
});
