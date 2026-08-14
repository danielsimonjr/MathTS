import { describe, it, expect } from 'vitest';
import { lq, rq, ql } from '../../src/operations/qr-family.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

/** Multiply two DenseMatrices and return a plain 2D array. */
function mul(a: DenseMatrix, b: DenseMatrix): number[][] {
  return a.multiply(b).toArray();
}

/** Assert that two 2D arrays match within tolerance. */
function expectClose(got: number[][], want: number[][]): void {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < got.length; i++) {
    expect(got[i].length).toBe(want[i].length);
    for (let j = 0; j < got[i].length; j++) {
      expect(got[i][j]).toBeCloseTo(want[i][j], 9);
    }
  }
}

/** Verify Q · Qᵀ = I_k (for orthonormal rows). */
function expectOrthonormalRows(Q: DenseMatrix): void {
  const qqt = Q.multiply(Q.transpose()).toArray();
  const k = qqt.length;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      expect(qqt[i][j]).toBeCloseTo(i === j ? 1 : 0, 8);
    }
  }
}

/** Verify Qᵀ · Q = I_k (for orthonormal columns). */
function expectOrthonormalColumns(Q: DenseMatrix): void {
  const qtq = Q.transpose().multiply(Q).toArray();
  const k = qtq.length;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      expect(qtq[i][j]).toBeCloseTo(i === j ? 1 : 0, 8);
    }
  }
}

/** Verify L is lower-triangular (entries above the diagonal are ~0). */
function expectLowerTriangular(L: DenseMatrix, tol = 1e-9): void {
  const l = L.toArray();
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l[i].length; j++) {
      expect(Math.abs(l[i][j])).toBeLessThan(tol);
    }
  }
}

/** Verify R is upper-triangular (entries below the diagonal are ~0). */
function expectUpperTriangular(R: DenseMatrix, tol = 1e-9): void {
  const r = R.toArray();
  for (let i = 0; i < r.length; i++) {
    for (let j = 0; j < Math.min(i, r[i].length); j++) {
      expect(Math.abs(r[i][j])).toBeLessThan(tol);
    }
  }
}

describe('lq', () => {
  it('reconstructs a square full-rank matrix: A = L·Q', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { L, Q } = lq(A);
    expect(L.rows).toBe(3);
    expect(L.cols).toBe(3);
    expect(Q.rows).toBe(3);
    expect(Q.cols).toBe(3);
    expectClose(mul(L, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectLowerTriangular(L);
  });

  it('reconstructs a tall matrix (m > n): L is m×n, Q is n×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { L, Q } = lq(A);
    expect(L.rows).toBe(4);
    expect(L.cols).toBe(2);
    expect(Q.rows).toBe(2);
    expect(Q.cols).toBe(2);
    expectClose(mul(L, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectLowerTriangular(L);
  });

  it('reconstructs a wide matrix (m < n): L is m×m, Q is m×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { L, Q } = lq(A);
    expect(L.rows).toBe(2);
    expect(L.cols).toBe(2);
    expect(Q.rows).toBe(2);
    expect(Q.cols).toBe(4);
    expectClose(mul(L, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectLowerTriangular(L);
  });

  it('handles a 1×1 matrix', () => {
    const A = DenseMatrix.fromArray([[5]]);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), [[5]]);
    expect(Q.get(0, 0)).toBeCloseTo(1);
    expect(L.get(0, 0)).toBeCloseTo(5);
  });

  it('handles a fully zero matrix', () => {
    const A = DenseMatrix.zeros(3, 3);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectLowerTriangular(L);
  });

  it('handles a zero-row matrix (m=0)', () => {
    const A = new DenseMatrix(0, 3, new Float64Array(0));
    const { L, Q } = lq(A);
    expect(L.rows).toBe(0);
    expect(Q.rows).toBe(0);
    expect(Q.cols).toBe(3);
  });

  it('handles a zero-column matrix (n=0)', () => {
    const A = new DenseMatrix(3, 0, new Float64Array(0));
    const { L, Q } = lq(A);
    expect(L.cols).toBe(0);
    expect(Q.rows).toBe(0);
    expect(Q.cols).toBe(0);
  });

  it('handles a rank-deficient matrix (duplicate rows) and still reconstructs A', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3],
      [1, 2, 3],
      [0, 1, 1],
    ]);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectLowerTriangular(L);
  });
});

describe('rq', () => {
  it('reconstructs a square full-rank matrix: A = R·Q', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { R, Q } = rq(A);
    expectClose(mul(R, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectUpperTriangular(R);
  });

  it('reconstructs a wide matrix (m < n): R is m×m, Q is m×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { R, Q } = rq(A);
    expectClose(mul(R, Q), A.toArray());
    expectOrthonormalRows(Q);
    expectUpperTriangular(R);
  });
});

describe('ql', () => {
  it('reconstructs a square full-rank matrix: A = Q·L', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { Q, L } = ql(A);
    expectClose(mul(Q, L), A.toArray());
    expectOrthonormalColumns(Q);
    expectLowerTriangular(L);
  });

  it('reconstructs a tall matrix (m > n): Q is m×n, L is n×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { Q, L } = ql(A);
    expectClose(mul(Q, L), A.toArray());
    expectOrthonormalColumns(Q);
    expectLowerTriangular(L);
  });
});
