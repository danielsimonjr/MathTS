import { describe, it, expect } from 'vitest';
import { svds, svd } from '../src/index.js';

/** Full singular values (descending) via the dense matrix-package svd. */
function fullSingularValues(A: number[][]): number[] {
  return svd(A)
    .S.slice()
    .sort((a, b) => b - a);
}

/** ‖A·vⱼ − σⱼ·uⱼ‖ — the implementation-independent SVD defining relation. */
function definingResidual(
  A: number[][],
  U: number[][],
  s: number[],
  V: number[][],
  j: number
): number {
  const m = A.length;
  const n = A[0].length;
  const vj = V.map((row) => row[j]);
  const Avj = A.map((row) => row.reduce((acc, val, c) => acc + val * vj[c], 0));
  let sq = 0;
  for (let i = 0; i < m; i++) {
    const d = Avj[i] - s[j] * U[i][j];
    sq += d * d;
  }
  void n;
  return Math.sqrt(sq);
}

const A5x4 = [
  [1, 2, 0, 0],
  [0, 3, 1, 0],
  [4, 0, 2, 1],
  [0, 1, 0, 5],
  [2, 0, 3, 0],
];
// scipy.sparse.linalg.svds / numpy.linalg.svd (descending): 5.9693, 4.9279, 3.4962, 1.6911
const A5x4_sv = [5.969301522820469, 4.92793258942721, 3.496154917254525, 1.691100386810727];

describe('svds — sparse/partial SVD (top-k via Lanczos)', () => {
  it('top-1 singular value matches scipy/numpy', () => {
    const { s } = svds(A5x4, 1);
    expect(s).toHaveLength(1);
    expect(s[0]).toBeCloseTo(A5x4_sv[0], 8);
  });

  it('top-2 and top-3 singular values match, descending', () => {
    for (const k of [2, 3]) {
      const { s } = svds(A5x4, k);
      expect(s).toHaveLength(k);
      for (let j = 0; j < k; j++) expect(s[j]).toBeCloseTo(A5x4_sv[j], 7);
      // descending order
      for (let j = 1; j < k; j++) expect(s[j]).toBeLessThanOrEqual(s[j - 1] + 1e-12);
    }
  });

  it('satisfies the SVD defining relation A·vⱼ = σⱼ·uⱼ (implementation-independent)', () => {
    const k = 3;
    const { U, s, V } = svds(A5x4, k);
    for (let j = 0; j < k; j++) {
      expect(definingResidual(A5x4, U, s, V, j)).toBeLessThan(1e-6);
    }
  });

  it('returns orthonormal singular-vector columns (UᵀU = I_k, VᵀV = I_k)', () => {
    const k = 3;
    const { U, V } = svds(A5x4, k);
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        let uu = 0;
        for (let i = 0; i < U.length; i++) uu += U[i][a] * U[i][b];
        let vv = 0;
        for (let i = 0; i < V.length; i++) vv += V[i][a] * V[i][b];
        expect(uu).toBeCloseTo(a === b ? 1 : 0, 6);
        expect(vv).toBeCloseTo(a === b ? 1 : 0, 6);
      }
    }
  });

  it('rank-k truncation error equals sqrt(Σ_{i>k} σ_i²) (Eckart–Young)', () => {
    const full = fullSingularValues(A5x4);
    for (const k of [1, 2, 3]) {
      const { U, s, V } = svds(A5x4, k);
      // ‖A − UΣVᵀ‖_F over the retained rank
      let fro2 = 0;
      for (let i = 0; i < A5x4.length; i++) {
        for (let c = 0; c < A5x4[0].length; c++) {
          let approx = 0;
          for (let j = 0; j < k; j++) approx += U[i][j] * s[j] * V[c][j];
          const d = A5x4[i][c] - approx;
          fro2 += d * d;
        }
      }
      const expected = Math.sqrt(full.slice(k).reduce((acc, sv) => acc + sv * sv, 0));
      expect(Math.sqrt(fro2)).toBeCloseTo(expected, 5);
    }
  });

  it('handles a wide matrix (m < n) via the AAᵀ path', () => {
    const W = [
      [1, 0, 2, 0, 1],
      [0, 3, 0, 1, 0],
      [2, 1, 0, 0, 4],
    ];
    const full = fullSingularValues(W);
    const { U, s, V } = svds(W, 2);
    expect(s[0]).toBeCloseTo(full[0], 6);
    expect(s[1]).toBeCloseTo(full[1], 6);
    // defining relation on the wide matrix
    expect(definingResidual(W, U, s, V, 0)).toBeLessThan(1e-6);
    expect(U).toHaveLength(3);
    expect(V).toHaveLength(5);
  });

  it('rejects out-of-range k', () => {
    expect(() => svds(A5x4, 0)).toThrow(/k must be/);
    expect(() => svds(A5x4, 5)).toThrow(/k must be/); // min(5,4) = 4
  });
});
