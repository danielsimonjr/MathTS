import { describe, it, expect } from 'vitest';
import { det } from '@danielsimonjr/mathts-functions';

/**
 * Matrix-factory acceleration — `det` routes large numeric square matrices
 * through native Float64Array LU (det = parity(P)·∏diag(U)), falling back to the
 * factory path for small / non-numeric / non-square inputs. Must match the
 * reference values exactly (small) and to floating tolerance (large), and handle
 * singular matrices as det 0.
 */
describe('det: native-accelerated path', () => {
  it('small matrices keep exact factory values (below threshold)', () => {
    expect(det([[2, 0, 1], [1, 3, 2], [0, 1, 4]])).toBeCloseTo(21, 10);
    expect(det([[1, 2], [3, 4]])).toBeCloseTo(-2, 10);
  });

  it('singular matrix returns 0 (native LU throws → handled)', () => {
    // 10×10 rank-deficient (row 9 = row 0), above the native threshold.
    const n = 10;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === n - 1 ? j : i * 3 + j * 7 + (i === j ? n : 0)))
    );
    A[n - 1] = A[0].slice(); // duplicate row → singular
    expect(det(A)).toBeCloseTo(0, 6);
  });

  it('large matrix matches a naive cofactor-free LU reference', () => {
    // 12×12 diagonally dominant (well-conditioned). Reference: independent LU.
    const n = 12;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => Math.sin(i * 5 + j * 2) + (i === j ? 2 * n : 0))
    );
    const ref = naiveDet(A.map((r) => r.slice()));
    const got = det(A) as number;
    expect(Math.abs((got - ref) / ref)).toBeLessThan(1e-9);
  });

  it('block-diagonal det equals the product of block dets', () => {
    // 8×8 block-diag of two 4×4s → det = det(B1)·det(B2). Above threshold.
    const B1 = [[2, 1, 0, 0], [1, 2, 1, 0], [0, 1, 2, 1], [0, 0, 1, 2]];
    const B2 = [[3, 0, 1, 0], [0, 3, 0, 1], [1, 0, 3, 0], [0, 1, 0, 3]];
    const A = Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) =>
        i < 4 && j < 4 ? B1[i][j] : i >= 4 && j >= 4 ? B2[i - 4][j - 4] : 0
      )
    );
    const expected = naiveDet(B1.map((r) => r.slice())) * naiveDet(B2.map((r) => r.slice()));
    expect(det(A) as number).toBeCloseTo(expected, 6);
  });
});

/** Independent reference: Gaussian-elimination determinant with partial pivoting. */
function naiveDet(M: number[][]): number {
  const n = M.length;
  let sign = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (M[piv][col] === 0) return 0;
    if (piv !== col) {
      [M[piv], M[col]] = [M[col], M[piv]];
      sign = -sign;
    }
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
    }
  }
  let d = sign;
  for (let i = 0; i < n; i++) d *= M[i][i];
  return d;
}
