/**
 * WASM-accelerated Eigendecomposition Tests
 *
 * Tests the eigWasm function which provides WASM acceleration for
 * symmetric matrices and falls back to JS for non-symmetric/small matrices.
 *
 * Note: In CI/test environments without WASM loaded, these tests verify
 * the JS fallback path which should produce identical results.
 */

import { describe, it, expect } from 'vitest';
import {
  eigWasm,
  eigvalsWasm,
  spectralRadiusWasm,
} from '../../src/operations/eig-wasm.js';

/**
 * Helper: matrix-vector multiply
 */
function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < A[i].length; j++) {
      result[i] += A[i][j] * v[j];
    }
  }
  return result;
}

/**
 * Helper: vector norm
 */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Sort eigenvalues by real part descending for comparison
 */
function sortEigenvalues(
  values: Array<{ re: number; im: number }>
): Array<{ re: number; im: number }> {
  return [...values].sort((a, b) => b.re - a.re);
}

describe('eigWasm', () => {
  it('handles empty matrix', async () => {
    const result = await eigWasm([]);
    expect(result.values).toEqual([]);
    expect(result.vectors).toEqual([]);
    expect(result.isSymmetric).toBe(true);
  });

  it('handles 1x1 matrix', async () => {
    const result = await eigWasm([[5]]);
    expect(result.values).toHaveLength(1);
    expect(result.values[0].re).toBeCloseTo(5, 10);
    expect(result.values[0].im).toBeCloseTo(0, 10);
  });

  it('finds eigenvalues of 2x2 identity matrix', async () => {
    const result = await eigWasm([
      [1, 0],
      [0, 1],
    ]);
    expect(result.values).toHaveLength(2);
    const sorted = sortEigenvalues(result.values);
    expect(sorted[0].re).toBeCloseTo(1, 10);
    expect(sorted[1].re).toBeCloseTo(1, 10);
  });

  it('finds eigenvalues of 2x2 symmetric matrix', async () => {
    const m = [
      [2, 1],
      [1, 2],
    ];
    const result = await eigWasm(m);
    expect(result.values).toHaveLength(2);
    expect(result.isSymmetric).toBe(true);

    const sorted = sortEigenvalues(result.values);
    expect(sorted[0].re).toBeCloseTo(3, 6);
    expect(sorted[1].re).toBeCloseTo(1, 6);
  });

  it('finds eigenvalues of 3x3 symmetric matrix', async () => {
    const m = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ];
    const result = await eigWasm(m);
    expect(result.values).toHaveLength(3);
    expect(result.isSymmetric).toBe(true);

    // Eigenvalues of this matrix are approximately 4.732, 2.268, 2.0
    // (roots of characteristic polynomial)
    const sorted = sortEigenvalues(result.values);
    // All imaginary parts should be 0 for symmetric matrix
    for (const v of sorted) {
      expect(v.im).toBeCloseTo(0, 6);
    }
    // Sum of eigenvalues = trace = 4 + 3 + 2 = 9
    const eigSum = sorted.reduce((s, v) => s + v.re, 0);
    expect(eigSum).toBeCloseTo(9, 6);
  });

  it('finds eigenvalues of diagonal matrix', async () => {
    const m = [
      [3, 0, 0],
      [0, 7, 0],
      [0, 0, -2],
    ];
    const result = await eigWasm(m);
    const sorted = sortEigenvalues(result.values);
    expect(sorted[0].re).toBeCloseTo(7, 6);
    expect(sorted[1].re).toBeCloseTo(3, 6);
    expect(sorted[2].re).toBeCloseTo(-2, 6);
  });

  it('verifies eigenvectors satisfy Av = lambda*v', async () => {
    const m = [
      [2, 1],
      [1, 2],
    ];
    const result = await eigWasm(m);

    for (let k = 0; k < result.values.length; k++) {
      const eigenvalue = result.values[k];
      const eigenvector = result.vectors[k];

      if (eigenvalue.im !== 0) continue;
      if (norm(eigenvector) < 1e-6) continue;

      const Av = matvec(m, eigenvector);
      const lambdaV = eigenvector.map((x) => x * eigenvalue.re);

      for (let i = 0; i < Av.length; i++) {
        const scale = Math.max(1, Math.abs(Av[i]), Math.abs(lambdaV[i]));
        expect(Math.abs(Av[i] - lambdaV[i]) / scale).toBeLessThan(1e-4);
      }
    }
  });

  it('handles non-symmetric matrix (uses JS fallback)', async () => {
    const m = [
      [0, -1],
      [1, 0],
    ];
    const result = await eigWasm(m);
    expect(result.values).toHaveLength(2);
    expect(result.isSymmetric).toBe(false);

    // Eigenvalues should be +/- i
    const sorted = [...result.values].sort((a, b) => b.im - a.im);
    expect(sorted[0].re).toBeCloseTo(0, 6);
    expect(Math.abs(sorted[0].im)).toBeCloseTo(1, 6);
  });

  it('throws on non-square matrix', async () => {
    await expect(
      eigWasm([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).rejects.toThrow('Matrix must be square');
  });
});

describe('eigvalsWasm', () => {
  it('returns only eigenvalues', async () => {
    const m = [
      [4, 1],
      [1, 4],
    ];
    const values = await eigvalsWasm(m);
    expect(values).toHaveLength(2);
    const sorted = sortEigenvalues(values);
    expect(sorted[0].re).toBeCloseTo(5, 6);
    expect(sorted[1].re).toBeCloseTo(3, 6);
  });
});

describe('spectralRadiusWasm', () => {
  it('computes spectral radius of symmetric matrix', async () => {
    const m = [
      [2, 1],
      [1, 2],
    ];
    const radius = await spectralRadiusWasm(m);
    expect(radius).toBeCloseTo(3, 4);
  });

  it('computes spectral radius of identity matrix', async () => {
    const m = [
      [1, 0],
      [0, 1],
    ];
    const radius = await spectralRadiusWasm(m);
    expect(radius).toBeCloseTo(1, 4);
  });

  it('computes spectral radius of diagonal matrix', async () => {
    const m = [
      [5, 0],
      [0, -3],
    ];
    const radius = await spectralRadiusWasm(m);
    expect(radius).toBeCloseTo(5, 4);
  });
});
