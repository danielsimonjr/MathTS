/**
 * Tests for tensorCholesky — Cholesky decomposition for SPD matrices.
 *
 * Coverage:
 *  1.  Known 2×2 SPD: L = [[2,0],[1,√2]] for A = [[4,2],[2,3]].
 *  2.  L · Lᵀ ≈ A to 1e-9 for a generic 3×3 SPD matrix.
 *  3.  Non-square reshaped matrix throws.
 *  4.  Non-SPD (negative eigenvalue) matrix throws.
 *  5.  `lower: false` returns the upper-triangular form: Uᵀ · U ≈ A.
 *  6.  axisLabels propagation.
 *  7.  Larger 4×4 SPD reconstructs to 1e-9.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorCholesky } from '../../src/operations/cholesky';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matMulFlat(a: Float64Array, n: number, b: Float64Array): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += a[i * n + k] * b[k * n + j];
      }
      out[i * n + j] = sum;
    }
  }
  return out;
}

function transposeFlat(a: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[j * n + i] = a[i * n + j];
    }
  }
  return out;
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorCholesky', () => {
  // Test 1: Known 2×2 SPD
  it('known 2×2 SPD: L = [[2,0],[1,√2]] for A = [[4,2],[2,3]]', () => {
    const A = Tensor.fromNested(
      [
        [4, 2],
        [2, 3],
      ],
      [2, 2]
    );
    const { L } = tensorCholesky(A, [0]);

    // Expected L: [[2, 0], [1, √2]]
    const sqrt2 = Math.sqrt(2);
    expect(L.data[0]).toBeCloseTo(2, 12);
    expect(L.data[1]).toBeCloseTo(0, 12);
    expect(L.data[2]).toBeCloseTo(1, 12);
    expect(L.data[3]).toBeCloseTo(sqrt2, 12);
  });

  // Test 2: Reconstruction L · Lᵀ ≈ A
  it('L · Lᵀ ≈ A for a generic 3×3 SPD matrix', () => {
    // SPD: I + B·Bᵀ for any B.
    const A = Tensor.fromNested(
      [
        [25, 15, -5],
        [15, 18, 0],
        [-5, 0, 11],
      ],
      [3, 3]
    );
    const { L } = tensorCholesky(A, [0]);
    const n = 3;

    const Lt = transposeFlat(L.data, n);
    const rebuilt = matMulFlat(L.data, n, Lt);

    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 3: Non-square throws
  it('throws when reshaped matrix is non-square', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(() => tensorCholesky(A, [0])).toThrow(/square/);
  });

  // Test 4: Non-SPD throws
  it('throws on non-positive-definite matrix', () => {
    // Symmetric but indefinite (det = -1 - 4 = -5, has a negative eigenvalue).
    const A = Tensor.fromNested(
      [
        [1, 2],
        [2, 1],
      ],
      [2, 2]
    );
    expect(() => tensorCholesky(A, [0])).toThrow(/positive definite/);
  });

  // Test 5: lower: false → Uᵀ · U ≈ A
  it("lower: false returns U such that Uᵀ · U ≈ A", () => {
    const A = Tensor.fromNested(
      [
        [4, 2],
        [2, 3],
      ],
      [2, 2]
    );
    const { L: U } = tensorCholesky(A, [0], { lower: false });

    // U is upper-triangular: U[1][0] should be zero.
    expect(Math.abs(U.data[1 * 2 + 0])).toBeLessThan(1e-12);

    const n = 2;
    const Ut = transposeFlat(U.data, n);
    const rebuilt = matMulFlat(Ut, n, U.data);

    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });

  // Test 6: axisLabels propagation
  it('propagates axisLabels: L has rowAxes labels + joining', () => {
    const i = new Index(3, { name: 'i' });
    const j = new Index(3, { name: 'j' });
    const A = new Tensor(
      [3, 3],
      new Float64Array([25, 15, -5, 15, 18, 0, -5, 0, 11]),
      [i, j]
    );

    const { L } = tensorCholesky(A, [0], { joiningIndexName: 'mid' });

    expect(L.axisLabels).toBeDefined();
    expect(L.axisLabels![0]).toBe(i);
    expect(L.axisLabels![1].name).toBe('mid');
  });

  // Test 7: 4×4 SPD reconstruction
  it('4×4 SPD: L · Lᵀ ≈ A to 1e-9', () => {
    // Build SPD by I + B·Bᵀ with random-ish B. We use a hand-picked SPD.
    const A = Tensor.fromNested(
      [
        [18, 22, 54, 42],
        [22, 70, 86, 62],
        [54, 86, 174, 134],
        [42, 62, 134, 106],
      ],
      [4, 4]
    );
    const { L } = tensorCholesky(A, [0]);
    const n = 4;

    const Lt = transposeFlat(L.data, n);
    const rebuilt = matMulFlat(L.data, n, Lt);

    expect(maxAbsDiff(rebuilt, A.data)).toBeLessThan(1e-9);
  });
});
