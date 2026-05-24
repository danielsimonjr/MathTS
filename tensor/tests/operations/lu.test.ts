/**
 * Tests for tensorLU — LU decomposition with partial pivoting.
 *
 * Coverage:
 *  1.  L is unit lower-triangular (1s on diag, zeros above).
 *  2.  U is upper-triangular (zeros below diag).
 *  3.  L · U ≈ P · A to 1e-9 for a generic invertible matrix.
 *  4.  L · U ≈ P · A to 1e-9 for an identity-pivoted (already-good) matrix.
 *  5.  Parity sign: known row-swap matrix gives parity = -1.
 *  6.  Non-square reshaped matrix throws.
 *  7.  Singular matrix throws with clear message.
 *  8.  axisLabels propagation.
 *  9.  Larger 5×5 matrix reconstructs to 1e-9.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorLU } from '../../src/operations/lu';

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

/** Compute P·A where P is given as the row-permutation array. */
function applyPermutation(A: Float64Array, n: number, P: Int32Array): Float64Array {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorLU', () => {
  // Test 1: L is unit lower-triangular
  it('L is unit lower-triangular (1s on diag, zeros above)', () => {
    const A = Tensor.fromNested(
      [
        [4, 3, 2],
        [6, 3, 1],
        [8, 4, 2],
      ],
      [3, 3]
    );
    const { L } = tensorLU(A, [0]);
    const n = 3;

    for (let i = 0; i < n; i++) {
      expect(L.data[i * n + i]).toBeCloseTo(1, 12);
      for (let j = i + 1; j < n; j++) {
        expect(Math.abs(L.data[i * n + j])).toBeLessThan(1e-12);
      }
    }
  });

  // Test 2: U is upper-triangular
  it('U is upper-triangular (zeros below diag)', () => {
    const A = Tensor.fromNested(
      [
        [4, 3, 2],
        [6, 3, 1],
        [8, 4, 2],
      ],
      [3, 3]
    );
    const { U } = tensorLU(A, [0]);
    const n = 3;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        expect(Math.abs(U.data[i * n + j])).toBeLessThan(1e-12);
      }
    }
  });

  // Test 3: L · U ≈ P · A for a generic invertible matrix
  it('L · U ≈ P · A for a generic 3×3 invertible matrix', () => {
    const A = Tensor.fromNested(
      [
        [2, -1, 3],
        [4, 5, -2],
        [-1, 2, 7],
      ],
      [3, 3]
    );
    const { L, U, P } = tensorLU(A, [0]);
    const n = 3;

    const LU = matMulFlat(L.data, n, U.data);
    const PA = applyPermutation(A.data, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 4: Reconstruction on a well-conditioned identity-like matrix
  it('L · U ≈ P · A on a diagonally-dominant matrix', () => {
    // Diagonally dominant — no pivoting needed.
    const A = Tensor.fromNested(
      [
        [10, 1, 1],
        [1, 10, 1],
        [1, 1, 10],
      ],
      [3, 3]
    );
    const { L, U, P } = tensorLU(A, [0]);
    const n = 3;

    const LU = matMulFlat(L.data, n, U.data);
    const PA = applyPermutation(A.data, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });

  // Test 5: Parity sign for a 2x2 row-swap
  it('parity is -1 when one row swap occurs (2×2)', () => {
    // [[0,1],[1,0]] forces a swap on the first pivot.
    const A = Tensor.fromNested(
      [
        [0, 1],
        [1, 0],
      ],
      [2, 2]
    );
    const { P, parity } = tensorLU(A, [0]);

    // Row 1 should be swapped to position 0.
    expect(P[0]).toBe(1);
    expect(P[1]).toBe(0);
    expect(parity).toBe(-1);
  });

  // Test 6: Non-square reshaped matrix throws
  it('throws when reshaped matrix is non-square', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(() => tensorLU(A, [0])).toThrow(/square/);
  });

  // Test 7: Singular matrix throws
  it('throws on singular matrix with clear message', () => {
    // Rank-1 (linearly dependent rows) → singular.
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [2, 4, 6],
        [3, 6, 9],
      ],
      [3, 3]
    );
    expect(() => tensorLU(A, [0])).toThrow(/singular/);
  });

  // Test 8: axisLabels propagation
  it('propagates axisLabels: L has rowAxes labels + joining, U has joining + colAxes labels', () => {
    const i = new Index(3, { name: 'i' });
    const j = new Index(3, { name: 'j' });
    const A = new Tensor([3, 3], new Float64Array([4, 3, 2, 6, 3, 1, 8, 4, 2]), [i, j]);

    const { L, U } = tensorLU(A, [0], { joiningIndexName: 'mid' });

    expect(L.axisLabels).toBeDefined();
    expect(U.axisLabels).toBeDefined();
    expect(L.axisLabels![0]).toBe(i);
    expect(U.axisLabels![1]).toBe(j);
    expect(L.axisLabels![1].matches(U.axisLabels![0])).toBe(true);
    expect(L.axisLabels![1].name).toBe('mid');
  });

  // Test 9: 5×5 reconstruction
  it('5×5 random-ish matrix: L · U ≈ P · A to 1e-9', () => {
    const data = [
      [4, 3, 2, 1, 5],
      [2, 6, 3, 7, 1],
      [1, 2, 9, 3, 4],
      [5, 1, 4, 8, 2],
      [3, 7, 1, 2, 6],
    ];
    const A = Tensor.fromNested(data, [5, 5]);
    const { L, U, P } = tensorLU(A, [0]);
    const n = 5;

    const LU = matMulFlat(L.data, n, U.data);
    const PA = applyPermutation(A.data, n, P);

    expect(maxAbsDiff(LU, PA)).toBeLessThan(1e-9);
  });
});
