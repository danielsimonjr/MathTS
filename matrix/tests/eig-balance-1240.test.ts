/**
 * Dogfood #1240 (cause C) - `eig` balances the matrix before the QR iteration, and the QR step
 * does not stop on a shift of 0.
 *
 * - The Francis double-shift step tested `x === 0` for every k. At k = m, `x` holds the shift,
 *   so a shift of exactly 0 skipped the whole step and the iteration never moved:
 *   [[3,1e-8,0],[1e-8,0,1],[0,-1,0]] threw "QR iteration did not converge".
 * - Without a balance, an entry of 1e10 below the diagonal mixed into the QR steps of the pair
 *   +-i: [[3,0,0],[1e10,0,1],[0,-1,0]] gave 52.9, -49.9, -0.0011. `balanceForEig` (EISPACK
 *   `balanc`, LAPACK `dgebal` job B) permutes the isolated eigenvalue 3 out of the active block
 *   and scales the block by powers of 2.
 */

import { describe, it, expect } from 'vitest';
import { eig, balanceForEig, type EigResult } from '../src/index.js';

type Value = { re: number; im: number };

const sorted = (vs: Value[]): Value[] => [...vs].sort((a, b) => a.re - b.re || a.im - b.im);

/** The largest |A v - l v| over the eigenpairs, for unit eigenvectors. */
function worstResidual(A: number[][], r: EigResult): number {
  let worst = 0;
  r.values.forEach((v, k) => {
    const x = r.vectors[k];
    const y = r.vectorsIm[k];
    for (let i = 0; i < A.length; i++) {
      let sr = 0;
      let si = 0;
      for (let j = 0; j < A.length; j++) {
        sr += A[i][j] * x[j];
        si += A[i][j] * y[j];
      }
      sr -= v.re * x[i] - v.im * y[i];
      si -= v.re * y[i] + v.im * x[i];
      worst = Math.max(worst, Math.hypot(sr, si));
    }
  });
  return worst;
}

const frobenius = (A: number[][]): number => Math.hypot(...A.flat());

function expectSpectrum(A: number[][], truth: Value[], tol: number): void {
  const r = eig(A);
  const got = sorted(r.values);
  const want = sorted(truth);
  got.forEach((v, k) => {
    expect(Math.abs(v.re - want[k].re)).toBeLessThanOrEqual(tol);
    expect(Math.abs(v.im - want[k].im)).toBeLessThanOrEqual(tol);
  });
  expect(worstResidual(A, r)).toBeLessThanOrEqual(1e-13 * frobenius(A));
}

describe('eig converges when the shift is 0 (#1240, QR step)', () => {
  for (const c of [1e-13, 1e-10, 1e-8, 1e-5]) {
    it(`[[3,${c},0],[${c},0,1],[0,-1,0]] has the values 3 and +-i`, () => {
      const A = [
        [3, c, 0],
        [c, 0, 1],
        [0, -1, 0],
      ];
      expectSpectrum(
        A,
        [
          { re: 3, im: 0 },
          { re: 0, im: 1 },
          { re: 0, im: -1 },
        ],
        1e-9
      );
    });
  }
});

describe('eig balances a huge coupling entry (#1240, balance)', () => {
  for (const s of [1e10, 1e15, 1e20]) {
    for (const a of [0, 1e-5]) {
      it(`[[3,0,0],[${s},${a},1],[0,-1,${a}]] has the values 3 and ${a} +- i`, () => {
        const A = [
          [3, 0, 0],
          [s, a, 1],
          [0, -1, a],
        ];
        expectSpectrum(
          A,
          [
            { re: 3, im: 0 },
            { re: a, im: 1 },
            { re: a, im: -1 },
          ],
          1e-12
        );
      });
    }
  }

  it('[[3,1e15,0],[1e-30,0,1],[0,-1,0]] (irreducible) has the values 3 and +-i', () => {
    const A = [
      [3, 1e15, 0],
      [1e-30, 0, 1],
      [0, -1, 0],
    ];
    expectSpectrum(
      A,
      [
        { re: 3, im: 0 },
        { re: 0, im: 1 },
        { re: 0, im: -1 },
      ],
      1e-12
    );
  });
});

describe('eig scales by the active block, not by an isolated eigenvalue (#1240)', () => {
  for (const s of [1e200, 1e250, 1e280, 1e300, 1e308]) {
    it(`[[${s},0,0],[0,0,1],[0,-1,0]] has the values ${s} and +-i`, () => {
      const A = [
        [s, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
      ];
      const got = sorted(eig(A).values);
      expect(got[0].im).toBe(-1);
      expect(got[1].im).toBe(1);
      expect(got[2]).toEqual({ re: s, im: 0 });
    });
  }
});

describe('balanceForEig', () => {
  it('isolates the eigenvalue of a row with no off-diagonal entry', () => {
    const { perm, low, high, scale } = balanceForEig([
      [3, 0, 0],
      [1e10, 0, 1],
      [0, -1, 0],
    ]);
    expect(perm[2]).toBe(0);
    expect([low, high]).toEqual([0, 1]);
    expect(scale[2]).toBe(1);
  });

  it('scales a block by powers of 2 only', () => {
    const { low, high, scale } = balanceForEig([
      [3, 1e15, 0],
      [1e-30, 0, 1],
      [0, -1, 0],
    ]);
    expect([low, high]).toEqual([0, 2]);
    for (const d of scale) expect(Math.log2(d)).toBe(Math.round(Math.log2(d)));
    expect(scale.some((d) => d !== 1)).toBe(true);
  });

  it('keeps a balanced matrix as it is', () => {
    const { perm, scale } = balanceForEig([
      [1, 2],
      [3, 4],
    ]);
    expect(perm).toEqual([0, 1]);
    expect(scale).toEqual([1, 1]);
  });
});
