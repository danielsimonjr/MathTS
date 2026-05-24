/**
 * Tests for tensorQr — QR decomposition for rank-N tensors.
 *
 * Coverage:
 *  1.  Square matrix: Q · R ≈ A to 1e-9.
 *  2.  Q has orthonormal columns: Qᵀ · Q ≈ I to 1e-9.
 *  3.  R is upper-triangular (zeros below diagonal in reduced mode).
 *  4.  Rectangular (rows > cols): thin Q shape (m, n); R shape (n, n).
 *  5.  Rectangular (rows < cols): thin Q shape (m, m); R shape (m, n).
 *  6.  Rank-3 input with rowAxes=[0]: reshape, factor, verify.
 *  7.  axisLabels propagation: Q and R carry expected labels.
 *  8.  Full-mode QR: Q is square (m × m).
 *  9.  Throws when rowAxes is empty.
 * 10.  Throws when rowAxes covers all axes.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorQr } from '../../src/operations/qr';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Multiply two rank-2 Tensors stored as row-major Float64Arrays. */
function matMulFlat(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number
): Float64Array {
  const out = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i * aCols + k] * b[k * bCols + j];
      }
      out[i * bCols + j] = sum;
    }
  }
  return out;
}

function maxAbsDiff(a: Float64Array, b: Float64Array | number[]): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - (b instanceof Float64Array ? b[i] : b[i]));
    if (d > max) max = d;
  }
  return max;
}

/** Transpose a row-major Float64Array m×n into n×m. */
function transposeFlat(a: Float64Array, m: number, n: number): Float64Array {
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      out[j * m + i] = a[i * n + j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorQr', () => {
  // Test 1: Square matrix reconstruction
  it('square 3×3: Q·R reconstructs A to 1e-9', () => {
    const A = Tensor.fromNested(
      [
        [12, -51, 4],
        [6, 167, -68],
        [-4, 24, -41],
      ],
      [3, 3]
    );
    const { Q, R } = tensorQr(A, [0]);

    expect(Q.shape).toEqual([3, 3]);
    expect(R.shape).toEqual([3, 3]);

    const rebuilt = matMulFlat(Q.data, 3, 3, R.data, 3);
    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 2: Orthonormal columns of Q
  it('Q has orthonormal columns: Qᵀ·Q ≈ I to 1e-9', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 10],
      ],
      [3, 3]
    );
    const { Q } = tensorQr(A, [0]);
    const m = Q.shape[0];
    const k = Q.shape[1];

    const Qt = transposeFlat(Q.data, m, k);
    const QtQ = matMulFlat(Qt, k, m, Q.data, k);

    // Compare with identity of size k
    const I = new Float64Array(k * k);
    for (let i = 0; i < k; i++) I[i * k + i] = 1;
    expect(maxAbsDiff(QtQ, I)).toBeLessThan(1e-9);
  });

  // Test 3: R is upper-triangular
  it('R is upper-triangular (zeros below diagonal)', () => {
    const A = Tensor.fromNested(
      [
        [4, -2, 3],
        [1, 5, -1],
        [2, 0, 6],
      ],
      [3, 3]
    );
    const { R } = tensorQr(A, [0]);

    const n = R.shape[1];
    const rRows = R.shape[0];
    for (let i = 0; i < rRows; i++) {
      for (let j = 0; j < i; j++) {
        expect(Math.abs(R.data[i * n + j])).toBeLessThan(1e-12);
      }
    }
  });

  // Test 4: Rectangular rows > cols
  it('rectangular (rows > cols): thin QR reconstructs A to 1e-9', () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
      [4, 2]
    );
    const { Q, R } = tensorQr(A, [0]);

    // Reduced: Q (4×2), R (2×2)
    expect(Q.shape).toEqual([4, 2]);
    expect(R.shape).toEqual([2, 2]);

    const rebuilt = matMulFlat(Q.data, 4, 2, R.data, 2);
    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 5: Rectangular rows < cols
  it('rectangular (rows < cols): thin QR reconstructs A to 1e-9', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
      [2, 4]
    );
    const { Q, R } = tensorQr(A, [0]);

    // Reduced: Q (2×2), R (2×4)
    expect(Q.shape).toEqual([2, 2]);
    expect(R.shape).toEqual([2, 4]);

    const rebuilt = matMulFlat(Q.data, 2, 2, R.data, 4);
    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 6: Rank-3 input with rowAxes=[0]
  it('rank-3 input with rowAxes=[0] reconstructs to 1e-9', () => {
    // 3×4×5 tensor with deterministic values.
    const size = 3 * 4 * 5;
    const data = new Float64Array(size);
    for (let i = 0; i < size; i++) data[i] = (i % 11) - 5;
    const t = new Tensor([3, 4, 5], data);
    const { Q, R } = tensorQr(t, [0]);

    // Reduced: rows=3, cols=20 → k=3. Q shape [3,3], R shape [3,4,5].
    expect(Q.shape).toEqual([3, 3]);
    expect(R.shape).toEqual([3, 4, 5]);

    // Reconstruct: A_flat = Q · R_flattened, where R_flattened is [3, 20].
    const rebuilt = matMulFlat(Q.data, 3, 3, R.data, 4 * 5);
    expect(maxAbsDiff(rebuilt, data)).toBeLessThan(1e-9);
  });

  // Test 7: axisLabels propagation
  it('propagates axisLabels: Q has rowAxes labels + joining, R has joining + colAxes labels', () => {
    const i = new Index(3, { name: 'i' });
    const j = new Index(2, { name: 'j' });
    const A = new Tensor([3, 2], new Float64Array([1, 2, 3, 4, 5, 6]), [i, j]);

    const { Q, R } = tensorQr(A, [0], { joiningIndexName: 'mid' });

    expect(Q.axisLabels).toBeDefined();
    expect(R.axisLabels).toBeDefined();
    expect(Q.axisLabels![0]).toBe(i);
    expect(R.axisLabels![1]).toBe(j);
    // Joining index between Q's last and R's first axis should match (same object).
    expect(Q.axisLabels![1].matches(R.axisLabels![0])).toBe(true);
    expect(Q.axisLabels![1].name).toBe('mid');
  });

  // Test 8: Full-mode QR
  it("'full' mode: Q is square (m × m)", () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
      [4, 2]
    );
    const { Q, R } = tensorQr(A, [0], { mode: 'full' });

    expect(Q.shape).toEqual([4, 4]);
    expect(R.shape).toEqual([4, 2]);

    // Reconstruct A
    const rebuilt = matMulFlat(Q.data, 4, 4, R.data, 2);
    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 9: Throws on empty rowAxes
  it('throws when rowAxes is empty', () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorQr(A, [])).toThrow();
  });

  // Test 10: Throws when rowAxes covers all axes
  it('throws when rowAxes covers all axes', () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorQr(A, [0, 1])).toThrow();
  });
});
