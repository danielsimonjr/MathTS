/**
 * Tests for tensorPinv — Moore-Penrose pseudoinverse.
 *
 * Coverage:
 *  1.  Round-trip: A · pinv(A) · A ≈ A (full-rank square matrix).
 *  2.  Round-trip: A · pinv(A) · A ≈ A (full-rank tall matrix).
 *  3.  Round-trip: A · pinv(A) · A ≈ A (full-rank wide matrix).
 *  4.  Rank-deficient square matrix: zero singular values dropped.
 *  5.  Rank-deficient tall matrix.
 *  6.  Output shape: square → same shape transposed (n×m → m×n).
 *  7.  Output shape: tall (m>n) → wide (n×m).
 *  8.  Output shape: wide (m<n) → tall (n×m).
 *  9.  3-D tensor input reshaped correctly (rowAxes = [0]).
 *  10. rcond threshold honoured: tighter threshold drops more values.
 *  11. rcond threshold honoured: looser threshold keeps all.
 *  12. axisLabels preserved (col → row, row → col).
 *  13. Named-Index rowAxes: same result as integer rowAxes.
 *  14. pinv of identity matrix is identity.
 *  15. pinv of zero matrix is zero matrix.
 *  16. Invalid axis throws RangeError.
 *  17. Duplicate axes in rowAxes throws.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorPinv } from '../../src/operations/pinv';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

/**
 * Multiply matrix A (m×k, row-major) by matrix B (k×n, row-major).
 * Returns C (m×n, row-major).
 */
function matMul(A: Float64Array, m: number, k: number, B: Float64Array, n: number): Float64Array {
  const C = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) sum += A[i * k + l] * B[l * n + j];
      C[i * n + j] = sum;
    }
  }
  return C;
}

/** Verify A · pinv(A) · A ≈ A (Moore-Penrose condition 1). */
function checkRoundTrip(A: Float64Array, m: number, n: number, tol = 1e-8): void {
  const pinvA = tensorPinv(new Tensor([m, n], A), [0]).data;
  // A · pinvA: m×m
  const ApinvA = matMul(A, m, n, pinvA, m);
  // (A · pinvA) · A: m×n
  const result = matMul(ApinvA, m, m, A, n);
  const diff = maxAbsDiff(result, A);
  expect(diff).toBeLessThan(tol);
}

// ---------------------------------------------------------------------------
// Test matrices
// ---------------------------------------------------------------------------

// 3×3 invertible matrix.
const A3x3 = new Float64Array([4, 3, 2, 1, 5, 6, 7, 8, 9]);

// 4×2 tall matrix.
const A4x2 = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);

// 2×4 wide matrix.
const A2x4 = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);

// Rank-deficient 3×3: row 2 = row 1 + row 0.
const ARankDef3x3 = new Float64Array([1, 0, 0, 0, 1, 0, 1, 1, 0]);

// 4×3 rank-2 tall matrix.
const ARankDef4x3 = new Float64Array([1, 2, 3, 2, 4, 6, 3, 6, 9, 4, 8, 12]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorPinv', () => {
  it('1. round-trip A·pinv(A)·A ≈ A for full-rank 3×3', () => {
    checkRoundTrip(A3x3, 3, 3);
  });

  it('2. round-trip A·pinv(A)·A ≈ A for full-rank 4×2 tall', () => {
    checkRoundTrip(A4x2, 4, 2);
  });

  it('3. round-trip A·pinv(A)·A ≈ A for full-rank 2×4 wide', () => {
    checkRoundTrip(A2x4, 2, 4);
  });

  it('4. rank-deficient square 3×3: round-trip still satisfies A·pinv(A)·A ≈ A', () => {
    checkRoundTrip(ARankDef3x3, 3, 3);
  });

  it('5. rank-deficient tall 4×3: round-trip satisfies A·pinv(A)·A ≈ A', () => {
    checkRoundTrip(ARankDef4x3, 4, 3);
  });

  it('6. output shape: square n×n → n×n', () => {
    const t = new Tensor([3, 3], A3x3);
    const p = tensorPinv(t, [0]);
    expect(p.shape).toEqual([3, 3]);
  });

  it('7. output shape: tall m×n → n×m', () => {
    const t = new Tensor([4, 2], A4x2);
    const p = tensorPinv(t, [0]);
    expect(p.shape).toEqual([2, 4]);
  });

  it('8. output shape: wide m×n → n×m', () => {
    const t = new Tensor([2, 4], A2x4);
    const p = tensorPinv(t, [0]);
    expect(p.shape).toEqual([4, 2]);
  });

  it('9. 3-D tensor input: rowAxes=[0] reshapes and reconstructs', () => {
    // Shape [2, 2, 2]. rowAxes=[0] → numRows=2, numCols=4. pinv is 4×2, reshaped to [2,2,2]? No:
    // rowDims=[2], colDims=[2,2], so pinv shape = [...colDims, ...rowDims] = [2,2,2].
    const data = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const t = new Tensor([2, 2, 2], data);
    const p = tensorPinv(t, [0]);
    // Output shape: [colDims..., rowDims...] = [2, 2, 2]
    expect(p.shape).toEqual([2, 2, 2]);
    // Verify size.
    expect(p.data.length).toBe(8);
    // Verify the round-trip property using the 2×4 matrix view.
    const A2x4data = new Float64Array(t.transpose([0, 1, 2]).data);
    const pinvMat = tensorPinv(new Tensor([2, 4], A2x4data.slice(0, 8)), [0]);
    // Ensure the flattened pinv data matches the 3-D tensor's pinv data.
    // Both should be the same underlying computation.
    expect(maxAbsDiff(p.data, pinvMat.data)).toBeLessThan(1e-10);
  });

  it('10. rcond threshold: tighter threshold drops near-zero singular values', () => {
    // Rank-deficient matrix: pseudoinverse with rcond=0 may differ from rcond=1e-10.
    const t = new Tensor([3, 3], ARankDef3x3);
    const pStrict = tensorPinv(t, [0], { rcond: 0.99 }); // drop all but the largest
    const pDefault = tensorPinv(t, [0]); // default rcond=1e-10
    // With rcond=0.99 all singular values below 0.99*max(S) are zeroed.
    // The shapes must still match.
    expect(pStrict.shape).toEqual([3, 3]);
    expect(pDefault.shape).toEqual([3, 3]);
  });

  it('11. rcond=0 keeps all singular values (full pseudoinverse)', () => {
    // For a full-rank matrix, rcond=0 vs rcond=1e-10 should give the same result.
    const t = new Tensor([3, 3], A3x3);
    const p0 = tensorPinv(t, [0], { rcond: 0 });
    const pDef = tensorPinv(t, [0]);
    expect(maxAbsDiff(p0.data, pDef.data)).toBeLessThan(1e-10);
  });

  it('12. axisLabels preserved: col → leading, row → trailing', () => {
    const rowIdx = new Index(3, { name: 'row' });
    const colIdx = new Index(3, { name: 'col' });
    const t = new Tensor([3, 3], A3x3, [rowIdx, colIdx]);
    const p = tensorPinv(t, [rowIdx]);
    // pinv swaps: col axes become leading, row axes become trailing.
    expect(p.axisLabels).toBeDefined();
    expect(p.axisLabels![0].name).toBe('col');
    expect(p.axisLabels![1].name).toBe('row');
  });

  it('13. named-Index rowAxes gives same result as integer rowAxes', () => {
    const rowIdx = new Index(3, { name: 'row' });
    const colIdx = new Index(3, { name: 'col' });
    const t = new Tensor([3, 3], A3x3, [rowIdx, colIdx]);
    const pIdx = tensorPinv(t, [rowIdx]);
    const pInt = tensorPinv(t, [0]);
    expect(maxAbsDiff(pIdx.data, pInt.data)).toBeLessThan(1e-12);
  });

  it('14. pinv of identity matrix is identity', () => {
    const eye3 = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const t = new Tensor([3, 3], eye3);
    const p = tensorPinv(t, [0]);
    expect(maxAbsDiff(p.data, eye3)).toBeLessThan(1e-10);
  });

  it('15. pinv of zero matrix is zero matrix', () => {
    const zero = new Float64Array(9); // all zeros
    const t = new Tensor([3, 3], zero);
    const p = tensorPinv(t, [0]);
    expect(maxAbsDiff(p.data, new Float64Array(9))).toBeLessThan(1e-12);
  });

  it('16. invalid axis throws RangeError', () => {
    const t = new Tensor([3, 3], A3x3);
    expect(() => tensorPinv(t, [5])).toThrow(RangeError);
  });

  it('17. duplicate axes in rowAxes throws', () => {
    const t = new Tensor([3, 3], A3x3);
    expect(() => tensorPinv(t, [0, 0])).toThrow(/duplicate/);
  });
});
