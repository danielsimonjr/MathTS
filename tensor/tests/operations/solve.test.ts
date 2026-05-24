/**
 * Tests for tensorSolve — named-index linear solver.
 *
 * Coverage:
 *  1.  Well-conditioned: solve(A, A·x) ≈ x (2×2 system).
 *  2.  Well-conditioned: solve(A, A·x) ≈ x (3×3 system).
 *  3.  Multi-RHS: solve(A, A·X) ≈ X (3×3 A, 3×2 B).
 *  4.  Named-Index matching: same result as integer axes.
 *  5.  Named-Index matching with explicit labels present on A and b.
 *  6.  Singular A throws (zero pivot).
 *  7.  Non-square A (reshaped) throws.
 *  8.  b's contracting dimension mismatch throws.
 *  9.  3-D tensor A (rowAxes=[0,1]) reshaped correctly.
 *  10. axisLabels propagated to output (col axes of A + col axes of b).
 *  11. Integer identity system: solve(I, b) = b.
 *  12. Diagonal system: solve(diag, b) = b / diag.
 *  13. rowAxesA / rowAxesB overrides respected.
 *  14. Duplicate rowAxesA throws.
 *  15. Duplicate rowAxesB throws.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { Index } from '../../src/named-index';
import { tensorSolve } from '../../src/operations/solve';

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

/** Multiply square A (n×n) by vector x (n), row-major. */
function matvec(A: Float64Array, n: number, x: Float64Array): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += A[i * n + j] * x[j];
    y[i] = sum;
  }
  return y;
}

/** Multiply square A (n×n) by matrix X (n×m), row-major → n×m. */
function matmul(A: Float64Array, n: number, X: Float64Array, m: number): Float64Array {
  const Y = new Float64Array(n * m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += A[i * n + k] * X[k * m + j];
      Y[i * m + j] = sum;
    }
  }
  return Y;
}

// ---------------------------------------------------------------------------
// Test matrices
// ---------------------------------------------------------------------------

// 2×2 well-conditioned matrix.
const A2 = new Float64Array([4, 3, 6, 3]);
// 3×3 well-conditioned matrix.
const A3 = new Float64Array([2, 1, 1, 4, 3, 3, 8, 7, 9]);
// Known solution vectors.
const x2 = new Float64Array([1, 2]);
const x3 = new Float64Array([1, 2, 3]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tensorSolve', () => {
  it('1. well-conditioned 2×2: solve(A, A·x) ≈ x', () => {
    const tA = new Tensor([2, 2], A2);
    const b = matvec(A2, 2, x2);
    const tb = new Tensor([2], b);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(maxAbsDiff(x.data, x2)).toBeLessThan(1e-10);
  });

  it('2. well-conditioned 3×3: solve(A, A·x) ≈ x', () => {
    const tA = new Tensor([3, 3], A3);
    const b = matvec(A3, 3, x3);
    const tb = new Tensor([3], b);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(maxAbsDiff(x.data, x3)).toBeLessThan(1e-10);
  });

  it('3. multi-RHS 3×2: solve(A, A·X) ≈ X', () => {
    const X = new Float64Array([1, 4, 2, 5, 3, 6]); // 3×2
    const B = matmul(A3, 3, X, 2); // 3×2
    const tA = new Tensor([3, 3], A3);
    const tb = new Tensor([3, 2], B);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(x.shape).toEqual([3, 2]);
    expect(maxAbsDiff(x.data, X)).toBeLessThan(1e-10);
  });

  it('4. named-Index matching gives same result as integer rowAxes', () => {
    const rowIdx = new Index(3, { name: 'row' });
    const colIdx = new Index(3, { name: 'col' });
    const tA = new Tensor([3, 3], A3, [rowIdx, colIdx]);
    const b = matvec(A3, 3, x3);
    const tb = new Tensor([3], b, [rowIdx]);
    const { x: xNamed } = tensorSolve(tA, tb);
    const tA2 = new Tensor([3, 3], A3);
    const tb2 = new Tensor([3], b);
    const { x: xInt } = tensorSolve(tA2, tb2, { rowAxesA: [0], rowAxesB: [0] });
    expect(maxAbsDiff(xNamed.data, xInt.data)).toBeLessThan(1e-12);
  });

  it('5. named-Index with explicit labels on both A and b', () => {
    const i = new Index(3, { name: 'i' });
    const j = new Index(3, { name: 'j' });
    const tA = new Tensor([3, 3], A3, [i, j]);
    const b = matvec(A3, 3, x3);
    const tb = new Tensor([3], b, [i]);
    const { x } = tensorSolve(tA, tb);
    // x should have colAxes of A = [j] as its label.
    expect(x.axisLabels).toBeDefined();
    expect(x.axisLabels![0].name).toBe('j');
    expect(maxAbsDiff(x.data, x3)).toBeLessThan(1e-10);
  });

  it('6. singular A throws (zero pivot)', () => {
    const singular = new Float64Array([1, 2, 2, 4]); // rank 1
    const tA = new Tensor([2, 2], singular);
    const tb = new Tensor([2], new Float64Array([1, 2]));
    expect(() => tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] })).toThrow(/singular/i);
  });

  it('7. non-square reshaped A throws', () => {
    // A has shape [2, 3] — can't form square matrix with rowAxesA=[0].
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const tA = new Tensor([2, 3], data);
    const tb = new Tensor([2], new Float64Array([1, 2]));
    expect(() => tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] })).toThrow(/square/i);
  });

  it('8. b contracting dimension mismatch throws', () => {
    const tA = new Tensor([3, 3], A3);
    const tb = new Tensor([2], new Float64Array([1, 2])); // wrong size
    expect(() => tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] })).toThrow(/dimension/i);
  });

  it('9. 3-D tensor A with rowAxes=[0,1] reshaped correctly', () => {
    // A has shape [2, 2, 4] → rowAxes=[0,1] → numRows=4, colAxes=[2] → numCols=4 → square.
    // b has shape [4] → rowAxesB=[0] → contracting dim=4.
    const eye4 = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const tA = new Tensor([2, 2, 4], eye4);
    const bData = new Float64Array([1, 2, 3, 4]);
    const tb = new Tensor([4], bData);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0, 1], rowAxesB: [0] });
    // x should have shape = [colDimsA..., colDimsB...] = [4, (nothing)] = [4].
    expect(x.shape).toEqual([4]);
    expect(maxAbsDiff(x.data, bData)).toBeLessThan(1e-10);
  });

  it('10. axisLabels propagated: col axes of A + col axes of b', () => {
    const rowIdx = new Index(3, { name: 'row' });
    const colA = new Index(3, { name: 'colA' });
    const colB = new Index(2, { name: 'colB' });
    const X = new Float64Array([1, 4, 2, 5, 3, 6]); // 3×2
    const B = matmul(A3, 3, X, 2); // 3×2
    const tA = new Tensor([3, 3], A3, [rowIdx, colA]);
    const tb = new Tensor([3, 2], B, [rowIdx, colB]);
    const { x } = tensorSolve(tA, tb);
    expect(x.axisLabels).toBeDefined();
    expect(x.axisLabels!.length).toBe(2);
    expect(x.axisLabels![0].name).toBe('colA');
    expect(x.axisLabels![1].name).toBe('colB');
  });

  it('11. identity system: solve(I, b) = b', () => {
    const eye3 = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const tA = new Tensor([3, 3], eye3);
    const bData = new Float64Array([7, 8, 9]);
    const tb = new Tensor([3], bData);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(maxAbsDiff(x.data, bData)).toBeLessThan(1e-10);
  });

  it('12. diagonal system: solve(diag(d), b) = b / d', () => {
    const diag = new Float64Array([2, 0, 0, 0, 4, 0, 0, 0, 5]);
    const tA = new Tensor([3, 3], diag);
    const bData = new Float64Array([4, 12, 25]);
    const expected = new Float64Array([2, 3, 5]); // [4/2, 12/4, 25/5]
    const tb = new Tensor([3], bData);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(maxAbsDiff(x.data, expected)).toBeLessThan(1e-10);
  });

  it('13. rowAxesA / rowAxesB overrides work', () => {
    // A shape [3, 3], b shape [3, 1]. Use explicit rowAxes.
    // Build x3 as a column: shape [3, 1], data [1, 2, 3].
    const x3col = new Float64Array([1, 2, 3]); // treated as 3×1
    const bMat = matmul(A3, 3, x3col, 1); // 3×1
    const tA = new Tensor([3, 3], A3);
    const tb = new Tensor([3, 1], bMat);
    const { x } = tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0] });
    expect(x.shape).toEqual([3, 1]);
    expect(maxAbsDiff(x.data, x3col), `Expected solution ≈ [1,2,3]`).toBeLessThan(1e-9);
  });

  it('14. duplicate rowAxesA throws', () => {
    const tA = new Tensor([3, 3], A3);
    const tb = new Tensor([3], new Float64Array(3));
    expect(() => tensorSolve(tA, tb, { rowAxesA: [0, 0], rowAxesB: [0] })).toThrow(/duplicate/i);
  });

  it('15. duplicate rowAxesB throws', () => {
    const tA = new Tensor([3, 3], A3);
    const tb = new Tensor([3, 3], new Float64Array(9));
    expect(() => tensorSolve(tA, tb, { rowAxesA: [0], rowAxesB: [0, 0] })).toThrow(/duplicate/i);
  });
});
