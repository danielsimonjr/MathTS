/**
 * Dogfood #1157 - rank and nullspace used a pivot cutoff of the absolute value 1e-10.
 *
 * A small trailing singular value of a matrix with small entries read as zero (rank 1 for
 * diag(1e-6, 1e-11)), and the rounding residue of a large low-rank matrix read as a pivot
 * (rank 3 for a product of rank 2). rank now counts the singular values above
 * max(S) * max(m, n) * eps (NumPy `matrix_rank`), and nullspace uses the same cutoff, so
 * rank(A) + nullspace(A).length is always the number of columns. Expected values: NumPy
 * 2.3.5 `matrix_rank` (from the issue) and the closed form rank(U V) = 2.
 */
import { describe, it, expect } from 'vitest';
import { nullspace, rank } from '../src/index.js';

/** A = U V with U (3 x 2) and V (2 x 3) of full rank, scaled by `s`: rank 2, one null vector. */
function lowRankProduct(s: number): number[][] {
  const U = [
    [1.1 * s, 0.3 * s],
    [0.7 * s, 1.9 * s],
    [0.5 * s, 1.3 * s],
  ];
  const V = [
    [1.7, 0.2, 0.9],
    [0.4, 1.1, 0.6],
  ];
  const A: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const row: number[] = [];
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 2; k++) sum += U[i][k] * V[k][j];
      row.push(sum);
    }
    A.push(row);
  }
  return A;
}

const maxAbs = (rows: number[][]): number => Math.max(...rows.flat().map(Math.abs));

describe('#1157 rank counts singular values above max(S) * max(m, n) * eps', () => {
  it('counts a small trailing singular value of a graded matrix', () => {
    expect(
      rank([
        [1e-6, 0],
        [0, 1e-11],
      ])
    ).toBe(2);
    expect(
      rank([
        [9e-7, 0],
        [0, 1e-11],
      ])
    ).toBe(2);
    expect(
      rank([
        [0.5, 0],
        [0, 5e-11],
      ])
    ).toBe(2);
  });

  it('keeps a large graded matrix at its full rank', () => {
    expect(
      rank([
        [213424667574.8, 0, 0],
        [0, 0.0896, 0],
        [0, 0, 0.0391],
      ])
    ).toBe(3);
  });

  it('does not count the rounding residue of a large low-rank matrix', () => {
    expect(rank(lowRankProduct(2 ** 20))).toBe(2);
    expect(rank(lowRankProduct(2 ** 34))).toBe(2);
  });

  it('keeps the rank of exactly dependent rows', () => {
    expect(
      rank([
        [1, 2],
        [2, 4],
      ])
    ).toBe(1);
    expect(
      rank([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ])
    ).toBe(2);
  });
});

describe('#1157 nullspace uses the same cutoff', () => {
  it('has no null vector for a full-rank graded matrix', () => {
    expect(
      nullspace([
        [1e-6, 0],
        [0, 1e-11],
      ])
    ).toEqual([]);
    expect(
      nullspace([
        [9e-7, 0],
        [0, 1e-11],
      ])
    ).toEqual([]);
  });

  it.each([2 ** 20, 2 ** 34])('finds the one null vector of a rank 2 product (s = %d)', (s) => {
    const A = lowRankProduct(s);
    const N = nullspace(A);
    expect(N.length).toBe(1);
    const v = N[0];
    const vMax = Math.max(...v.map(Math.abs));
    expect(vMax).toBeGreaterThan(0);
    for (const row of A) {
      let dot = 0;
      for (let j = 0; j < v.length; j++) dot += row[j] * v[j];
      expect(Math.abs(dot)).toBeLessThanOrEqual(1e-12 * maxAbs(A) * vMax);
    }
  });

  it('keeps rank(A) + nullspace(A).length equal to the column count', () => {
    const matrices: number[][][] = [
      [
        [1e-6, 0],
        [0, 1e-11],
      ],
      [
        [9e-7, 0],
        [0, 1e-11],
      ],
      [
        [0.5, 0],
        [0, 5e-11],
      ],
      [
        [213424667574.8, 0, 0],
        [0, 0.0896, 0],
        [0, 0, 0.0391],
      ],
      lowRankProduct(2 ** 20),
      lowRankProduct(2 ** 34),
      [
        [1, 2],
        [2, 4],
      ],
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    ];
    for (const A of matrices) {
      expect(rank(A) + nullspace(A).length).toBe(A[0].length);
    }
  });
});
