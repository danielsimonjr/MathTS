import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../../src/index.js';

/**
 * Regression: the former symmetric-only Givens/Wilkinson eigenvalue path
 * produced grossly wrong eigenvalues for symmetric matrices with structural
 * off-diagonal zeros (tridiagonals): [[2,-1,0],[-1,2,-1],[0,-1,2]] returned
 * [19.05, 2, 0.94] (sum 22 ≠ trace 6) instead of [0.586, 2, 3.414]. Symmetric
 * matrices now route through the robust JAMA orthes/hqr2 solver.
 *
 * Reference eigenvalues from numpy.linalg.eigvalsh.
 */
const close = (a: number[], b: number[], tol = 1e-9) => {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  expect(sa.length).toBe(sb.length);
  for (let i = 0; i < sa.length; i++) expect(sa[i]).toBeCloseTo(sb[i], 9);
  void tol;
};

const re = (vals: Array<number | { re: number; im: number }>) =>
  vals.map((v) => (typeof v === 'object' ? v.re : v));

describe('eig: symmetric matrices with structural zeros (regression)', () => {
  it('tridiagonal 3×3 → [0.585786, 2, 3.414214]', () => {
    const A = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]];
    close(re(eigvals(A)), [2 - Math.SQRT2, 2, 2 + Math.SQRT2]);
  });

  it('tridiagonal 4×4 → numpy reference', () => {
    const A = [[2, -1, 0, 0], [-1, 2, -1, 0], [0, -1, 2, -1], [0, 0, -1, 2]];
    close(re(eigvals(A)), [0.3819660112501051, 1.3819660112501053, 2.618033988749895, 3.618033988749895]);
  });

  it('eigenvalue sum equals the trace (similarity invariant)', () => {
    for (const A of [
      [[2, -1, 0], [-1, 2, -1], [0, -1, 2]],
      [[5, -2, 0, 0], [-2, 5, -2, 0], [0, -2, 5, -2], [0, 0, -2, 5]],
    ]) {
      const trace = A.reduce((s, r, i) => s + r[i], 0);
      const sum = re(eigvals(A)).reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(trace, 9);
    }
  });

  it('eigenvectors satisfy A·v = λ·v for a symmetric tridiagonal', () => {
    const A = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]];
    const { values, vectors } = eig(A, { computeVectors: true });
    for (let k = 0; k < A.length; k++) {
      const lam = values[k].re;
      const v = vectors[k];
      for (let r = 0; r < A.length; r++) {
        let Av = 0;
        for (let c = 0; c < A.length; c++) Av += A[r][c] * v[c];
        expect(Av).toBeCloseTo(lam * v[r], 8);
      }
    }
  });
});
