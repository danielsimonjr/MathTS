/**
 * qr parity guard — functions factory ≡ matrix primitive ≡ NumPy.
 *
 * `qr` is defined in BOTH packages with DIFFERENT contracts, and the dedup
 * campaign KEEPS both (routing the factory `qr` to the matrix layer would drop
 * the mathjs Matrix/Sparse contract AND the `qr_wasm` fast path):
 *
 *  - functions/src/algebra/decomposition/qr.ts — `createQr` factory over the
 *    mathjs `Matrix`/`SparseMatrix` bridge, Householder QR, with a WASM fast path.
 *    Array input ⇒ `{Q: number[][], R: number[][]}` (full Q: m×m, R: m×n).
 *  - matrix/src/operations/qr.ts — DenseMatrix primitive, Gram-Schmidt with
 *    re-orthogonalisation, 'reduced' (default) or 'full' mode.
 *
 * Both are allowlisted as distinct-contract dispatch-variants. Per
 * feedback-allowlist-needs-parity-guard, an allowlist alone is negligent: this
 * test pins the two impls together AND to the NumPy oracle so a future edit can't
 * let them silently diverge.
 *
 * QR is only unique up to the signs of Q's columns / R's rows, so the
 * implementation-independent invariants are pinned (per
 * feedback-oracle-tests-implementation-independent):
 *   1. |diag(R)| ≡ NumPy's |diag(R)| (sign-invariant), and functions ≡ matrix.
 *   2. A = Q·R reconstructs A (the defining property).
 *   3. Qᵀ·Q = I (Q's columns are orthonormal).
 *
 * Oracle from NumPy 2.x: `np.linalg.qr(A)` → `np.abs(np.diag(R))`.
 */
import { describe, it, expect } from 'vitest';
import { qr } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, qr as mQr } from '@danielsimonjr/mathts-matrix';

// Square, full-rank corpus so functions' full Q (m×m) and matrix's reduced Q
// (m×k, k=n=m) coincide and are directly comparable to NumPy's reduced QR.
const CORPUS: Array<{ A: number[][]; absDiagR: number[] }> = [
  {
    A: [
      [1, 2],
      [3, 4],
    ],
    absDiagR: [3.1622776602, 0.632455532],
  },
  {
    A: [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ],
    absDiagR: [2.2360679775, 1.6733200531, 1.0690449676],
  },
  {
    A: [
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ],
    absDiagR: [14, 175, 35],
  },
];

const absDiag = (R: number[][]): number[] => R.map((row, i) => Math.abs(row[i]));

const matMul = (a: number[][], b: number[][]): number[][] => {
  const n = a.length;
  const m = b[0].length;
  const k = b.length;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    out[i] = [];
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += a[i][t] * b[t][j];
      out[i][j] = s;
    }
  }
  return out;
};

const transpose = (a: number[][]): number[][] => a[0].map((_, j) => a.map((row) => row[j]));

const approxEqual = (a: number[][], b: number[][], digits = 9): void => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].length).toBe(b[i].length);
    for (let j = 0; j < a[i].length; j++) expect(a[i][j]).toBeCloseTo(b[i][j], digits);
  }
};

describe('qr parity — functions factory ≡ matrix primitive ≡ NumPy', () => {
  for (const { A, absDiagR } of CORPUS) {
    it(`|diag R| matches NumPy for ${JSON.stringify(A)}`, () => {
      const f = qr(A) as { Q: number[][]; R: number[][] };
      const m = mQr(DenseMatrix.fromArray(A));
      const fAbs = absDiag(f.R);
      const mAbs = absDiag(m.R.toArray() as number[][]);
      for (let i = 0; i < absDiagR.length; i++) {
        expect(fAbs[i]).toBeCloseTo(absDiagR[i], 8); // NumPy oracle
        expect(mAbs[i]).toBeCloseTo(absDiagR[i], 8); // NumPy oracle
        expect(fAbs[i]).toBeCloseTo(mAbs[i], 9); // functions ≡ matrix
      }
    });

    it(`A = Q·R reconstructs A for ${JSON.stringify(A)}`, () => {
      const f = qr(A) as { Q: number[][]; R: number[][] };
      approxEqual(matMul(f.Q, f.R), A);
      const m = mQr(DenseMatrix.fromArray(A));
      approxEqual(matMul(m.Q.toArray() as number[][], m.R.toArray() as number[][]), A);
    });

    it(`Qᵀ·Q = I (orthonormal columns) for ${JSON.stringify(A)}`, () => {
      const n = A.length;
      const identity = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
      );
      const f = qr(A) as { Q: number[][]; R: number[][] };
      approxEqual(matMul(transpose(f.Q), f.Q), identity);
      const mQmat = mQr(DenseMatrix.fromArray(A)).Q.toArray() as number[][];
      approxEqual(matMul(transpose(mQmat), mQmat), identity);
    });
  }
});
