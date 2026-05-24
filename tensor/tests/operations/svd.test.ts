/**
 * Tests for tensorSvd — truncated SVD for rank-N tensors.
 *
 * Coverage:
 *  1.  Rank-2 reconstruction:  U · diag(S) · Vᵀ ≈ original to 1e-9.
 *  2.  Rank-3 input (rowAxes=[0]): reshape to (3, 20), verify rebuild.
 *  3.  Truncation with cutoff: a rank-3 matrix padded with one ~0 singular
 *      value; cutoff=1e-10 drops exactly one, truncatedDim === 3.
 *  4.  Truncation with maxdim: maxdim=2 on a rank-3 matrix keeps exactly 2.
 *  5.  Truncation error: matches sum of squared dropped singular values.
 *  6.  Full SVD (no opts): truncatedDim === min(rows, cols), error === 0.
 *  7.  Rectangular matrix (rows > cols).
 *  8.  Rectangular matrix (rows < cols).
 *  9.  rowAxes order controls U shape.
 * 10.  Both cutoff AND maxdim together — maxdim wins when smaller.
 * 11.  Both cutoff AND maxdim together — cutoff wins when tighter.
 * 12.  Error on rowAxes covering all axes.
 * 13.  Error on empty rowAxes.
 * 14.  joiningIndexName accepted without error (unused in Phase 2).
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { tensorSvd } from '../../src/operations/svd';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reconstruct the original matrix from a rank-2 SVD result.
 *
 * The decomposition is:  original[i][j] = sum_k  U[i,k] * S[k] * V[k,j]
 *
 * After tensorSvd(t, [0]):
 *   U  shape [rows, k]
 *   S  shape [k]
 *   V  shape [k, cols]
 */
function reconstruct2D(U: Tensor, S: Tensor, V: Tensor): number[][] {
  const rows = U.shape[0];
  const cols = V.shape[1];
  const k = S.shape[0];

  const out: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let q = 0; q < k; q++) {
        sum += U.data[i * k + q] * S.data[q] * V.data[q * cols + j];
      }
      out[i][j] = sum;
    }
  }
  return out;
}

/**
 * Max absolute difference between two 2-D number arrays.
 */
function maxDiff2D(a: number[][], b: number[][]): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) {
      const d = Math.abs(a[i][j] - b[i][j]);
      if (d > max) max = d;
    }
  }
  return max;
}

/**
 * Max absolute difference between two flat Float64Arrays.
 */
function maxDiffFlat(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Rebuild a rank-3 tensor from a SVD that split axis 0 as the row axis.
 *
 * Input shape:  [d0, d1, d2]
 * rowAxes=[0]:
 *   U shape [d0, k]
 *   S shape [k]
 *   V shape [k, d1, d2]   (i.e. [k, d1*d2] conceptually)
 *
 * Reconstructed flat data of shape [d0, d1, d2]:
 *   out[i, j, l] = sum_q  U[i, q] * S[q] * V[q, j, l]
 */
function reconstructRank3(U: Tensor, S: Tensor, V: Tensor): Float64Array {
  const [d0, k] = U.shape as [number, number];
  const [_k, d1, d2] = V.shape as [number, number, number];
  const colSize = d1 * d2;

  const out = new Float64Array(d0 * d1 * d2);
  for (let i = 0; i < d0; i++) {
    for (let q = 0; q < k; q++) {
      const uVal = U.data[i * k + q] * S.data[q];
      for (let c = 0; c < colSize; c++) {
        out[i * colSize + c] += uVal * V.data[q * colSize + c];
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Known test matrices
// ---------------------------------------------------------------------------

/** 3×3 matrix with known singular values approximately 5, 3, 0. */
function makeRank2Matrix(): Tensor {
  // Construct via outer products to control the singular values.
  // A = 5 * u1*v1ᵀ + 3 * u2*v2ᵀ  (rank-2)
  // u1=[1,0,0], v1=[1,0,0]; u2=[0,1,0], v2=[0,1,0]
  return Tensor.fromNested(
    [
      [5, 0, 0],
      [0, 3, 0],
      [0, 0, 0],
    ],
    [3, 3]
  );
}

/** 4×4 diagonal matrix with singular values 6, 4, 2, 1e-15. */
function makeRank3Matrix(): Tensor {
  return Tensor.fromNested(
    [
      [6, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 2, 0],
      [0, 0, 0, 1e-15],
    ],
    [4, 4]
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorSvd', () => {
  // Test 1: Rank-2 reconstruction
  it('rank-2: U·diag(S)·V ≈ original to 1e-9', () => {
    const original = Tensor.fromNested(
      [
        [3, 1, 2],
        [1, 4, 0],
        [2, 0, 5],
      ],
      [3, 3]
    );
    const { U, S, V, truncatedDim } = tensorSvd(original, [0]);

    expect(U.shape).toEqual([3, truncatedDim]);
    expect(S.shape).toEqual([truncatedDim]);
    expect(V.shape).toEqual([truncatedDim, 3]);

    const rebuilt = reconstruct2D(U, S, V);
    const originalNested = original.toNested() as number[][];
    expect(maxDiff2D(rebuilt, originalNested)).toBeLessThan(1e-9);
  });

  // Test 2: Rank-3 input
  it('rank-3 with rowAxes=[0]: reshape to (3,20) and rebuild', () => {
    // Build a 3×4×5 tensor with controlled values.
    const size = 3 * 4 * 5;
    const data = new Float64Array(size);
    for (let i = 0; i < size; i++) data[i] = (i % 7) - 3; // simple deterministic values
    const t = new Tensor([3, 4, 5], data);

    const { U, S, V } = tensorSvd(t, [0]);

    // U: [3, k], S: [k], V: [k, 4, 5]
    expect(U.shape[0]).toBe(3);
    expect(V.shape[1]).toBe(4);
    expect(V.shape[2]).toBe(5);
    expect(S.shape[0]).toBe(U.shape[1]);
    expect(S.shape[0]).toBe(V.shape[0]);

    // Reconstruct and compare to original.
    const rebuilt = reconstructRank3(U, S, V);
    expect(maxDiffFlat(rebuilt, data)).toBeLessThan(1e-9);
  });

  // Test 3: Truncation with cutoff
  it('cutoff drops singular values below threshold; truncatedDim === 3 for rank-4 with one ~0 sv', () => {
    const t = makeRank3Matrix(); // singular values: 6, 4, 2, 1e-15
    const { truncatedDim, truncationError } = tensorSvd(t, [0], { cutoff: 1e-10 });

    expect(truncatedDim).toBe(3);
    // The dropped value squared is approximately (1e-15)^2 ≈ 1e-30; nearly zero.
    expect(truncationError).toBeGreaterThanOrEqual(0);
    expect(truncationError).toBeLessThan(1e-20);
  });

  // Test 4: Truncation with maxdim
  it('maxdim=2 keeps exactly 2 singular values', () => {
    const t = makeRank3Matrix(); // 4 singular values: 6, 4, 2, ~0
    const { U, S, V, truncatedDim } = tensorSvd(t, [0], { maxdim: 2 });

    expect(truncatedDim).toBe(2);
    expect(S.shape[0]).toBe(2);
    expect(U.shape[1]).toBe(2);
    expect(V.shape[0]).toBe(2);
  });

  // Test 5: Truncation error matches sum of squared dropped singular values
  it('truncationError === sum of squares of dropped singular values, to 1e-12', () => {
    const t = makeRank3Matrix(); // singular values: 6, 4, 2, 1e-15
    const { truncationError } = tensorSvd(t, [0], { maxdim: 2 });

    // Full SVD to get all singular values.
    const fullResult = tensorSvd(t, [0]);
    const allS = Array.from(fullResult.S.data);

    // Expected truncation error: sum of squares of dropped (i.e., allS[2]^2 + allS[3]^2)
    const expectedError = allS.slice(2).reduce((acc, s) => acc + s * s, 0);
    expect(Math.abs(truncationError - expectedError)).toBeLessThan(1e-12);
  });

  // Test 6: Full SVD (no opts) — not truncating
  it('full SVD (no opts): truncatedDim === min(rows, cols) and truncationError === 0', () => {
    const t = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    const { truncatedDim, truncationError } = tensorSvd(t, [0]);

    // 2×3 matrix: min(2, 3) = 2
    expect(truncatedDim).toBe(2);
    expect(truncationError).toBe(0);
  });

  // Test 7: Rectangular matrix rows > cols
  it('rectangular (rows > cols): reconstruction to 1e-9', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
      [4, 2]
    );
    const { U, S, V, truncatedDim } = tensorSvd(t, [0]);

    // min(4, 2) = 2
    expect(truncatedDim).toBe(2);
    expect(U.shape).toEqual([4, 2]);
    expect(S.shape).toEqual([2]);
    expect(V.shape).toEqual([2, 2]);

    const rebuilt = reconstruct2D(U, S, V);
    const original = t.toNested() as number[][];
    expect(maxDiff2D(rebuilt, original)).toBeLessThan(1e-9);
  });

  // Test 8: Rectangular matrix rows < cols
  it('rectangular (rows < cols): reconstruction to 1e-9', () => {
    const t = Tensor.fromNested(
      [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
      [2, 4]
    );
    const { U, S, V, truncatedDim } = tensorSvd(t, [0]);

    // min(2, 4) = 2
    expect(truncatedDim).toBe(2);
    expect(U.shape).toEqual([2, 2]);
    expect(S.shape).toEqual([2]);
    expect(V.shape).toEqual([2, 4]);

    const rebuilt = reconstruct2D(U, S, V);
    const original = t.toNested() as number[][];
    expect(maxDiff2D(rebuilt, original)).toBeLessThan(1e-9);
  });

  // Test 9: rowAxes order controls U shape (multi-axis row partition)
  it('rowAxes=[0,1] on rank-3 tensor folds first two axes into rows', () => {
    const t = new Tensor(
      [2, 3, 4],
      new Float64Array(2 * 3 * 4).fill(0).map((_, i) => i)
    );

    const { U, S, V } = tensorSvd(t, [0, 1]);

    // rows = 2*3 = 6, cols = 4, min = 4
    expect(U.shape[0]).toBe(2);
    expect(U.shape[1]).toBe(3);
    expect(U.shape[2]).toBe(S.shape[0]);
    expect(V.shape[0]).toBe(S.shape[0]);
    expect(V.shape[1]).toBe(4);
  });

  // Test 10: Both maxdim and cutoff — maxdim wins when it's smaller
  it('cutoff and maxdim together: maxdim wins when it is the tighter constraint', () => {
    // 4 singular values, all above cutoff=0.1, but maxdim=1
    const t = makeRank3Matrix(); // svs: 6, 4, 2, 1e-15
    const { truncatedDim } = tensorSvd(t, [0], { cutoff: 0.1, maxdim: 1 });
    expect(truncatedDim).toBe(1);
  });

  // Test 11: Both maxdim and cutoff — cutoff wins when it's tighter
  it('cutoff and maxdim together: cutoff wins when it drops more values', () => {
    // svs: 6, 4, 2, 1e-15. cutoff=3 drops values < 3: keeps 6, 4 → k=2. maxdim=4 doesn't constrain.
    const t = makeRank3Matrix();
    const { truncatedDim } = tensorSvd(t, [0], { cutoff: 3, maxdim: 4 });
    expect(truncatedDim).toBe(2);
  });

  // Test 12: Error when rowAxes covers all axes
  it('throws when rowAxes covers all axes', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorSvd(t, [0, 1])).toThrow();
  });

  // Test 13: Error when rowAxes is empty
  it('throws when rowAxes is empty', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorSvd(t, [])).toThrow();
  });

  // Test 14: joiningIndexName accepted without error
  it('joiningIndexName is accepted without error (no-op in Phase 2)', () => {
    const t = makeRank2Matrix();
    expect(() => tensorSvd(t, [0], { joiningIndexName: 'link' })).not.toThrow();
  });

  // Test 15: Truncation error is the sum of squared dropped singular values to 1e-12 (explicit check)
  it('truncationError matches manual computation for maxdim=1 to within 1e-12', () => {
    const t = makeRank3Matrix(); // svs: 6, 4, 2, ~0
    const { truncationError } = tensorSvd(t, [0], { maxdim: 1 });

    // Full singular values from no-truncation run.
    const { S: fullS } = tensorSvd(t, [0]);
    const allS = Array.from(fullS.data);

    // Dropped: allS[1], allS[2], allS[3]
    const expected = allS.slice(1).reduce((a, s) => a + s * s, 0);
    expect(Math.abs(truncationError - expected)).toBeLessThan(1e-12);
  });
});
