/**
 * Dogfood #1287 - lusolve judged a pivot against one matrix-wide scale.
 *
 * lusolve([[1e10, 0], [0, 1e-7]], [1, 1]) threw "matrix is singular": the pivot 1e-7 is below
 * 1e-15 times the largest entry 1e10 of the factor. The matrix is a regular diagonal matrix
 * with the exact solution [1e-10, 1e7]. The pivot is now judged against the scale of its own
 * row of the factorization, so a small pivot in a small row is valid, and a pivot that lost
 * its digits by cancellation is still singular. Every storage path of
 * lusolve is covered: Array, DenseMatrix, SparseMatrix (lup and slu) and a prefactored lup.
 */
import { describe, it, expect } from 'vitest';
import { lup, lusolve as lusolveFn, matrix, sparse } from '../src/index.js';

const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => unknown;
const SINGULAR = 'Linear system cannot be solved since matrix is singular';

type Path = [name: string, solve: (a: number[][], b: number[]) => unknown];
const paths: Path[] = [
  ['Array', (a, b) => lusolve(a, b)],
  ['DenseMatrix', (a, b) => lusolve(matrix(a), b)],
  ['SparseMatrix', (a, b) => lusolve(sparse(a), b)],
  ['SparseMatrix with slu', (a, b) => lusolve(sparse(a), b, 0, 1)],
  ['prefactored dense lup', (a, b) => lusolve(lup(a), b)],
  ['prefactored sparse lup', (a, b) => lusolve(lup(sparse(a)), b)],
];

/** The column vector of a result, as numbers. */
function column(x: unknown): number[] {
  const rows = (Array.isArray(x) ? x : (x as { toArray(): unknown[] }).toArray()) as unknown[];
  return rows.map((r) => (Array.isArray(r) ? (r[0] as number) : (r as number)));
}

describe.each(paths)('#1287 lusolve pivot is relative to its row: %s', (_name, solve) => {
  it('solves the diagonal matrix [[1e10, 0], [0, 1e-7]] to [1e-10, 1e7]', () => {
    const x = column(
      solve(
        [
          [1e10, 0],
          [0, 1e-7],
        ],
        [1, 1]
      )
    );
    expect(Math.abs(x[0] / 1e-10 - 1)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(x[1] / 1e7 - 1)).toBeLessThanOrEqual(1e-15);
  });

  it('still throws for the singular matrix [[1, 2], [2, 4]]', () => {
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2]
      )
    ).toThrow(SINGULAR);
  });

  it('still throws for the near-singular matrix [[1, 2], [2, 4 + 1e-15]]', () => {
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4 + 1e-15],
        ],
        [1, 2]
      )
    ).toThrow(SINGULAR);
  });

  it('still throws when the pivot is zero after cancellation: [[1e10, 1], [1, 1e-10]]', () => {
    expect(() =>
      solve(
        [
          [1e10, 1],
          [1, 1e-10],
        ],
        [1, 1]
      )
    ).toThrow(SINGULAR);
  });

  it('still solves a mildly ill-conditioned matrix', () => {
    const x = column(
      solve(
        [
          [1, 1],
          [1, 1 + 1e-14],
        ],
        [1, 2]
      )
    );
    expect(x.every(Number.isFinite)).toBe(true);
    // The first row reads x0 + x1 = 1.
    expect(x[0] + x[1]).toBeCloseTo(1, 1);
  });

  it('solves a matrix near 1e-100 to [0, 1]', () => {
    const x = column(
      solve(
        [
          [3e-100, 1e-100],
          [4e-100, 2e-100],
        ],
        [1e-100, 2e-100]
      )
    );
    expect(Math.abs(x[0])).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(x[1] - 1)).toBeLessThanOrEqual(1e-15);
  });
});
