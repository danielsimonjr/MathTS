/**
 * Dogfood #1104 — decompositions of a matrix with extreme entries.
 *
 * `schur([[1, 1e160], [1e160, 1]])` returned NaN. The kernels square entries, so an
 * entry above about 1e154 overflows and one below about 1e-154 underflows. Each
 * decomposition scales its input by an exact power of 2 and unscales the result.
 * The oracle is homogeneity: for a power of 2 `s`, the result for `s·A` is the
 * result for `A`, scaled by `s` (`s^p` for a factor of degree p).
 */

import { describe, it, expect } from 'vitest';
import {
  DenseMatrix,
  matrixSchur,
  matrixSqrtm,
  matrixLogm,
  qr,
  lq,
  rq,
  ql,
  qrPivoted,
  svd,
  singularValues,
  pinv,
  lowRankApprox,
  norm2,
  normFro,
  condest,
  lstsq,
  cond,
} from '../src/index.js';

const A0 = [
  [2, 1, 0.5],
  [1, 3, 1],
  [0.3, 1, 4],
];
const SPD = [
  [4, 1, 0.5],
  [1, 3, 1],
  [0.5, 1, 5],
];
// Integers, so that B0 · 2^-1060 is exact although every entry is subnormal.
const B0 = [
  [8, 1, 3],
  [1, 5, 1],
  [2, 1, 12],
];
const RECT = [
  [2, 1],
  [1, 3],
  [0.3, 1],
  [1, 0.5],
];

const P = (k: number): number => 2 ** k;
const SCALES = [P(531), P(996), P(-531), P(-994)];

const scaled = (A: number[][], s: number): number[][] => A.map((r) => r.map((v) => v * s));
const flat = (M: DenseMatrix | number[][] | number[]): number[] => {
  const a = M instanceof DenseMatrix ? M.toArray() : M;
  return (a as unknown[]).flat(Infinity) as number[];
};

/** got ≈ want · factor, measured against the largest wanted entry. */
function expectScaled(got: number[], want: number[], factor: number, tol = 1e-10): void {
  expect(got.length).toBe(want.length);
  expect(got.every(Number.isFinite)).toBe(true);
  const top = Math.max(...want.map((v) => Math.abs(v * factor)));
  for (let i = 0; i < got.length; i++) {
    expect(Math.abs(got[i] - want[i] * factor)).toBeLessThanOrEqual(tol * top);
  }
}

describe('#1104 schur of an extreme matrix', () => {
  it('schur([[1,1e160],[1e160,1]]) has the diagonal 1 ± 1e160 (SciPy)', () => {
    const A = [
      [1, 1e160],
      [1e160, 1],
    ];
    const { Q, T } = matrixSchur(A);
    const t = T.toArray();
    expect(flat(T).every(Number.isFinite)).toBe(true);
    expect(Math.abs(t[0][0]) / 1e160).toBeCloseTo(1, 12);
    expect(Math.abs(t[1][1]) / 1e160).toBeCloseTo(1, 12);
    expect(t[0][0] + t[1][1]).toBeLessThanOrEqual(1e145);
    expect(t[1][0]).toBe(0);
    // Q · T · Qᵀ = A, measured against 1e160
    const q = Q.toArray();
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let sum = 0;
        for (let k = 0; k < 2; k++) {
          for (let l = 0; l < 2; l++) sum += q[i][k] * t[k][l] * q[j][l];
        }
        expect(Math.abs(sum - A[i][j])).toBeLessThanOrEqual(1e-12 * 1e160);
      }
    }
  });

  it.each(SCALES)('schur of A0 · 2^k, s = %s', (s) => {
    const ref = matrixSchur(A0);
    const got = matrixSchur(scaled(A0, s));
    expectScaled(flat(got.T), flat(ref.T), s);
    expectScaled(flat(got.Q), flat(ref.Q), 1);
  });

  it('schur of a subnormal matrix', () => {
    const s = P(-1060);
    const ref = matrixSchur(B0);
    const got = matrixSchur(scaled(B0, s));
    expectScaled(flat(got.T), flat(ref.T), s);
  });
});

describe('#1104 sibling decompositions of an extreme matrix', () => {
  it.each(SCALES)('qr, s = %s', (s) => {
    const ref = qr(A0);
    const got = qr(scaled(A0, s));
    expectScaled(flat(got.R), flat(ref.R), s);
    expectScaled(flat(got.Q), flat(ref.Q), 1);
  });

  it.each(SCALES)('lq, rq, ql, s = %s', (s) => {
    expectScaled(flat(lq(scaled(RECT, s)).L), flat(lq(RECT).L), s);
    expectScaled(flat(rq(scaled(A0, s)).R), flat(rq(A0).R), s);
    expectScaled(flat(ql(scaled(RECT, s)).L), flat(ql(RECT).L), s);
  });

  it.each(SCALES)('qrPivoted, s = %s', (s) => {
    const ref = qrPivoted(A0);
    const got = qrPivoted(scaled(A0, s));
    expect(got.P).toEqual(ref.P);
    expect(got.rank).toBe(ref.rank);
    expectScaled(flat(got.R), flat(ref.R), s);
  });

  it.each(SCALES)('svd, singularValues, norm2, lowRankApprox, s = %s', (s) => {
    const ref = svd(A0);
    const got = svd(scaled(A0, s));
    expectScaled(got.S, ref.S, s);
    expect(got.rank).toBe(ref.rank);
    expectScaled(singularValues(scaled(A0, s)), ref.S, s);
    expectScaled([norm2(scaled(A0, s))], [ref.S[0]], s);
    expectScaled(flat(lowRankApprox(scaled(RECT, s), 1)), flat(lowRankApprox(RECT, 1)), s);
  });

  it.each(SCALES)('cond is scale-free, s = %s', (s) => {
    expectScaled([cond(scaled(A0, s))], [cond(A0)], 1);
  });

  it.each(SCALES)('pinv scales by 1/s, s = %s', (s) => {
    const ref = pinv(DenseMatrix.fromArray(RECT));
    const got = pinv(DenseMatrix.fromArray(scaled(RECT, s)));
    expectScaled(flat(got), flat(ref), 1 / s);
  });

  it.each(SCALES)('normFro, s = %s', (s) => {
    expectScaled([normFro(scaled(A0, s))], [normFro(A0)], s);
  });

  it('normFro of [[1e160, 1e160]] is sqrt(2) · 1e160', () => {
    expectScaled([normFro([[1e160, 1e160]])], [Math.SQRT2], 1e160);
  });

  it('svd, qr and normFro of a subnormal matrix', () => {
    const s = P(-1060);
    expectScaled(svd(scaled(B0, s)).S, svd(B0).S, s);
    expectScaled(flat(qr(scaled(B0, s)).R), flat(qr(B0).R), s);
    expectScaled([normFro(scaled(B0, s))], [normFro(B0)], s);
  });

  it.each(SCALES)('sqrtm scales by sqrt(s), s = %s', (s) => {
    const ref = matrixSqrtm(DenseMatrix.fromArray(SPD));
    const got = matrixSqrtm(DenseMatrix.fromArray(scaled(SPD, s)));
    expectScaled(flat(got), flat(ref), Math.sqrt(s));
  });

  it.each(SCALES)('logm adds ln(s) on the diagonal, s = %s', (s) => {
    const ref = flat(matrixLogm(DenseMatrix.fromArray(SPD)));
    const want = ref.map((v, i) => (i % 4 === 0 ? v + Math.log(s) : v));
    const got = flat(matrixLogm(DenseMatrix.fromArray(scaled(SPD, s))));
    expectScaled(got, want, 1);
  });
});

describe('#1104 norm, condest and lstsq of an extreme matrix', () => {
  it.each(SCALES)('DenseMatrix.norm, s = %s', (s) => {
    const ref = DenseMatrix.fromArray(A0).norm();
    expectScaled([DenseMatrix.fromArray(scaled(A0, s)).norm()], [ref], s);
  });

  it('DenseMatrix.norm of [[1e200, 1e200]] is sqrt(2) · 1e200', () => {
    expectScaled([DenseMatrix.fromArray([[1e200, 1e200]]).norm()], [Math.SQRT2], 1e200);
  });

  it.each([...SCALES, P(-1060)])('condest is scale-free, s = %s', (s) => {
    const ref = condest(DenseMatrix.fromArray(B0));
    expectScaled([condest(DenseMatrix.fromArray(scaled(B0, s)))], [ref], 1);
  });

  it.each([...SCALES, P(-1060)])('lstsq scales by 1/s on A and by s on b, s = %s', (s) => {
    const b = [1, 2, 3];
    const ref = lstsq(B0, b);
    // x = ref / s overflows for s = 2^-1060, which no double holds.
    if (Number.isFinite(1 / s)) expectScaled(lstsq(scaled(B0, s), b), ref, 1 / s);
    expectScaled(
      lstsq(
        scaled(B0, s),
        b.map((v) => v * s)
      ),
      ref,
      1
    );
  });
});
