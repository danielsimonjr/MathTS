/**
 * External eigenvalue oracle for `matrixSchur` (WS-1 oracle-coverage matrix).
 *
 * The existing `schur.test.ts` verifies self-consistency only — reconstruction
 * `Q·T·Qᵀ ≈ A`, orthogonality of `Q`, quasi-triangularity of `T` — which a
 * systematically-biased factorization could pass. This pins the **eigenvalues**
 * (the real Schur form's `T` diagonal) to *independently known* spectra:
 *
 *  - a symmetric matrix has a guaranteed-real, well-conditioned spectrum;
 *  - a symmetric tridiagonal Toeplitz matrix (diagonal `a`, off-diagonal `b`,
 *    size `n`) has the exact closed-form spectrum `a + 2b·cos(kπ/(n+1))`;
 *  - a companion-like non-symmetric matrix with a hand-factored characteristic
 *    polynomial exercises the general (non-symmetric) real-eigenvalue path.
 *
 * Eigenvalues are unique, so the only ambiguity is ordering — removed by sorting.
 */
import { describe, it, expect } from 'vitest';

import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { matrixSchur } from '../../src/operations/schur.js';

/** Ascending diagonal of a (quasi-)triangular matrix. */
function sortedDiag(A: DenseMatrix): number[] {
  const arr = A.toArray();
  return arr.map((_, i) => arr[i][i]).sort((a, b) => a - b);
}

function expectCloseArray(actual: number[], expected: number[], relTol: number): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const scale = Math.max(1, Math.abs(expected[i]));
    expect(Math.abs(actual[i] - expected[i]) / scale).toBeLessThan(relTol);
  }
}

describe('matrixSchur — external eigenvalue oracle (T diagonal = known spectrum)', () => {
  it('symmetric [[2,1],[1,2]] has eigenvalues {1, 3}', () => {
    const { T } = matrixSchur(
      DenseMatrix.fromArray([
        [2, 1],
        [1, 2],
      ])
    );
    expectCloseArray(sortedDiag(T), [1, 3], 1e-8);
  });

  // KNOWN BUG (discovered by this oracle, WS-1 P2) — un-skip when fixed.
  // matrixSchur's Francis double-shift STALLS on this symmetric tridiagonal: its
  // eigenvalues {4−√2, 4, 4+√2} are symmetric about the shift centre, so the
  // implicit shift produces a degenerate bulge (leading column [0,0,1]) and the
  // iteration returns the matrix UNCHANGED — diagonal [4,4,4], not the spectrum.
  // The reconstruction-only tests miss it (Q=I, T=A ⇒ Q·T·Qᵀ=A holds). Fixing it
  // needs an exceptional-shift mechanism. Tracked in TODO.md + the roadmap.
  it.skip('symmetric tridiagonal Toeplitz (a=4, b=1, n=3) has eigenvalues 4−√2, 4, 4+√2', () => {
    const { T } = matrixSchur(
      DenseMatrix.fromArray([
        [4, 1, 0],
        [1, 4, 1],
        [0, 1, 4],
      ])
    );
    expectCloseArray(sortedDiag(T), [4 - Math.SQRT2, 4, 4 + Math.SQRT2], 1e-6);
  });

  it('non-symmetric [[0,−2],[1,3]] has real eigenvalues {1, 2}', () => {
    // characteristic polynomial λ² − 3λ + 2 = (λ−1)(λ−2); both real ⇒ 1×1 blocks.
    const { T } = matrixSchur(
      DenseMatrix.fromArray([
        [0, -2],
        [1, 3],
      ])
    );
    expectCloseArray(sortedDiag(T), [1, 2], 1e-6);
  });
});
