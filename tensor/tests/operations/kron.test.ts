/**
 * Tests for tensorKron — Kronecker product.
 *
 * Coverage:
 *  1.  kron(I_2, A) == block-diag(A, A).
 *  2.  kron(A, I_2): shape and value correctness.
 *  3.  kron(I_1, A) == A (1×1 identity is multiplicative unit).
 *  4.  kron(A, I_1) == A (1×1 identity is multiplicative unit).
 *  5.  Bilinearity (left scalar): kron(α·A, B) == α · kron(A, B).
 *  6.  Bilinearity (right scalar): kron(A, α·B) == α · kron(A, B).
 *  7.  Additive (left): kron(A + B, C) == kron(A, C) + kron(B, C).
 *  8.  kron(A, B) shape == [a.shape[0]*b.shape[0], a.shape[1]*b.shape[1]].
 *  9.  Non-square matrices: kron of 2×3 and 3×2.
 *  10. 1×1 scalar: kron([α], [β]) == [α·β].
 *  11. Rank-3 tensors: output shape correct.
 *  12. Mixed-rank (rank 2 × rank 3): rank-2 padded to rank-3.
 *  13. axisLabels concatenated with separator.
 *  14. When only one tensor has labels, output has no labels.
 *  15. Custom separator in axisLabels.
 *  16. kron(A, B) ≠ kron(B, A) in general (non-commutativity check).
 *  17. kron of row vectors: result matches classical formula.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorKron } from '../../src/operations/kron';

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

function scaleTensor(t: Tensor, alpha: number): Tensor {
  return new Tensor(t.shape, t.data.map((v) => v * alpha) as unknown as Float64Array);
}

function addTensor(a: Tensor, b: Tensor): Tensor {
  const d = new Float64Array(a.data.length);
  for (let i = 0; i < d.length; i++) d[i] = a.data[i] + b.data[i];
  return new Tensor(a.shape, d);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// 2×2 identity.
const I2 = new Tensor([2, 2], new Float64Array([1, 0, 0, 1]));
// 1×1 identity.
const I1 = new Tensor([1, 1], new Float64Array([1]));
// 2×2 matrix A.
const A = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
// 2×2 matrix B.
const B = new Tensor([2, 2], new Float64Array([5, 6, 7, 8]));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorKron', () => {
  it('1. kron(I_2, A) == block-diag(A, A)', () => {
    const K = tensorKron(I2, A);
    expect(K.shape).toEqual([4, 4]);
    // Block diagonal: top-left is A, bottom-right is A, off-diag are zeros.
    const expected = new Float64Array([1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 1, 2, 0, 0, 3, 4]);
    expect(maxAbsDiff(K.data, expected)).toBeLessThan(1e-12);
  });

  it('2. kron(A, I_2): shape and value correctness', () => {
    const K = tensorKron(A, I2);
    expect(K.shape).toEqual([4, 4]);
    // kron(A, I2): a[i,j] placed at (2i, 2j) block of size 2×2.
    const expected = new Float64Array([1, 0, 2, 0, 0, 1, 0, 2, 3, 0, 4, 0, 0, 3, 0, 4]);
    expect(maxAbsDiff(K.data, expected)).toBeLessThan(1e-12);
  });

  it('3. kron(I_1, A) == A', () => {
    const K = tensorKron(I1, A);
    expect(K.shape).toEqual([2, 2]);
    expect(maxAbsDiff(K.data, A.data)).toBeLessThan(1e-12);
  });

  it('4. kron(A, I_1) == A', () => {
    const K = tensorKron(A, I1);
    expect(K.shape).toEqual([2, 2]);
    expect(maxAbsDiff(K.data, A.data)).toBeLessThan(1e-12);
  });

  it('5. bilinearity left: kron(α·A, B) == α · kron(A, B)', () => {
    const alpha = 3.14;
    const K1 = tensorKron(scaleTensor(A, alpha), B);
    const K2 = scaleTensor(tensorKron(A, B), alpha);
    expect(maxAbsDiff(K1.data, K2.data)).toBeLessThan(1e-10);
  });

  it('6. bilinearity right: kron(A, α·B) == α · kron(A, B)', () => {
    const alpha = 2.71;
    const K1 = tensorKron(A, scaleTensor(B, alpha));
    const K2 = scaleTensor(tensorKron(A, B), alpha);
    expect(maxAbsDiff(K1.data, K2.data)).toBeLessThan(1e-10);
  });

  it('7. additivity (left): kron(A + B, C) == kron(A, C) + kron(B, C)', () => {
    const C = new Tensor([2, 2], new Float64Array([1, 1, 1, 1]));
    const K1 = tensorKron(addTensor(A, B), C);
    const K2 = addTensor(tensorKron(A, C), tensorKron(B, C));
    expect(maxAbsDiff(K1.data, K2.data)).toBeLessThan(1e-10);
  });

  it('8. output shape: kron(a, b).shape == [a.shape[i]*b.shape[i]]', () => {
    const a = new Tensor([3, 5], new Float64Array(15).fill(1));
    const b = new Tensor([4, 2], new Float64Array(8).fill(1));
    const K = tensorKron(a, b);
    expect(K.shape).toEqual([12, 10]);
  });

  it('9. non-square: kron of 2×3 and 3×2', () => {
    const a = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const b = new Tensor([3, 2], new Float64Array([7, 8, 9, 10, 11, 12]));
    const K = tensorKron(a, b);
    expect(K.shape).toEqual([6, 6]);
    // Just verify a few values by hand: K[0,0] = a[0,0]*b[0,0] = 1*7 = 7.
    expect(K.data[0]).toBeCloseTo(7);
    // K[0,1] = a[0,0]*b[0,1] = 1*8 = 8.
    expect(K.data[1]).toBeCloseTo(8);
    // K[0,2] = a[0,1]*b[0,0] = 2*7 = 14.
    expect(K.data[2]).toBeCloseTo(14);
  });

  it('10. 1×1 scalar: kron([α], [β]) == [α·β]', () => {
    const a = new Tensor([1, 1], new Float64Array([3]));
    const b = new Tensor([1, 1], new Float64Array([7]));
    const K = tensorKron(a, b);
    expect(K.shape).toEqual([1, 1]);
    expect(K.data[0]).toBeCloseTo(21);
  });

  it('11. rank-3 tensors: output shape correct', () => {
    const a = new Tensor([2, 3, 4], new Float64Array(24).fill(1));
    const b = new Tensor([5, 6, 7], new Float64Array(210).fill(2));
    const K = tensorKron(a, b);
    expect(K.shape).toEqual([10, 18, 28]);
    // All values should be 1*2 = 2.
    expect(K.data.every((v) => Math.abs(v - 2) < 1e-12)).toBe(true);
  });

  it('12. mixed-rank (2×2 and 2×2×2): rank-2 padded to rank-3', () => {
    // rank-2 a padded to [1,2,2]; rank-3 b [2,2,2].
    const a2 = new Tensor([2, 2], new Float64Array([1, 0, 0, 1])); // I_2
    const b3 = new Tensor([2, 2, 2], new Float64Array(8).fill(1));
    const K = tensorKron(a2, b3);
    // a padded to [1,2,2], b [2,2,2] → output [2,4,4].
    expect(K.shape).toEqual([2, 4, 4]);
  });

  it('13. axisLabels concatenated with default separator "_X_"', () => {
    const rowA = new Index(2, { name: 'rowA' });
    const colA = new Index(2, { name: 'colA' });
    const rowB = new Index(2, { name: 'rowB' });
    const colB = new Index(2, { name: 'colB' });
    const ta = new Tensor([2, 2], A.data, [rowA, colA]);
    const tb = new Tensor([2, 2], B.data, [rowB, colB]);
    const K = tensorKron(ta, tb);
    expect(K.axisLabels).toBeDefined();
    expect(K.axisLabels![0].name).toBe('rowA_X_rowB');
    expect(K.axisLabels![1].name).toBe('colA_X_colB');
  });

  it('14. only one tensor has labels → output carries no labels', () => {
    const rowA = new Index(2, { name: 'rowA' });
    const colA = new Index(2, { name: 'colA' });
    const ta = new Tensor([2, 2], A.data, [rowA, colA]);
    const K = tensorKron(ta, B); // B has no labels
    expect(K.axisLabels).toBeUndefined();
  });

  it('15. custom separator in axisLabels', () => {
    const rowA = new Index(2, { name: 'x' });
    const colA = new Index(2, { name: 'y' });
    const rowB = new Index(2, { name: 'p' });
    const colB = new Index(2, { name: 'q' });
    const ta = new Tensor([2, 2], A.data, [rowA, colA]);
    const tb = new Tensor([2, 2], B.data, [rowB, colB]);
    const K = tensorKron(ta, tb, { separator: '@' });
    expect(K.axisLabels![0].name).toBe('x@p');
    expect(K.axisLabels![1].name).toBe('y@q');
  });

  it('16. non-commutativity: kron(A, B) ≠ kron(B, A) in general', () => {
    const K1 = tensorKron(A, B);
    const K2 = tensorKron(B, A);
    // They should differ somewhere.
    const differs = K1.data.some((v, i) => Math.abs(v - K2.data[i]) > 1e-12);
    expect(differs).toBe(true);
  });

  it('17. row vectors: kron matches classical formula', () => {
    // Row vectors: kron([a, b], [c, d]) = [a*c, a*d, b*c, b*d].
    const u = new Tensor([1, 2], new Float64Array([3, 5]));
    const v = new Tensor([1, 2], new Float64Array([2, 7]));
    const K = tensorKron(u, v);
    expect(K.shape).toEqual([1, 4]);
    const expected = new Float64Array([6, 21, 10, 35]); // [3*2, 3*7, 5*2, 5*7]
    expect(maxAbsDiff(K.data, expected)).toBeLessThan(1e-12);
  });
});
