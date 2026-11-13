import { describe, it, expect } from 'vitest';
// Issue #927: lu and luSolve from linalg must accept a SparseMatrix. Imported by package name.
import { lu, luSolve } from '@danielsimonjr/mathts-linalg';
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

describe('issue #927: linalg lu / luSolve accept SparseMatrix', () => {
  it('luSolve(lu(S), b) returns x = [2/7, 1/7, 2/7] for b = [1, 0, 1]', () => {
    const S = SparseMatrix.fromCOO(3, 3, entries);
    const x = luSolve(lu(S), [1, 0, 1]) as number[];
    const want = [2 / 7, 1 / 7, 2 / 7];
    for (let i = 0; i < 3; i++) expect(Math.abs(x[i] - want[i])).toBeLessThan(1e-12);
  });
});
