/**
 * External oracles for `lu` and `qr` (WS-1 oracle-coverage matrix) — both were
 * SELF-REF (reconstruction / orthogonality only, which a biased factorization
 * passes). Pins hand-computed exact factors (LU) and convention-free invariants
 * (QR: `|R₀₀| = ‖col₀‖`, `∏|diag R| = |det A|`, orthonormality, upper-triangular).
 */
import { describe, it, expect } from 'vitest';

import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { lu } from '../../src/operations/lu.js';
import { qr } from '../../src/operations/qr.js';

function close(a: number, b: number, tol = 1e-9): void {
  expect(Math.abs(a - b)).toBeLessThan(tol);
}

describe('lu — external oracle (exact hand-computed factors)', () => {
  it('no-pivot 3×3: exact L, U, P = identity', () => {
    // A = [[4,3,2],[2,3,1],[1,1,3]] needs no row swaps (strict column maxima).
    // Gaussian elimination gives U = diag-ish [[4,3,2],[0,1.5,0],[0,0,2.5]],
    // L multipliers 0.5, 0.25, 1/6.  det(A) = 4·1.5·2.5 = 15 (checked independently).
    const { L, U, P } = lu(
      DenseMatrix.fromArray([
        [4, 3, 2],
        [2, 3, 1],
        [1, 1, 3],
      ])
    );
    const Ua = U.toArray();
    const La = L.toArray();
    expect(P).toEqual([0, 1, 2]);
    close(Ua[0][0], 4);
    close(Ua[1][1], 1.5);
    close(Ua[2][2], 2.5);
    close(La[1][0], 0.5);
    close(La[2][0], 0.25);
    close(La[2][1], 1 / 6);
    // U upper-triangular, L unit lower-triangular.
    close(Ua[1][0], 0);
    close(Ua[2][0], 0);
    close(La[0][0], 1);
    close(La[1][1], 1);
    close(Ua[0][0] * Ua[1][1] * Ua[2][2], 15); // det via U diagonal, P even
  });

  it('pivoting 2×2: [[1,2],[3,4]] swaps rows ⇒ P=[1,0]', () => {
    // |3| > |1| ⇒ pivot on row 1.  PA = [[3,4],[1,2]]; L₁₀ = 1/3, U = [[3,4],[0,2/3]].
    const { L, U, P } = lu(
      DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ])
    );
    expect(P).toEqual([1, 0]);
    close(U.toArray()[0][0], 3);
    close(U.toArray()[1][1], 2 / 3);
    close(L.toArray()[1][0], 1 / 3);
  });
});

describe('qr — external oracle (convention-free invariants)', () => {
  it('classic Householder matrix: |R₀₀|=14, ∏|diag R|=|det A|=85750, Q orthonormal', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { Q, R } = qr(A);
    const Ra = R.toArray();
    const Qa = Q.toArray();
    const n = 3;

    // |R₀₀| = ‖first column of A‖ = ‖[12,6,-4]‖ = √196 = 14 (any valid QR).
    close(Math.abs(Ra[0][0]), 14, 1e-6);

    // R upper-triangular.
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) close(Ra[i][j], 0, 1e-6);

    // ∏|diag R| = |det A| = 85750 (= 14·175·35).
    const detR = Math.abs(Ra[0][0] * Ra[1][1] * Ra[2][2]);
    close(detR, 85750, 1e-3);

    // Q orthonormal: QᵀQ = I.
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let dot = 0;
        for (let r = 0; r < n; r++) dot += Qa[r][i] * Qa[r][j];
        close(dot, i === j ? 1 : 0, 1e-6);
      }

    // Reconstruction A = Q·R.
    const Aa = A.toArray();
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += Qa[i][k] * Ra[k][j];
        close(s, Aa[i][j], 1e-6);
      }
  });
});
