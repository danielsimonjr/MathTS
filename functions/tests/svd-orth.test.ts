import { describe, it, expect } from 'vitest';
import { svd, orth } from '../src/index.js';

describe('svd + orth exposed on functions', () => {
  it('svd(diag(1,2,3)).S = [3,2,1]', () => {
    const { S } = svd([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    expect(S[0]).toBeCloseTo(3, 10);
    expect(S[1]).toBeCloseTo(2, 10);
    expect(S[2]).toBeCloseTo(1, 10);
  });

  it('orth of a rank-2 matrix returns 2 orthonormal columns', () => {
    const Q = orth([
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 2],
    ]); // rank 2
    expect(Q.length).toBe(3); // 3 rows
    expect(Q[0]).toHaveLength(2); // 2 columns (rank 2)
    const dot = (i: number, j: number) => Q.reduce((s, row) => s + row[i] * row[j], 0);
    expect(dot(0, 0)).toBeCloseTo(1, 8);
    expect(dot(1, 1)).toBeCloseTo(1, 8);
    expect(dot(0, 1)).toBeCloseTo(0, 8);
  });

  it('orth of full-rank 2x2 returns 2 columns', () => {
    const Q = orth([
      [1, 0],
      [0, 1],
    ]);
    expect(Q[0]).toHaveLength(2);
  });

  it('orth of the all-zero matrix returns an m x 0 basis', () => {
    const Q = orth([
      [0, 0],
      [0, 0],
    ]);
    expect(Q.length).toBe(2);
    expect(Q[0]).toHaveLength(0);
  });
});
