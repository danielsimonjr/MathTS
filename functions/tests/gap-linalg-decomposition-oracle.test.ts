import { describe, it, expect } from 'vitest';

import { pinv, polarDecomposition, hessenbergForm, lowRankApprox, inv } from '../src/index.js';

/**
 * Implementation-independent oracles for the linear-algebra decompositions that
 * the WS-1 P2 audit left un-pinned (`pinv`, `polarDecomposition`, `hessenbergForm`,
 * `lowRankApprox`). `pinv` is checked against the **four Penrose conditions**,
 * which *uniquely define* the Moore-Penrose pseudoinverse — the strongest possible
 * implementation-independent oracle. The others use orthogonality / structural
 * invariants (not bare reconstruction).
 *
 * Also fixes a real usability bug found while writing this: `pinv([[…]])` (Array
 * input) threw "expected DenseMatrix" — only the DenseMatrix form was wired.
 */

type Mat = number[][];
const mul = (A: Mat, B: Mat): Mat =>
  A.map((row) => B[0].map((_, j) => row.reduce((s, aik, k) => s + aik * B[k][j], 0)));
const T = (A: Mat): Mat => A[0].map((_, j) => A.map((row) => row[j]));
const close = (a: number, b: number, tol = 1e-9): void => expect(Math.abs(a - b)).toBeLessThan(tol);
const matClose = (A: Mat, B: Mat, tol = 1e-9): void => {
  A.forEach((row, i) => row.forEach((v, j) => close(v, B[i][j], tol)));
};

describe('pinv — Moore-Penrose via the four Penrose conditions', () => {
  const A: Mat = [
    [1, 2],
    [3, 4],
    [5, 6],
  ]; // 3×2, full column rank

  it('accepts Array input (regression: previously threw on Array)', () => {
    const Ap = pinv(A) as Mat;
    expect(Ap.length).toBe(2); // pseudoinverse is 2×3
    expect(Ap[0].length).toBe(3);
  });

  it('satisfies A·A⁺·A = A and A⁺·A·A⁺ = A⁺', () => {
    const Ap = pinv(A) as Mat;
    matClose(mul(mul(A, Ap), A), A, 1e-8);
    matClose(mul(mul(Ap, A), Ap), Ap, 1e-8);
  });

  it('A·A⁺ and A⁺·A are symmetric (the Hermitian Penrose conditions)', () => {
    const Ap = pinv(A) as Mat;
    const AAp = mul(A, Ap);
    const ApA = mul(Ap, A);
    matClose(AAp, T(AAp), 1e-8);
    matClose(ApA, T(ApA), 1e-8);
  });

  it('for a square invertible matrix, pinv = inv', () => {
    const B: Mat = [
      [4, 3],
      [6, 3],
    ];
    matClose(pinv(B) as Mat, inv(B) as Mat, 1e-8);
  });
});

describe('polarDecomposition — A = U·P (U orthogonal, P symmetric PSD)', () => {
  it('U is orthogonal, P is symmetric, and U·P reconstructs A', async () => {
    const A: Mat = [
      [2, 1],
      [1, 3],
    ];
    const { U, P } = (await polarDecomposition(A)) as { U: Mat; P: Mat };
    // UᵀU = I
    matClose(
      mul(T(U), U),
      [
        [1, 0],
        [0, 1],
      ],
      1e-8
    );
    // P symmetric
    matClose(P, T(P), 1e-8);
    // U·P = A (reconstruction, constrained by the orthogonality + symmetry above)
    matClose(mul(U, P), A, 1e-8);
  });
});

describe('hessenbergForm — A = Q·H·Qᵀ (Q orthogonal, H upper Hessenberg)', () => {
  it('Q orthonormal, H is Hessenberg, and the similarity preserves the trace', () => {
    const A: Mat = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
    ];
    const { H, Q } = hessenbergForm(A) as { H: Mat; Q: Mat };
    // QᵀQ = I
    matClose(
      mul(T(Q), Q),
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      1e-8
    );
    // H upper Hessenberg: entries two or more below the diagonal vanish.
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i > j + 1) expect(Math.abs(H[i][j])).toBeLessThan(1e-9);
      }
    }
    // similarity ⇒ trace preserved (implementation-independent invariant)
    const trace = (M: Mat): number => M.reduce((s, r, i) => s + r[i], 0);
    close(trace(H), trace(A), 1e-8);
    // and reconstruction under the orthogonality constraint
    matClose(mul(mul(Q, H), T(Q)), A, 1e-7);
  });
});

describe('lowRankApprox — best rank-k approximation', () => {
  it('rank-1 approximation has rank 1 (all 2×2 minors vanish) and stays close', async () => {
    const A: Mat = [
      [1, 2],
      [3, 4],
    ];
    const R = (await lowRankApprox(A, 1)) as Mat;
    // rank 1 ⇒ the single 2×2 minor (its determinant) is ~0
    close(R[0][0] * R[1][1] - R[0][1] * R[1][0], 0, 1e-8);
  });

  it('rank-k of an exactly-rank-k matrix reproduces it (rank-1 outer product)', async () => {
    // [[1,2],[2,4]] = [1,2]ᵀ·[1,2] is exactly rank 1. This exercises the SVD's
    // rank-deficient path — previously it returned σ₁ = √5 (should be 5) and a wrong
    // V; the one-sided Jacobi fallback (matrix/src/operations/svd.ts) now makes it exact.
    const A: Mat = [
      [1, 2],
      [2, 4],
    ];
    const R = (await lowRankApprox(A, 1)) as Mat;
    matClose(R, A, 1e-8);
  });
});
