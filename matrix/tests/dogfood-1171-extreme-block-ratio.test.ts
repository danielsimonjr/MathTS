/**
 * Dogfood #1171 — a 2x2 block of the real Schur form with a very large ratio of its two
 * off-diagonal entries.
 *
 * `[[1, -b], [c, 1]]` with `b·c = 1` has the eigenvalues 1 ± i at every scale of b. Two defects
 * hid in such a block: the balance of `matrixLogm` formed the ratio b/c, which overflows to
 * Infinity above about 1e154 and gave a NaN matrix, and the 2x2 root of the quasi-triangular
 * form had an absolute cutoff on tau that a power-of-2 window crossed. The closed form is
 * log(1 + iN) = ln(√2)·I + (π/4)·N and √(I + N) = Re(√(1+i))·I + Im(√(1+i))·N, N = [[0,-b],[c,0]].
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixSqrtm, matrixLogm } from '../src/index.js';

const LN_SQRT2 = 0.34657359027997264;
const QUARTER_PI = 0.7853981633974483;
const ROOT_RE = 1.0986841134678098; // Re √(1+i)
const ROOT_IM = 0.45508986056222733; // Im √(1+i)

function expectClose(got: number, want: number, rel: number): void {
  expect(Number.isFinite(got)).toBe(true);
  expect(Math.abs(got - want)).toBeLessThanOrEqual(rel * Math.abs(want));
}

describe('dogfood #1171: logm and sqrtm of a block with an extreme off-diagonal ratio', () => {
  for (const [b, c] of [
    [1e160, 1e-160],
    [1e70, 1e-70],
    [1e150, 1e-150],
  ] as const) {
    it(`matrixLogm([[1, -${b}], [${c}, 1]]) is the closed form`, () => {
      const L = matrixLogm(
        DenseMatrix.fromArray([
          [1, -b],
          [c, 1],
        ])
      ).toArray();
      expectClose(L[0][0], LN_SQRT2, 1e-12);
      expectClose(L[1][1], LN_SQRT2, 1e-12);
      expectClose(L[0][1], -QUARTER_PI * b, 1e-12);
      expectClose(L[1][0], QUARTER_PI * c, 1e-12);
    });

    it(`matrixSqrtm([[1, -${b}], [${c}, 1]]) is the closed form`, () => {
      const R = matrixSqrtm(
        DenseMatrix.fromArray([
          [1, -b],
          [c, 1],
        ])
      ).toArray();
      expectClose(R[0][0], ROOT_RE, 1e-12);
      expectClose(R[1][1], ROOT_RE, 1e-12);
      expectClose(R[0][1], -ROOT_IM * b, 1e-12);
      expectClose(R[1][0], ROOT_IM * c, 1e-12);
    });
  }

  it('matrixLogm of a block inside the scale window (diagonal 2^-105) is the closed form', () => {
    const s = 2 ** -105;
    const L = matrixLogm(
      DenseMatrix.fromArray([
        [s, -s * 1e30],
        [s * 1e-30, s],
      ])
    ).toArray();
    const diag = LN_SQRT2 - 105 * Math.LN2;
    expectClose(L[0][0], diag, 1e-12);
    expectClose(L[1][1], diag, 1e-12);
    expectClose(L[0][1], -QUARTER_PI * 1e30, 1e-12);
    expectClose(L[1][0], QUARTER_PI * 1e-30, 1e-12);
  });
});
