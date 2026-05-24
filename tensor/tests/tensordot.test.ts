/**
 * Tests for Tensor.tensordot — generalised dot product over explicit axis pairs.
 *
 * `tensordot(other, axes)` contracts axis pairs where `axes[i] = [a, b]` means
 * "contract this's axis a with other's axis b".  Delegates to Tensor.einsum.
 * Result shape: this's non-contracted axes then other's non-contracted axes.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';
import { idx } from '../src/named-index';

const EPS = 1e-12;
function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS;
}

// ---------------------------------------------------------------------------
// Matrix multiply via tensordot
// ---------------------------------------------------------------------------

describe('Tensor.tensordot — matrix multiply', () => {
  // A = [[1,2],[3,4],[5,6]]  shape (3,2)
  // B = [[1,0,1],[0,1,1]]   shape (2,3)
  // A @ B = [[1,2,3],[3,4,7],[5,6,11]]
  const A = Tensor.fromNested(
    [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
    [3, 2]
  );
  const B = Tensor.fromNested(
    [
      [1, 0, 1],
      [0, 1, 1],
    ],
    [2, 3]
  );

  it('tensordot(B, [[1,0]]) replicates matmul A@B', () => {
    const r = A.tensordot(B, [[1, 0]]);
    expect(r.shape).toEqual([3, 3]);
    expect(r.toNested()).toEqual([
      [1, 2, 3],
      [3, 4, 7],
      [5, 6, 11],
    ]);
  });

  it('tensordot result matches einsum spec for matrix multiply', () => {
    // Build the equivalent einsum spec manually: ij,jk->ik
    const spec = {
      contractions: [{ pair: [[0, 1], [1, 0]] as const }],
      free: [
        { operand: 0, axis: 0 },
        { operand: 1, axis: 1 },
      ],
    };
    const einResult = Tensor.einsum(spec, A, B);
    const tdResult = A.tensordot(B, [[1, 0]]);
    expect(tdResult.shape).toEqual(einResult.shape);
    for (let i = 0; i < tdResult.data.length; i++) {
      expect(close(tdResult.data[i], einResult.data[i])).toBe(true);
    }
  });

  it('square matmul matches Tensor.matMul', () => {
    const X = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const Y = Tensor.fromNested(
      [
        [5, 6],
        [7, 8],
      ],
      [2, 2]
    );
    const td = X.tensordot(Y, [[1, 0]]);
    const mm = X.matMul(Y);
    expect(td.shape).toEqual(mm.shape);
    for (let i = 0; i < td.data.length; i++) {
      expect(td.data[i]).toBe(mm.data[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Rank-3 contractions
// ---------------------------------------------------------------------------

describe('Tensor.tensordot — rank-3 contractions', () => {
  it('rank-3 (3,4,5) tensordot rank-3 (5,6,4) axes=[[1,2],[2,0]] → shape (3,6)', () => {
    // Contract axis 1 (dim 4) of A with axis 2 (dim 4) of B.
    // Contract axis 2 (dim 5) of A with axis 0 (dim 5) of B.
    // Non-contracted axes: A axis 0 (dim 3), B axis 1 (dim 6).
    // Result shape: [3, 6].
    const aData = new Float64Array(3 * 4 * 5);
    for (let i = 0; i < aData.length; i++) aData[i] = i + 1;
    const A = new Tensor([3, 4, 5], aData);

    const bData = new Float64Array(5 * 6 * 4);
    for (let i = 0; i < bData.length; i++) bData[i] = (i % 7) + 1; // simple pattern
    const B = new Tensor([5, 6, 4], bData);

    const r = A.tensordot(B, [
      [1, 2],
      [2, 0],
    ]);
    expect(r.shape).toEqual([3, 6]);
    expect(r.data.length).toBe(18);
  });

  it('rank-3 tensordot: element [0,0] matches a hand-computed sum', () => {
    // Use simple 2×2×2 tensors with known values.
    // A[i,j,k] = i*4 + j*2 + k + 1   (1-indexed)
    // B[j,k,l] = j*4 + k*2 + l + 1
    // tensordot axes [[1,0],[2,1]]: contract A.axis1 with B.axis0 (both dim 2),
    //                               and A.axis2 with B.axis1 (both dim 2).
    // result[i,l] = sum_{j,k} A[i,j,k] * B[j,k,l]
    //
    // A: shape (2,2,2), values 1..8
    // B: shape (2,2,2), values 1..8
    //
    // result[0,0] = sum_{j=0}^{1} sum_{k=0}^{1} A[0,j,k] * B[j,k,0]
    //   A[0,0,0]=1, A[0,0,1]=2, A[0,1,0]=3, A[0,1,1]=4
    //   B[0,0,0]=1, B[0,1,0]=3, B[1,0,0]=5, B[1,1,0]=7
    //   = 1*1 + 2*3 + 3*5 + 4*7 = 1+6+15+28 = 50
    const aData = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const bData = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const A = new Tensor([2, 2, 2], aData);
    const B = new Tensor([2, 2, 2], bData);

    const r = A.tensordot(B, [
      [1, 0],
      [2, 1],
    ]);
    expect(r.shape).toEqual([2, 2]);
    expect(r.data[0]).toBe(50); // result[0,0]
  });

  it('multiple contraction pairs: inner product of two rank-2 tensors → scalar', () => {
    // Contracting both axes → rank-0 output (Frobenius inner product).
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const B = Tensor.fromNested(
      [
        [1, 0],
        [0, 1],
      ],
      [2, 2]
    );
    // Contract axis 0 of A with axis 0 of B, axis 1 of A with axis 1 of B.
    // result = sum_{i,j} A[i,j]*B[i,j] = 1*1 + 2*0 + 3*0 + 4*1 = 5
    const r = A.tensordot(B, [
      [0, 0],
      [1, 1],
    ]);
    expect(r.shape).toEqual([]);
    expect(r.data[0]).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// axisLabels propagation
// ---------------------------------------------------------------------------

describe('Tensor.tensordot — axisLabels propagation', () => {
  it('surviving labels are attached to the result', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(3, 'k');
    const lIdx = idx(4, 'l');

    // A: shape (2, 3) with labels [i, j]
    const aData = new Float64Array(6);
    for (let n = 0; n < 6; n++) aData[n] = n + 1;
    const A = new Tensor([2, 3], aData, [iIdx, jIdx]);

    // B: shape (3, 4) with labels [k, l]  (k has same dim as j but different id)
    const bData = new Float64Array(12);
    for (let n = 0; n < 12; n++) bData[n] = n + 1;
    const B = new Tensor([3, 4], bData, [kIdx, lIdx]);

    // Contract A's axis 1 (j, dim=3) with B's axis 0 (k, dim=3).
    const r = A.tensordot(B, [[1, 0]]);
    expect(r.shape).toEqual([2, 4]);
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels!.length).toBe(2);
    expect(r.axisLabels![0].matches(iIdx)).toBe(true);
    expect(r.axisLabels![1].matches(lIdx)).toBe(true);
  });

  it('contracted axis labels are dropped from the result', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(2, 'j');
    const kIdx = idx(2, 'k');
    const lIdx = idx(2, 'l');

    const A = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]), [iIdx, jIdx]);
    const B = new Tensor([2, 2], new Float64Array([1, 0, 0, 1]), [kIdx, lIdx]);

    // Contract both axes: A[0]↔B[0], A[1]↔B[1] → rank-0 result, no labels.
    const r = A.tensordot(B, [
      [0, 0],
      [1, 1],
    ]);
    expect(r.shape).toEqual([]);
    // With both operands having labels but both axes contracted, resultLabels = []
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels!.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('Tensor.tensordot — error handling', () => {
  const A = Tensor.fromNested(
    [
      [1, 2],
      [3, 4],
    ],
    [2, 2]
  );
  const B = Tensor.fromNested(
    [
      [1, 2],
      [3, 4],
    ],
    [2, 2]
  );

  it('throws on out-of-range axis in this', () => {
    expect(() => A.tensordot(B, [[5, 0]])).toThrow(/out of range/);
  });

  it('throws on out-of-range axis in other', () => {
    expect(() => A.tensordot(B, [[0, 5]])).toThrow(/out of range/);
  });

  it('throws on duplicate self axis', () => {
    expect(() => A.tensordot(B, [[0, 0], [0, 1]])).toThrow(/duplicate axis/);
  });

  it('throws on duplicate other axis', () => {
    expect(() => A.tensordot(B, [[0, 0], [1, 0]])).toThrow(/duplicate axis/);
  });

  it('throws on dimension mismatch', () => {
    // A is (2,2), C is (3,2) — contracting A axis 0 (dim 2) with C axis 0 (dim 3) should fail.
    const C = new Tensor([3, 2], new Float64Array(6));
    expect(() => A.tensordot(C, [[0, 0]])).toThrow(/dimension mismatch/);
  });
});
