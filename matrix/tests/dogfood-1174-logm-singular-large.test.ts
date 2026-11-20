/**
 * Dogfood #1174 — `matrixLogm` of a singular matrix with large entries.
 *
 * The small-eigenvalue test of the Schur path ran for a diagonal entry of T at or below the
 * absolute 1e-14 only. The noise eigenvalue of a singular matrix is about 1e-16 · max|A|, so
 * from a scale of 2^10 up it passed that test, and `matrixLogm` returned a finite matrix for a
 * matrix with no logarithm (the Laplacian of a triangle, times 2^k, gave a diagonal of -4.83,
 * 9.04 and 29.8 for k = 10, 30 and 60). A small eigenvalue (at most 1e-8 · max|T_ii|) is now
 * confirmed on a second Schur form of an exact similarity copy of A: noise changes between two
 * forms, a true eigenvalue does not.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixLogm } from '../src/index.js';

type Rows = number[][];

const scale = (a: Rows, f: number): Rows => a.map((r) => r.map((x) => x * f));
const mul = (a: Rows, b: Rows): Rows =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const transpose = (a: Rows): Rows => a[0].map((_, j) => a.map((r) => r[j]));
const maxAbs = (a: Rows): number => Math.max(...a.flat().map(Math.abs));

/** Q = I - 2vvᵀ/14 for v = [1, 2, 3]: an orthogonal matrix that mixes all three axes. */
const v = [1, 2, 3];
const Q: Rows = v.map((vi, i) => v.map((vj, j) => (i === j ? 1 : 0) - (2 * vi * vj) / 14));

/** `max|got - want| / max|want|`. */
function relativeError(got: Rows, want: Rows): number {
  return Math.max(...got.flat().map((x, i) => Math.abs(x - want.flat()[i]))) / maxAbs(want);
}

describe('#1174 matrixLogm of a singular matrix at a large magnitude', () => {
  // The Laplacian of a triangle: eigenvalues 0, 3, 3.
  const L: Rows = [
    [2, -1, -1],
    [-1, 2, -1],
    [-1, -1, 2],
  ];

  it.each([-30, 6, 10, 30, 60, 200])('L · 2^%i throws a non-positive eigenvalue error', (k) => {
    expect(() => matrixLogm(DenseMatrix.fromArray(scale(L, 2 ** k)))).toThrow(
      /non-positive eigenvalue/
    );
  });
});

describe('#1174 a small eigenvalue that is resolved is kept', () => {
  it('Q · diag(1e6, 2e6, 1e-3) · Qᵀ gives Q · diag(log) · Qᵀ', () => {
    // The smallest eigenvalue is 5e-10 of the largest: it is checked on a second Schur form
    // and kept. The value of main has a relative error of 7.1e-9.
    const D = [1e6, 2e6, 1e-3];
    const A = mul(
      mul(
        Q,
        D.map((d, i) => D.map((_, j) => (i === j ? d : 0)))
      ),
      transpose(Q)
    );
    const logD = D.map((d, i) => D.map((_, j) => (i === j ? Math.log(d) : 0)));
    const want = mul(mul(Q, logD), transpose(Q));
    const got = matrixLogm(DenseMatrix.fromArray(A)).toArray() as Rows;
    expect(relativeError(got, want)).toBeLessThan(1e-7);
  });

  it('a complex pair at 1e6 with a real eigenvalue 1e-3 is kept (the second form has a 2x2 block)', () => {
    // Eigenvalues 1e6 ± 2e6 i and 1e-3. log of the pair = ln|z| · I + atan2(2, 1) · J.
    const B: Rows = [
      [1e6, -2e6, 0],
      [2e6, 1e6, 0],
      [0, 0, 1e-3],
    ];
    const lnr = Math.log(Math.hypot(1e6, 2e6));
    const theta = Math.atan2(2, 1);
    const logB: Rows = [
      [lnr, -theta, 0],
      [theta, lnr, 0],
      [0, 0, Math.log(1e-3)],
    ];
    const A = mul(mul(Q, B), transpose(Q));
    const want = mul(mul(Q, logB), transpose(Q));
    const got = matrixLogm(DenseMatrix.fromArray(A)).toArray() as Rows;
    expect(relativeError(got, want)).toBeLessThan(1e-7);
  });
});
