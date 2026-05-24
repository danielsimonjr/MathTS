/**
 * Tests for matrix cholesky — right-looking Cholesky decomposition.
 *
 * Coverage:
 *  1.  Known 2×2 SPD: L = [[2,0],[1,√2]] for A = [[4,2],[2,3]].
 *  2.  L · Lᵀ ≈ A for a generic 3×3 SPD matrix.
 *  3.  L is lower-triangular (zeros above diagonal).
 *  4.  L has positive diagonal entries.
 *  5.  Non-SPD (indefinite) matrix throws "positive definite".
 *  6.  Negative-definite matrix throws "positive definite".
 *  7.  Non-square matrix throws.
 *  8.  4×4 SPD reconstruction: L · Lᵀ ≈ A to 1e-9.
 *  9.  1×1 trivial: L = [[√v]] for A = [[v]].
 *  10. Result type has shape n×n.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { cholesky } from '../../src/operations/cholesky.js';

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

function fromNested(rows: number[][]): DenseMatrix {
  return DenseMatrix.fromArray(rows);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cholesky (matrix primitive)', () => {
  // Test 1: Known 2×2 SPD exact values
  it('known 2×2 SPD: L = [[2,0],[1,√2]] for A = [[4,2],[2,3]]', () => {
    const A = fromNested([
      [4, 2],
      [2, 3],
    ]);
    const { L } = cholesky(A);
    const lData = L.toFloat64Array();
    const sqrt2 = Math.sqrt(2);

    expect(lData[0]).toBeCloseTo(2, 12); // L[0,0]
    expect(lData[1]).toBeCloseTo(0, 12); // L[0,1] — zero (upper triangle)
    expect(lData[2]).toBeCloseTo(1, 12); // L[1,0]
    expect(lData[3]).toBeCloseTo(sqrt2, 12); // L[1,1]
  });

  // Test 2: L · Lᵀ ≈ A — 3×3 SPD
  it('L · Lᵀ ≈ A for a generic 3×3 SPD matrix', () => {
    const A = fromNested([
      [25, 15, -5],
      [15, 18, 0],
      [-5, 0, 11],
    ]);
    const { L } = cholesky(A);
    const n = 3;
    const lData = L.toFloat64Array();
    const aData = A.toFloat64Array();

    const Lt = transposeFlat(lData, n);
    const rebuilt = matMulFlat(lData, n, Lt);

    expect(maxAbsDiff(rebuilt, aData)).toBeLessThan(1e-9);
  });

  // Test 3: L is strictly lower-triangular (zeros above diagonal)
  it('L is lower-triangular — upper entries are zero', () => {
    const A = fromNested([
      [4, 2],
      [2, 3],
    ]);
    const { L } = cholesky(A);
    const n = 2;
    const lData = L.toFloat64Array();

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        expect(Math.abs(lData[i * n + j])).toBeLessThan(1e-15);
      }
    }
  });

  // Test 4: L has positive diagonal entries
  it('L diagonal entries are all positive', () => {
    const A = fromNested([
      [25, 15, -5],
      [15, 18, 0],
      [-5, 0, 11],
    ]);
    const { L } = cholesky(A);
    const n = 3;
    const lData = L.toFloat64Array();

    for (let i = 0; i < n; i++) {
      expect(lData[i * n + i]).toBeGreaterThan(0);
    }
  });

  // Test 5: Indefinite (symmetric but not PD) throws
  it('throws "positive definite" on indefinite symmetric matrix', () => {
    // [[1,2],[2,1]] is symmetric but det = 1-4 = -3 < 0; has negative eigenvalue.
    const A = fromNested([
      [1, 2],
      [2, 1],
    ]);
    expect(() => cholesky(A)).toThrow(/positive definite/);
  });

  // Test 6: Negative-definite matrix throws
  it('throws "positive definite" on negative-definite matrix', () => {
    const A = fromNested([
      [-4, 0],
      [0, -1],
    ]);
    expect(() => cholesky(A)).toThrow(/positive definite/);
  });

  // Test 7: Non-square matrix throws
  it('throws when matrix is not square', () => {
    const A = new DenseMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    expect(() => cholesky(A)).toThrow(/square/);
  });

  // Test 8: 4×4 SPD reconstruction
  it('4×4 SPD: L · Lᵀ ≈ A to 1e-9', () => {
    const A = fromNested([
      [18, 22, 54, 42],
      [22, 70, 86, 62],
      [54, 86, 174, 134],
      [42, 62, 134, 106],
    ]);
    const { L } = cholesky(A);
    const n = 4;
    const lData = L.toFloat64Array();
    const aData = A.toFloat64Array();

    const Lt = transposeFlat(lData, n);
    const rebuilt = matMulFlat(lData, n, Lt);

    expect(maxAbsDiff(rebuilt, aData)).toBeLessThan(1e-9);
  });

  // Test 9: 1×1 trivial
  it('1×1 trivial: L = [[√v]] for A = [[v]]', () => {
    const A = new DenseMatrix(1, 1, [9]);
    const { L } = cholesky(A);
    expect(L.toFloat64Array()[0]).toBeCloseTo(3, 12);
  });

  // Test 10: Result shape is n×n
  it('result L has shape n×n matching the input', () => {
    const A = fromNested([
      [25, 15, -5],
      [15, 18, 0],
      [-5, 0, 11],
    ]);
    const { L } = cholesky(A);
    expect(L.rows).toBe(3);
    expect(L.cols).toBe(3);
  });
});
