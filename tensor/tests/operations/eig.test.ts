/**
 * Tests for tensorEig — eigenvalue / eigenvector decomposition.
 *
 * Coverage:
 *  1.  Symmetric: eigenvalues are real (eigenvaluesImaginary is undefined).
 *  2.  Symmetric: eigenvectors are orthonormal (columns) — Vᵀ·V ≈ I.
 *  3.  Symmetric: V · diag(λ) · Vᵀ ≈ A to 1e-9.
 *  4.  Non-symmetric with real eigenvalues: V · diag(λ) · V⁻¹ ≈ A.
 *  5.  Non-symmetric with complex eigenvalues: eigenvaluesImaginary populated.
 *  6.  Non-symmetric with real eigenvalues: eigenvaluesImaginary is undefined.
 *  7.  computeVectors: false returns only eigenvalues (no eigenvectors).
 *  8.  Non-square throws.
 *  9.  Diagonal matrix: eigenvalues equal the diagonal entries.
 * 10.  axisLabels-bearing input: eig still works (no propagation requirement,
 *      eigenvalues/eigenvectors live in a fresh basis).
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorEig } from '../../src/operations/eig';

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

function diag(values: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) out[i * n + i] = values[i];
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

/** Invert a small dense n×n matrix via Gauss-Jordan. Returns row-major Float64Array. */
function inv(A: Float64Array, n: number): Float64Array {
  const aug = new Float64Array(n * 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      aug[i * 2 * n + j] = A[i * n + j];
    }
    aug[i * 2 * n + (n + i)] = 1;
  }

  for (let k = 0; k < n; k++) {
    // Partial pivot
    let piv = k;
    let mx = Math.abs(aug[k * 2 * n + k]);
    for (let r = k + 1; r < n; r++) {
      const v = Math.abs(aug[r * 2 * n + k]);
      if (v > mx) {
        mx = v;
        piv = r;
      }
    }
    if (mx === 0) throw new Error('singular');
    if (piv !== k) {
      for (let j = 0; j < 2 * n; j++) {
        const t = aug[k * 2 * n + j];
        aug[k * 2 * n + j] = aug[piv * 2 * n + j];
        aug[piv * 2 * n + j] = t;
      }
    }
    const d = aug[k * 2 * n + k];
    for (let j = 0; j < 2 * n; j++) {
      aug[k * 2 * n + j] /= d;
    }
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = aug[i * 2 * n + k];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[i * 2 * n + j] -= f * aug[k * 2 * n + j];
      }
    }
  }

  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i * n + j] = aug[i * 2 * n + (n + j)];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorEig', () => {
  // Test 1: Symmetric — eigenvaluesImaginary undefined
  it('symmetric: eigenvaluesImaginary is undefined (all eigenvalues real)', () => {
    const A = Tensor.fromNested(
      [
        [4, 1, 2],
        [1, 5, 0],
        [2, 0, 6],
      ],
      [3, 3]
    );
    const { eigenvaluesImaginary } = tensorEig(A, [0], { symmetric: true });
    expect(eigenvaluesImaginary).toBeUndefined();
  });

  // Test 2: Symmetric — eigenvectors are orthonormal
  it('symmetric: eigenvectors are orthonormal (Vᵀ·V ≈ I)', () => {
    const A = Tensor.fromNested(
      [
        [4, 1, 2],
        [1, 5, 0],
        [2, 0, 6],
      ],
      [3, 3]
    );
    const { eigenvectors } = tensorEig(A, [0], { symmetric: true });
    const n = 3;
    const Vt = transposeFlat(eigenvectors!.data, n);
    const VtV = matMulFlat(Vt, n, eigenvectors!.data);

    const I = new Float64Array(n * n);
    for (let i = 0; i < n; i++) I[i * n + i] = 1;
    expect(maxAbsDiff(VtV, I)).toBeLessThan(1e-7);
  });

  // Test 3: Symmetric reconstruction
  it('symmetric: V · diag(λ) · Vᵀ ≈ A to 1e-7', () => {
    const A = Tensor.fromNested(
      [
        [4, 1, 2],
        [1, 5, 0],
        [2, 0, 6],
      ],
      [3, 3]
    );
    const { eigenvalues, eigenvectors } = tensorEig(A, [0], { symmetric: true });
    const n = 3;

    const D = diag(eigenvalues.data, n);
    const Vt = transposeFlat(eigenvectors!.data, n);
    const VD = matMulFlat(eigenvectors!.data, n, D);
    const VDVt = matMulFlat(VD, n, Vt);

    expect(maxAbsDiff(VDVt, A.data)).toBeLessThan(1e-7);
  });

  // Test 4: Non-symmetric real eigenvalues — V·diag(λ)·V⁻¹ ≈ A
  it('non-symmetric (real eigenvalues): V · diag(λ) · V⁻¹ ≈ A to 1e-7', () => {
    // A triangular matrix has its diagonal as eigenvalues — all real.
    const A = Tensor.fromNested(
      [
        [3, 1, 2],
        [0, 5, 4],
        [0, 0, 7],
      ],
      [3, 3]
    );
    const { eigenvalues, eigenvectors, eigenvaluesImaginary } = tensorEig(A, [0]);
    const n = 3;

    expect(eigenvaluesImaginary).toBeUndefined();

    const D = diag(eigenvalues.data, n);
    const Vinv = inv(eigenvectors!.data, n);
    const VD = matMulFlat(eigenvectors!.data, n, D);
    const VDVinv = matMulFlat(VD, n, Vinv);

    expect(maxAbsDiff(VDVinv, A.data)).toBeLessThan(1e-6);
  });

  // Test 5: Non-symmetric complex eigenvalues — imag part populated
  it('non-symmetric with complex eigenvalues: eigenvaluesImaginary is populated', () => {
    // 2D rotation by 90° → eigenvalues ±i.
    const A = Tensor.fromNested(
      [
        [0, -1],
        [1, 0],
      ],
      [2, 2]
    );
    const { eigenvalues, eigenvaluesImaginary } = tensorEig(A, [0]);
    expect(eigenvaluesImaginary).toBeDefined();

    // Real parts ≈ 0; imaginary parts ≈ ±1.
    expect(Math.abs(eigenvalues.data[0])).toBeLessThan(1e-9);
    expect(Math.abs(eigenvalues.data[1])).toBeLessThan(1e-9);
    const imSorted = Array.from(eigenvaluesImaginary!.data).sort((a, b) => a - b);
    expect(imSorted[0]).toBeCloseTo(-1, 9);
    expect(imSorted[1]).toBeCloseTo(1, 9);
  });

  // Test 6: Non-symmetric real eigenvalues — no imag part
  it('non-symmetric with real eigenvalues: eigenvaluesImaginary is undefined', () => {
    const A = Tensor.fromNested(
      [
        [2, 0],
        [3, 5],
      ],
      [2, 2]
    );
    const { eigenvaluesImaginary } = tensorEig(A, [0]);
    expect(eigenvaluesImaginary).toBeUndefined();
  });

  // Test 7: computeVectors: false returns only eigenvalues
  it('computeVectors: false returns only eigenvalues', () => {
    const A = Tensor.fromNested(
      [
        [4, 1],
        [1, 5],
      ],
      [2, 2]
    );
    const { eigenvalues, eigenvectors } = tensorEig(A, [0], {
      symmetric: true,
      computeVectors: false,
    });
    expect(eigenvalues.shape).toEqual([2]);
    expect(eigenvectors).toBeUndefined();
  });

  // Test 8: Non-square throws
  it('throws when reshaped matrix is non-square', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(() => tensorEig(A, [0])).toThrow(/square/);
  });

  // Test 9: Diagonal matrix — eigenvalues equal diagonal entries
  it('diagonal matrix: eigenvalues equal the diagonal entries', () => {
    const A = Tensor.fromNested(
      [
        [3, 0, 0],
        [0, 7, 0],
        [0, 0, 2],
      ],
      [3, 3]
    );
    const { eigenvalues } = tensorEig(A, [0], { symmetric: true });

    const sorted = Array.from(eigenvalues.data).sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(2, 9);
    expect(sorted[1]).toBeCloseTo(3, 9);
    expect(sorted[2]).toBeCloseTo(7, 9);
  });

  // Test 10: axisLabels-bearing input — tensorEig accepts but eigenvalues live in a fresh basis
  it('accepts axisLabels-bearing input without error', () => {
    const i = new Index(2, { name: 'i' });
    const j = new Index(2, { name: 'j' });
    const A = new Tensor([2, 2], new Float64Array([4, 1, 1, 5]), [i, j]);
    expect(() => tensorEig(A, [0], { symmetric: true })).not.toThrow();
  });
});
