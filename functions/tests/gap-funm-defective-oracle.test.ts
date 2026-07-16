import { describe, it, expect } from 'vitest';
import { funm, cosm, sinm, expm } from '../src/index.js';
import type { ComplexValue, ScalarComplexFunction } from '../src/index.js';

// Oracle values verified with scipy (2026-07-16):
//   expm([[2,1],[0,2]])   = e^2 * [[1,1],[0,1]]
//   sqrtm([[2,1],[0,2]])  = sqrt2 * [[1,0.25],[0,1]]
//   expm([[3,1,0],[0,3,1],[0,0,3]]) = [[e^3,e^3,e^3/2],[0,e^3,e^3],[0,0,e^3]]
// scipy.linalg.funm is WRONG on exact Jordan blocks — NOT used as oracle here.

const complexExp: ScalarComplexFunction = (z: ComplexValue) => {
  const r = Math.exp(z.re);
  return { re: r * Math.cos(z.im), im: r * Math.sin(z.im) };
};
// f' = f'' = ... = exp
const expDerivs: ScalarComplexFunction[] = Array.from({ length: 8 }, () => complexExp);

// principal complex sqrt
const csqrt: ScalarComplexFunction = (z: ComplexValue) => {
  const r = Math.hypot(z.re, z.im);
  const a = Math.atan2(z.im, z.re) / 2;
  const m = Math.sqrt(r);
  return { re: m * Math.cos(a), im: m * Math.sin(a) };
};
// d/dz sqrt(z) = 1/(2 sqrt z);  d2 = -1/(4 z^(3/2)); ...
const csqrtPrime: ScalarComplexFunction = (z: ComplexValue) => {
  const s = csqrt(z); // sqrt z
  // 1 / (2 s) = conj(s) / (2 |s|^2)
  const d = 2 * (s.re * s.re + s.im * s.im);
  return { re: s.re / d, im: -s.im / d };
};

const E2 = Math.exp(2);
const E3 = Math.exp(3);
const SQRT2 = Math.SQRT2;

describe('funm — defective / repeated-eigenvalue matrices', () => {
  it('funm([[2,1],[0,2]], exp) = e^2·[[1,1],[0,1]] (analytic derivatives)', () => {
    const R = funm(
      [
        [2, 1],
        [0, 2],
      ],
      complexExp,
      expDerivs
    );
    expect(R.re[0][0]).toBeCloseTo(E2, 10);
    expect(R.re[0][1]).toBeCloseTo(E2, 10);
    expect(R.re[1][0]).toBeCloseTo(0, 10);
    expect(R.re[1][1]).toBeCloseTo(E2, 10);
    expect(Math.abs(R.im[0][1])).toBeLessThan(1e-10);
  });

  it('funm([[2,1],[0,2]], exp) via NUMERICAL derivatives (looser tol 1e-6)', () => {
    const R = funm(
      [
        [2, 1],
        [0, 2],
      ],
      complexExp
    );
    expect(R.re[0][0]).toBeCloseTo(E2, 6);
    expect(R.re[0][1]).toBeCloseTo(E2, 6);
    expect(R.re[1][1]).toBeCloseTo(E2, 6);
    expect(Math.abs(R.re[1][0])).toBeLessThan(1e-6);
  });

  it('funm([[2,1],[0,2]], sqrt) = sqrt2·[[1,0.25],[0,1]] (analytic derivative)', () => {
    const R = funm(
      [
        [2, 1],
        [0, 2],
      ],
      csqrt,
      [csqrtPrime]
    );
    expect(R.re[0][0]).toBeCloseTo(SQRT2, 10);
    expect(R.re[0][1]).toBeCloseTo(SQRT2 * 0.25, 10);
    expect(R.re[1][0]).toBeCloseTo(0, 10);
    expect(R.re[1][1]).toBeCloseTo(SQRT2, 10);
  });

  it('funm([[2,1],[0,2]], sqrt) via NUMERICAL derivative (looser tol 1e-6)', () => {
    const R = funm(
      [
        [2, 1],
        [0, 2],
      ],
      csqrt
    );
    expect(R.re[0][0]).toBeCloseTo(SQRT2, 6);
    expect(R.re[0][1]).toBeCloseTo(SQRT2 * 0.25, 6);
    expect(R.re[1][1]).toBeCloseTo(SQRT2, 6);
  });

  it('funm(3x3 Jordan block, exp) = closed form (analytic derivatives)', () => {
    const R = funm(
      [
        [3, 1, 0],
        [0, 3, 1],
        [0, 0, 3],
      ],
      complexExp,
      expDerivs
    );
    const expected = [
      [E3, E3, E3 / 2],
      [0, E3, E3],
      [0, 0, E3],
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(R.re[i][j]).toBeCloseTo(expected[i][j], 8);
        expect(Math.abs(R.im[i][j])).toBeLessThan(1e-8);
      }
    }
  });

  it('cosm on a defective 2x2 Jordan block = closed form', () => {
    // cosm([[a,1],[0,a]]) = [[cos a, -sin a],[0, cos a]]
    const a = 0.7;
    const C = cosm([
      [a, 1],
      [0, a],
    ]);
    expect(C.re[0][0]).toBeCloseTo(Math.cos(a), 10);
    expect(C.re[0][1]).toBeCloseTo(-Math.sin(a), 10);
    expect(C.re[1][0]).toBeCloseTo(0, 10);
    expect(C.re[1][1]).toBeCloseTo(Math.cos(a), 10);
  });

  it('sinm on a defective 2x2 Jordan block = closed form', () => {
    // sinm([[a,1],[0,a]]) = [[sin a, cos a],[0, sin a]]
    const a = 0.7;
    const S = sinm([
      [a, 1],
      [0, a],
    ]);
    expect(S.re[0][0]).toBeCloseTo(Math.sin(a), 10);
    expect(S.re[0][1]).toBeCloseTo(Math.cos(a), 10);
    expect(S.re[1][0]).toBeCloseTo(0, 10);
    expect(S.re[1][1]).toBeCloseTo(Math.sin(a), 10);
  });

  it('funm(A, exp) ≈ expm(A) for a mixed defective matrix (eig 1 mult 2, 2 mult 1)', () => {
    const A = [
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 2],
    ];
    const R = funm(A, complexExp, expDerivs);
    const P = expm(A) as number[][];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(R.re[i][j]).toBeCloseTo(P[i][j], 8);
      }
    }
  });

  it('regression: distinct-eigenvalue matrix unchanged (cosm still matches funm path)', () => {
    // Diagonalizable, distinct eigenvalues (5, 2). Must equal the pre-existing
    // Lagrange-Sylvester result — sanity vs the closed form cos(A).
    const A = [
      [4, 1],
      [2, 3],
    ];
    const C = cosm(A);
    // Oracle via scipy cosm([[4,1],[2,3]]) (computed 2026-07-16):
    //   [[0.0503925115, 0.233269674],[0.466539348, -0.1828771625]]
    expect(C.re[0][0]).toBeCloseTo(0.0503925115, 6);
    expect(C.re[0][1]).toBeCloseTo(0.233269674, 6);
    expect(C.re[1][0]).toBeCloseTo(0.466539348, 6);
    expect(C.re[1][1]).toBeCloseTo(-0.1828771625, 6);
  });
});
