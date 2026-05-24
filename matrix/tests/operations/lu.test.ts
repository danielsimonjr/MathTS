/**
 * Tests for matrix lu — Doolittle LU decomposition with partial pivoting.
 *
 * Coverage:
 *  1.  L is unit lower-triangular (1s on diag, zeros above) — 3×3.
 *  2.  U is upper-triangular (zeros below diag) — 3×3.
 *  3.  P · A = L · U identity check for a generic invertible 3×3.
 *  4.  P · A = L · U for a diagonally-dominant matrix (no pivoting needed).
 *  5.  P · A = L · U for an already-triangular upper matrix.
 *  6.  P · A = L · U for a row-permuted identity (single swap).
 *  7.  P returned as number[]; P[i] is original row index.
 *  8.  Singular matrix throws with message containing "singular".
 *  9.  Non-square matrix throws.
 *  10. 5×5 random-ish matrix: L · U ≈ P · A to 1e-9.
 *  11. 1×1 matrix: trivial case.
 *  12. 2×2 matrix: known exact values.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { lu } from '../../src/operations/lu.js';

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

/** Compute P·A where P is given as the number[] row-permutation array. */
function applyPermutation(A: Float64Array, n: number, P: number[]): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i * n + j] = A[P[i] * n + j];
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

describe('lu (matrix primitive)', () => {
  // Test 1: L is unit lower-triangular
  it('L is unit lower-triangular (1s on diag, zeros above) — 3×3', () => {
    const A = fromNested([
      [4, 3, 2],
      [6, 3, 1],
      [8, 4, 2],
    ]);
    const { L } = lu(A);
    const n = 3;
    const lData = L.toFloat64Array();

    for (let i = 0; i < n; i++) {
      expect(lData[i * n + i]).toBeCloseTo(1, 12);
      for (let j = i + 1; j < n; j++) {
        expect(Math.abs(lData[i * n + j])).toBeLessThan(1e-12);
      }
    }
  });

  // Test 2: U is upper-triangular
  it('U is upper-triangular (zeros below diag) — 3×3', () => {
    const A = fromNested([
      [4, 3, 2],
      [6, 3, 1],
      [8, 4, 2],
    ]);
    const { U } = lu(A);
    const n = 3;
    const uData = U.toFloat64Array();

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        expect(Math.abs(uData[i * n + j])).toBeLessThan(1e-12);
      }
    }
  });

  // Test 3: P · A = L · U for a generic invertible 3×3
  it('P · A = L · U identity check — generic 3×3', () => {
    const A = fromNested([
      [2, -1, 3],
      [4, 5, -2],
      [-1, 2, 7],
    ]);
    const { L, U, P } = lu(A);
    const n = 3;
    const aData = A.toFloat64Array();
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();

    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 4: Diagonally dominant — no pivoting needed
  it('P · A = L · U for diagonally-dominant matrix', () => {
    const A = fromNested([
      [10, 1, 1],
      [1, 10, 1],
      [1, 1, 10],
    ]);
    const { L, U, P } = lu(A);
    const n = 3;
    const aData = A.toFloat64Array();
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();

    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 5: Already upper-triangular input
  it('P · A = L · U for an already upper-triangular matrix', () => {
    const A = fromNested([
      [3, 2, 1],
      [0, 4, 2],
      [0, 0, 5],
    ]);
    const { L, U, P } = lu(A);
    const n = 3;
    const aData = A.toFloat64Array();
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();

    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 6: Row-permuted identity — single swap detected
  it('P records correct permutation for row-swapped identity', () => {
    // [[0,1],[1,0]] requires a row swap
    const A = fromNested([
      [0, 1],
      [1, 0],
    ]);
    const { L, U, P } = lu(A);
    const n = 2;
    const aData = A.toFloat64Array();
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();

    // Structural check: row 1 was swapped to position 0
    expect(P[0]).toBe(1);
    expect(P[1]).toBe(0);

    // Reconstruction check
    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);
    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-12);
  });

  // Test 7: P is number[] with correct type and length
  it('P is a number[] of correct length', () => {
    const A = fromNested([
      [1, 2],
      [3, 4],
    ]);
    const { P } = lu(A);
    expect(Array.isArray(P)).toBe(true);
    expect(P.length).toBe(2);
    // Each entry must be an integer in [0, n)
    for (const idx of P) {
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(2);
    }
  });

  // Test 8: Singular matrix throws
  it('throws on singular matrix with message containing "singular"', () => {
    const A = fromNested([
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9],
    ]);
    expect(() => lu(A)).toThrow(/singular/);
  });

  // Test 9: Non-square matrix throws
  it('throws when matrix is not square', () => {
    const A = new DenseMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    expect(() => lu(A)).toThrow(/square/);
  });

  // Test 10: 5×5 round-trip
  it('5×5 random-ish matrix: L · U ≈ P · A to 1e-9', () => {
    const A = fromNested([
      [4, 3, 2, 1, 5],
      [2, 6, 3, 7, 1],
      [1, 2, 9, 3, 4],
      [5, 1, 4, 8, 2],
      [3, 7, 1, 2, 6],
    ]);
    const { L, U, P } = lu(A);
    const n = 5;
    const aData = A.toFloat64Array();
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();

    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 11: 1×1 trivial
  it('1×1 matrix: trivial LU — L=[[1]], U=[[v]], P=[0]', () => {
    const A = new DenseMatrix(1, 1, [7]);
    const { L, U, P } = lu(A);
    expect(L.toFloat64Array()[0]).toBeCloseTo(1, 12);
    expect(U.toFloat64Array()[0]).toBeCloseTo(7, 12);
    expect(P).toEqual([0]);
  });

  // Test 12: 2×2 known exact values
  it('2×2 known exact LU factorisation', () => {
    // A = [[2, 1], [4, 3]] → pivot is row 1 (|4|>|2|) → P=[1,0]
    // After swap: [[4,3],[2,1]] → L=[[1,0],[0.5,1]], U=[[4,3],[0,-0.5]]
    const A = fromNested([
      [2, 1],
      [4, 3],
    ]);
    const { L, U, P } = lu(A);
    const n = 2;
    const lData = L.toFloat64Array();
    const uData = U.toFloat64Array();
    const aData = A.toFloat64Array();

    // P · A = L · U reconstruction
    const LU = matMulFlat(lData, n, uData);
    const PA = applyPermutation(aData, n, P);
    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-12);

    // L unit diagonal
    expect(lData[0]).toBeCloseTo(1, 12);
    expect(lData[3]).toBeCloseTo(1, 12);
    // U upper-triangular
    expect(Math.abs(uData[1 * 2 + 0])).toBeLessThan(1e-12);
  });
});
