/**
 * Dogfood #1171 — the Schur deflation test read a 2x2 block with complex eigenvalues as two
 * 1x1 blocks.
 *
 * The test compared the subdiagonal entry with the diagonal only. A block such as
 * `[[10, -1e14], [1e-12, 10]]` has a tiny subdiagonal entry but a huge superdiagonal entry, so
 * it is far from triangular: its eigenvalues are 10 ± 10i. The deflation test now also reads the
 * superdiagonal entry (LAPACK `dlahqr`, Ahues-Tisseur). `matrixSqrtm` and `matrixLogm` read the
 * same test, so the blocks they treat as 2x2 are the blocks that Schur left standing.
 *
 * Oracle: SciPy `sqrtm` and `logm` (values below), and the closed form for `I + N` with
 * `N² = -I`, whose root and logarithm are `αI + βN` for a complex number `α + iβ`.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixSqrtm, matrixLogm, matrixSchur } from '../src/index.js';
import { negligibleSubdiagonal } from '../src/operations/schur.js';

const nested = (m: DenseMatrix): number[][] => m.toArray();
const mul = (a: number[][], b: number[][]): number[][] =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const maxAbs = (a: number[][]): number => Math.max(...a.flat().map(Math.abs));
const transpose = (a: number[][]): number[][] => a[0].map((_, j) => a.map((r) => r[j]));

/** `|got - want| <= rel · |want|` for one entry. */
function expectClose(got: number, want: number, rel: number): void {
  expect(Math.abs(got - want)).toBeLessThanOrEqual(rel * Math.abs(want));
}

function expectEntries(got: number[][], want: number[][], rel: number): void {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++)
    for (let j = 0; j < want.length; j++) expectClose(got[i][j], want[i][j], rel);
}

/** `max|X·X - A| / max|A|`. */
function squareResidual(X: number[][], A: number[][]): number {
  const XX = mul(X, X);
  return Math.max(...XX.flat().map((v, i) => Math.abs(v - A.flat()[i]))) / maxAbs(A);
}

const A1171 = [
  [10, -1e14],
  [1e-12, 10],
];
const C1171 = [
  [1, -1e12],
  [1e-12, 1],
];

describe('#1171 Schur deflation keeps a 2x2 block with complex eigenvalues', () => {
  it('matrixSchur: [[10,-1e14],[1e-12,10]] is not split (eigenvalues 10 ± 10i)', () => {
    const T = nested(matrixSchur(DenseMatrix.fromArray(A1171)).T);
    expect(T[1][0]).not.toBe(0);
    const [[a, b], [c, d]] = T;
    const re = (a + d) / 2;
    const im = Math.sqrt(-(((a - d) / 2) ** 2 + b * c));
    expectClose(re, 10, 1e-8);
    expectClose(im, 10, 1e-8);
  });

  it('matrixSchur: a small subdiagonal entry next to a small superdiagonal entry still deflates', () => {
    const T = nested(
      matrixSchur(
        DenseMatrix.fromArray([
          [10, 1],
          [1e-13, 20],
        ])
      ).T
    );
    expect(T[1][0]).toBe(0);
  });

  it('negligibleSubdiagonal: the superdiagonal entry decides when the diagonal is flat', () => {
    expect(negligibleSubdiagonal(A1171, 1)).toBe(false);
    expect(
      negligibleSubdiagonal(
        [
          [10, 1],
          [1e-13, 20],
        ],
        1
      )
    ).toBe(true);
    expect(
      negligibleSubdiagonal(
        [
          [3, 5],
          [0, 4],
        ],
        1
      )
    ).toBe(true);
    // A tiny subdiagonal entry against a zero diagonal and a unit superdiagonal entry.
    expect(
      negligibleSubdiagonal(
        [
          [0, 1],
          [1e-13, 0],
        ],
        1
      )
    ).toBe(false);
  });
});

describe('#1171 matrixSqrtm of a block with complex eigenvalues', () => {
  it('[[10,-1e14],[1e-12,10]] gives the SciPy root', () => {
    const R = nested(matrixSqrtm(DenseMatrix.fromArray(A1171)));
    expectClose(R[0][0], 3.474344227601156, 1e-8);
    expectClose(R[1][1], 3.474344227601156, 1e-8);
    expectClose(R[0][1], -14391204994250.742, 1e-8);
    expectClose(R[1][0], 1.4391204994250743e-13, 1e-6);
    expect(squareResidual(R, A1171)).toBeLessThan(1e-10);
  });

  it('[[1,-1e12],[1e-12,1]] gives the closed-form root αI + βN', () => {
    // sqrt(1 + i) = 1.0986841134678098 + 0.45508986056222733 i, so root = [[α, -β·1e12], [β·1e-12, α]].
    const alpha = 1.0986841134678098;
    const beta = 0.45508986056222733;
    const R = nested(matrixSqrtm(DenseMatrix.fromArray(C1171)));
    expectEntries(
      R,
      [
        [alpha, -beta * 1e12],
        [beta * 1e-12, alpha],
      ],
      1e-10
    );
    expect(squareResidual(R, C1171)).toBeLessThan(1e-10);
  });

  it('control: [[10,1],[1e-13,20]] keeps the triangular result', () => {
    const R = nested(
      matrixSqrtm(
        DenseMatrix.fromArray([
          [10, 1],
          [1e-13, 20],
        ])
      )
    );
    expect(R).toEqual([
      [3.1622776601683795, 0.13098582948312],
      [0, 4.47213595499958],
    ]);
  });
});

describe('#1171 matrixLogm of a real matrix with complex eigenvalues', () => {
  it('[[10,-1e14],[1e-12,10]] gives the SciPy real logarithm (2.6492 on the diagonal)', () => {
    const L = nested(matrixLogm(DenseMatrix.fromArray(A1171)));
    expectEntries(
      L,
      [
        [2.649158683274018, -7853981633974.483],
        [7.853981633974483e-14, 2.649158683274018],
      ],
      1e-10
    );
  });

  it('[[1,-1e12],[1e-12,1]] gives ln(√2)·I + (π/4)·N', () => {
    const L = nested(matrixLogm(DenseMatrix.fromArray(C1171)));
    expectEntries(
      L,
      [
        [0.34657359027997264, -785398163397.4482],
        [7.853981633974483e-13, 0.34657359027997264],
      ],
      1e-10
    );
  });

  it('a rotation by 90 degrees has the logarithm (π/2)·J', () => {
    const L = nested(
      matrixLogm(
        DenseMatrix.fromArray([
          [0, -1],
          [1, 0],
        ])
      )
    );
    expect(Math.abs(L[0][0])).toBeLessThan(1e-14);
    expect(Math.abs(L[1][1])).toBeLessThan(1e-14);
    expectClose(L[0][1], -Math.PI / 2, 1e-14);
    expectClose(L[1][0], Math.PI / 2, 1e-14);
  });

  it('a complex pair with a negative real part has a real principal logarithm', () => {
    // eigenvalues -1 ± 2i: log = ln√5 ± i·atan2(2, -1)
    const L = nested(
      matrixLogm(
        DenseMatrix.fromArray([
          [-1, -2],
          [2, -1],
        ])
      )
    );
    const theta = Math.atan2(2, -1);
    expectEntries(
      L,
      [
        [Math.log(Math.sqrt(5)), -theta],
        [theta, Math.log(Math.sqrt(5))],
      ],
      1e-12
    );
  });

  it('a complex pair plus a real eigenvalue, rotated by a Householder Q, matches the closed form', () => {
    // A = Q · blockdiag([[1,-2],[2,1]], 3) · Qᵀ, with Q = I - 2vvᵀ/14, v = [1,2,3].
    const v = [1, 2, 3];
    const Q = v.map((vi, i) => v.map((vj, j) => (i === j ? 1 : 0) - (2 * vi * vj) / 14));
    const B = [
      [1, -2, 0],
      [2, 1, 0],
      [0, 0, 3],
    ];
    const theta = Math.atan2(2, 1);
    const lnr = Math.log(Math.sqrt(5));
    const logB = [
      [lnr, -theta, 0],
      [theta, lnr, 0],
      [0, 0, Math.log(3)],
    ];
    const A = mul(mul(Q, B), transpose(Q));
    const want = mul(mul(Q, logB), transpose(Q));
    const L = nested(matrixLogm(DenseMatrix.fromArray(A)));
    const diff = Math.max(...L.flat().map((x, i) => Math.abs(x - want.flat()[i])));
    expect(diff / maxAbs(want)).toBeLessThan(1e-12);
  });
});

describe('matrixLogm of a matrix with an infinite eigenvalue', () => {
  it('names the non-finite entry, as main did (not a non-positive eigenvalue)', () => {
    for (const A of [
      [
        [Infinity, 0],
        [0, 1],
      ],
      [
        [2, 0],
        [0, -Infinity],
      ],
    ])
      expect(() => matrixLogm(DenseMatrix.fromArray(A))).toThrow(/non-finite/);
  });
});
