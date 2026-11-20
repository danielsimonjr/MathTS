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

describe('#1174 a cluster of zero eigenvalues is not read as a complex pair', () => {
  it('a rank-2 symmetric 4x4 matrix times 2^144 throws a non-positive eigenvalue error', () => {
    // The two zero eigenvalues of this matrix leave a 2x2 block of modulus about 1e-16 · max|A|
    // in the Schur form, a complex pair of rounding noise. The block takes the checks of a 1x1 entry.
    const A: Rows = [
      [4.0086995703212936e43, 3.9540662763382984e42, 1.418913912921378e43, 4.08010477274208e43],
      [3.9540662763382984e42, 6.23182024410905e42, -8.696872841296848e42, 7.024980107317185e42],
      [1.418913912921378e43, -8.696872841296848e42, 2.2472167567578713e43, 9.256119718471327e42],
      [4.08010477274208e43, 7.024980107317185e42, 9.256119718471327e42, 4.306893410569687e43],
    ];
    expect(() => matrixLogm(DenseMatrix.fromArray(A))).toThrow(/non-positive eigenvalue/);
  });

  it('a complex pair of modulus 1e-10 with a real eigenvalue 2 is kept (the second form has the block)', () => {
    const th = 0.7;
    const m = 1e-10;
    const B: Rows = [
      [m * Math.cos(th), -m * Math.sin(th), 0, 0],
      [m * Math.sin(th), m * Math.cos(th), 0, 0],
      [0, 0, 2, 0],
      [0, 0, 0, 5],
    ];
    const logB: Rows = [
      [Math.log(m), -th, 0, 0],
      [th, Math.log(m), 0, 0],
      [0, 0, Math.log(2), 0],
      [0, 0, 0, Math.log(5)],
    ];
    const w = [1, 2, 3, 4];
    const nn = w.reduce((a, x) => a + x * x, 0);
    const H: Rows = w.map((wi, i) => w.map((wj, j) => (i === j ? 1 : 0) - (2 * wi * wj) / nn));
    const A = mul(mul(H, B), transpose(H));
    const want = mul(mul(H, logB), transpose(H));
    const got = matrixLogm(DenseMatrix.fromArray(A)).toArray() as Rows;
    expect(relativeError(got, want)).toBeLessThan(1e-5);
  });

  it('two complex pairs of modulus 1e-10 and 3e-10 are kept (two adjacent blocks in the second form)', () => {
    // The second Schur form holds the two pairs as two 2x2 blocks next to each other. A reader
    // that takes a block only after a 1x1 entry does not see the second block, and refuses
    // this matrix.
    const pair = (m: number, th: number): Rows => [
      [m * Math.cos(th), -m * Math.sin(th)],
      [m * Math.sin(th), m * Math.cos(th)],
    ];
    const blocks: [number, number][] = [
      [1e-10, 0.7],
      [3e-10, 0.3],
    ];
    const B: Rows = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
    const logB: Rows = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
    blocks.forEach(([m, th], k) => {
      const P = pair(m, th);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          B[2 * k + i][2 * k + j] = P[i][j];
          logB[2 * k + i][2 * k + j] = i === j ? Math.log(m) : i > j ? th : -th;
        }
    });
    B[4][4] = 2;
    B[5][5] = 5;
    logB[4][4] = Math.log(2);
    logB[5][5] = Math.log(5);
    const w = [1, 2, 3, 4, 5, 6];
    const nn = w.reduce((a, x) => a + x * x, 0);
    const H: Rows = w.map((wi, i) => w.map((wj, j) => (i === j ? 1 : 0) - (2 * wi * wj) / nn));
    const A = mul(mul(H, B), transpose(H));
    const want = mul(mul(H, logB), transpose(H));
    const got = matrixLogm(DenseMatrix.fromArray(A)).toArray() as Rows;
    expect(relativeError(got, want)).toBeLessThan(1e-5);
  });
});
