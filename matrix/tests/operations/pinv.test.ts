/**
 * Tests for matrix pinv — Moore-Penrose pseudoinverse (DenseMatrix primitive).
 *
 * Coverage:
 *  1.  Identity matrix: pinv(I_n) ≈ I_n.
 *  2.  Square invertible matrix: pinv(A) ≈ inv(A) within 1e-10.
 *  3.  Tall matrix (m > n): pinv(A) · A ≈ I_n.
 *  4.  Wide matrix (m < n): A · pinv(A) ≈ I_m.
 *  5.  MP identity #1: A · A⁺ · A ≈ A.
 *  6.  MP identity #2: A⁺ · A · A⁺ ≈ A⁺.
 *  7.  MP identity #3: (A · A⁺)ᵀ ≈ A · A⁺.
 *  8.  MP identity #4: (A⁺ · A)ᵀ ≈ A⁺ · A.
 *  9.  Rank-deficient (rank-1) matrix: small singular values are dropped.
 *  10. rcond honored: doubling rcond drops an extra near-zero singular value.
 *  11. Shape correctness: pinv of m×n returns n×m.
 *  12. Hilbert matrix size 5: MP identity #1 holds within relaxed tolerance.
 *  13. Zero matrix: pinv returns zero matrix of swapped shape.
 *  14. 1×1 matrix: pinv([[v]]) = [[1/v]].
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { pinv } from '../../src/operations/pinv.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** General m×n matrix multiply: returns (a.rows × b.cols) DenseMatrix. */
function matMul(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
  const m = a.rows;
  const p = a.cols;
  const n = b.cols;
  if (p !== b.rows) throw new Error(`matMul: inner dimensions ${p} vs ${b.rows}`);
  const out = new Float64Array(m * n);
  const aData = a.toFloat64Array();
  const bData = b.toFloat64Array();
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += aData[i * p + k] * bData[k * n + j];
      }
      out[i * n + j] = sum;
    }
  }
  return new DenseMatrix(m, n, out);
}

/** Transpose a DenseMatrix (returns new DenseMatrix). */
function transpose(a: DenseMatrix): DenseMatrix {
  const m = a.rows;
  const n = a.cols;
  const out = new Float64Array(n * m);
  const data = a.toFloat64Array();
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      out[j * m + i] = data[i * n + j];
    }
  }
  return new DenseMatrix(n, m, out);
}

/** Max absolute element-wise difference between two same-shape matrices. */
function maxAbsDiff(a: DenseMatrix, b: DenseMatrix): number {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error(`maxAbsDiff: shapes differ (${a.rows}×${a.cols}) vs (${b.rows}×${b.cols})`);
  }
  const ad = a.toFloat64Array();
  const bd = b.toFloat64Array();
  let max = 0;
  for (let i = 0; i < ad.length; i++) {
    const d = Math.abs(ad[i] - bd[i]);
    if (d > max) max = d;
  }
  return max;
}

/** Build an n×n Hilbert matrix: H[i][j] = 1/(i+j+1). */
function hilbert(n: number): DenseMatrix {
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      data[i * n + j] = 1 / (i + j + 1);
    }
  }
  return new DenseMatrix(n, n, data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pinv (Moore-Penrose pseudoinverse on DenseMatrix)', () => {
  // --- Test 1: pinv(I_n) ≈ I_n ---
  it('pinv of identity matrix equals identity', () => {
    const I = DenseMatrix.identity(4);
    const P = pinv(I);
    expect(P.rows).toBe(4);
    expect(P.cols).toBe(4);
    expect(maxAbsDiff(P, I)).toBeLessThan(1e-10);
  });

  // --- Test 2: Square invertible: pinv(A) ≈ inv(A) ---
  it('pinv of a square invertible 3×3 matches analytical inverse', () => {
    // A = [[2,1,0],[1,3,1],[0,1,4]], inv is known exactly.
    const A = DenseMatrix.fromArray([
      [2, 1, 0],
      [1, 3, 1],
      [0, 1, 4],
    ]);
    // Analytical inverse (det = 2*(12-1) - 1*(4-0) = 22-4 = 18):
    // inv = (1/18)*[[11,-4,1],[-4,8,-2],[1,-2,5]]
    const expected = DenseMatrix.fromArray([
      [11 / 18, -4 / 18, 1 / 18],
      [-4 / 18, 8 / 18, -2 / 18],
      [1 / 18, -2 / 18, 5 / 18],
    ]);
    const P = pinv(A);
    expect(maxAbsDiff(P, expected)).toBeLessThan(1e-10);
  });

  // --- Test 3: Tall matrix (m > n): pinv(A) · A ≈ I_n ---
  it('pinv of a tall (4×2) matrix satisfies pinv(A)·A ≈ I_n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const P = pinv(A); // should be 2×4
    expect(P.rows).toBe(2);
    expect(P.cols).toBe(4);
    const PA = matMul(P, A); // 2×2
    expect(maxAbsDiff(PA, DenseMatrix.identity(2))).toBeLessThan(1e-10);
  });

  // --- Test 4: Wide matrix (m < n): A · pinv(A) ≈ I_m ---
  it('pinv of a wide (2×4) matrix satisfies A·pinv(A) ≈ I_m', () => {
    const A = DenseMatrix.fromArray([
      [1, 3, 5, 7],
      [2, 4, 6, 8],
    ]);
    const P = pinv(A); // should be 4×2
    expect(P.rows).toBe(4);
    expect(P.cols).toBe(2);
    const AP = matMul(A, P); // 2×2
    expect(maxAbsDiff(AP, DenseMatrix.identity(2))).toBeLessThan(1e-10);
  });

  // --- Test 5: MP identity #1: A · A⁺ · A ≈ A ---
  it('Moore-Penrose identity 1: A·A⁺·A = A (3×4 full-rank matrix)', () => {
    // Full-rank 3×4 matrix (rows are linearly independent).
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 9],
      [9, 10, 12, 13],
    ]);
    const P = pinv(A);
    const AAPA = matMul(matMul(A, P), A);
    expect(maxAbsDiff(AAPA, A)).toBeLessThan(1e-9);
  });

  // --- Test 6: MP identity #2: A⁺ · A · A⁺ ≈ A⁺ ---
  it('Moore-Penrose identity 2: A⁺·A·A⁺ = A⁺ (3×4 full-rank matrix)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 9],
      [9, 10, 12, 13],
    ]);
    const P = pinv(A);
    const PAPA = matMul(matMul(P, A), P);
    expect(maxAbsDiff(PAPA, P)).toBeLessThan(1e-9);
  });

  // --- Test 7: MP identity #3: (A · A⁺)ᵀ ≈ A · A⁺ ---
  it('Moore-Penrose identity 3: (A·A⁺)ᵀ = A·A⁺ (3×4 full-rank matrix)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 9],
      [9, 10, 12, 13],
    ]);
    const P = pinv(A);
    const AP = matMul(A, P); // m×m = 3×3
    const APt = transpose(AP);
    expect(maxAbsDiff(APt, AP)).toBeLessThan(1e-9);
  });

  // --- Test 8: MP identity #4: (A⁺ · A)ᵀ ≈ A⁺ · A ---
  it('Moore-Penrose identity 4: (A⁺·A)ᵀ = A⁺·A (3×4 full-rank matrix)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 9],
      [9, 10, 12, 13],
    ]);
    const P = pinv(A);
    const PA = matMul(P, A); // n×n = 4×4
    const PAt = transpose(PA);
    expect(maxAbsDiff(PAt, PA)).toBeLessThan(1e-9);
  });

  // --- Test 9: Rank-deficient (rank-1) matrix ---
  it('rank-1 matrix: pinv drops small singular values', () => {
    // Outer product u·vᵀ is rank 1.
    const u = [1, 2, 3];
    const v = [4, 5, 6];
    const data = new Float64Array(3 * 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        data[i * 3 + j] = u[i] * v[j];
      }
    }
    const A = new DenseMatrix(3, 3, data);
    const P = pinv(A); // 3×3, should be rank-1

    // MP identity #1 should still hold for rank-deficient case.
    const AAPA = matMul(matMul(A, P), A);
    expect(maxAbsDiff(AAPA, A)).toBeLessThan(1e-9);

    // A · A⁺ should be a rank-1 projector: (A·A⁺)² ≈ A·A⁺
    const AP = matMul(A, P);
    const AP2 = matMul(AP, AP);
    expect(maxAbsDiff(AP2, AP)).toBeLessThan(1e-9);
  });

  // --- Test 10: rcond threshold honored ---
  it('rcond: doubling rcond drops an extra near-zero singular value', () => {
    // Construct a 3×3 matrix with singular values [10, 0.01, 0.0001].
    // S_inv with default rcond=1e-10: all three kept (0.0001 > 1e-10 * 10).
    // S_inv with rcond=0.001: drop the 0.0001 entry (0.0001 ≤ 0.001 * 10 = 0.01).
    // Use a diagonal matrix for simplicity; pinv of diag(s) = diag(1/s).
    const sVals = [10, 0.01, 0.0001];
    const A = DenseMatrix.diag(sVals);

    const P_default = pinv(A, { rcond: 1e-10 });
    const P_loose = pinv(A, { rcond: 0.001 });

    // With default rcond: all three s_i kept, so pinv(diag) ≈ diag(1/s).
    const expected_default = DenseMatrix.diag(sVals.map((s) => 1 / s));
    expect(maxAbsDiff(P_default, expected_default)).toBeLessThan(1e-8);

    // With rcond=0.001: threshold = 0.001 * 10 = 0.01, so:
    //   s=10 kept (10 > 0.01), s=0.01 NOT kept (0.01 ≤ 0.01), s=0.0001 dropped.
    // The [2,2] entry of P_loose should be 0 (dropped) and [1,1] also 0.
    const p_loose_data = P_loose.toFloat64Array();
    // Entry [1,1]: s=0.01, rcond*maxS = 0.001*10=0.01, condition is s > 0.01 → false → zeroed
    expect(Math.abs(p_loose_data[1 * 3 + 1])).toBeLessThan(1e-10);
    // Entry [2,2]: s=0.0001 also dropped.
    expect(Math.abs(p_loose_data[2 * 3 + 2])).toBeLessThan(1e-10);
    // Entry [0,0]: s=10 kept.
    expect(Math.abs(p_loose_data[0])).toBeCloseTo(0.1, 8);
  });

  // --- Test 11: Shape correctness ---
  it('pinv of an m×n matrix has shape n×m', () => {
    const A5x3 = DenseMatrix.fromArray([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [1, 3, 5],
      [2, 4, 6],
    ]);
    const P = pinv(A5x3);
    expect(P.rows).toBe(3);
    expect(P.cols).toBe(5);

    const A2x6 = DenseMatrix.fromArray([
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]);
    const Q = pinv(A2x6);
    expect(Q.rows).toBe(6);
    expect(Q.cols).toBe(2);
  });

  // --- Test 12: Hilbert matrix size 5 (numerical stability) ---
  it('Hilbert(5) pinv satisfies MP identity #1 within 1e-6 tolerance', () => {
    // Hilbert matrix is famously ill-conditioned; we use a relaxed tolerance.
    const H = hilbert(5);
    const P = pinv(H);
    const AAPA = matMul(matMul(H, P), H);
    // Hilbert cond(H_5) ≈ 4.8e5, so expect ~1e-10 * cond errors ≈ 1e-5.
    expect(maxAbsDiff(AAPA, H)).toBeLessThan(1e-6);
  });

  // --- Test 13: Zero matrix ---
  it('pinv of a zero matrix returns a zero matrix of swapped shape', () => {
    const Z = DenseMatrix.zeros(3, 4);
    const P = pinv(Z);
    expect(P.rows).toBe(4);
    expect(P.cols).toBe(3);
    const data = P.toFloat64Array();
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(0);
    }
  });

  // --- Test 14: 1×1 matrix ---
  it('pinv of a 1×1 matrix [[v]] equals [[1/v]]', () => {
    const A = DenseMatrix.fromArray([[5]]);
    const P = pinv(A);
    expect(P.rows).toBe(1);
    expect(P.cols).toBe(1);
    expect(P.toFloat64Array()[0]).toBeCloseTo(0.2, 10);
  });
});
