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

  // -------------------------------------------------------------------------
  // Complex-spectrum defective matrices (repeated complex-conjugate eigenvalue
  // pair, geometric mult < algebraic). The minimal such matrix is 4×4: a 2×2
  // real-Jordan block  J = [[C, I],[0, C]],  C = [[a, b],[-b, a]] (the real
  // representation of a±bi), whose spectrum is {a+bi (×2), a−bi (×2)} with
  // geometric multiplicity 1. This exercises the confluent Hermite branch with
  // COMPLEX nodes — the case whose real-direction finite-difference derivative
  // path was previously untested. Oracles: scipy.linalg.{expm,cosm,sinm}
  // (computed 2026-07-18). The result must be REAL (imag parts must cancel).
  // -------------------------------------------------------------------------
  describe('complex-spectrum defective (repeated complex-conjugate pair)', () => {
    // a=0.3, b=0.5 → eigenvalues 0.3±0.5i each with algebraic mult 2.
    const J4 = [
      [0.3, 0.5, 1, 0],
      [-0.5, 0.3, 0, 1],
      [0, 0, 0.3, 0.5],
      [0, 0, -0.5, 0.3],
    ];
    const expm4 = [
      [1.1846125505428324, 0.6471567858617525, 1.1846125505428322, 0.6471567858617526],
      [-0.6471567858617525, 1.1846125505428324, -0.6471567858617526, 1.1846125505428324],
      [0, 0, 1.1846125505428324, 0.6471567858617525],
      [0, 0, -0.6471567858617525, 1.1846125505428324],
    ];
    const cosm4 = [
      [1.0772622306471367, -0.15399419236976614, -0.3332362582744822, -0.4978213596502318],
      [0.15399419236976614, 1.0772622306471367, 0.4978213596502318, -0.3332362582744822],
      [0, 0, 1.0772622306471367, -0.15399419236976614],
      [0, 0, 0.15399419236976614, 1.0772622306471367],
    ];
    const sinm4 = [
      [0.3332362582744822, 0.4978213596502317, 1.0772622306471367, -0.15399419236976614],
      [-0.4978213596502318, 0.3332362582744822, 0.15399419236976614, 1.0772622306471369],
      [0, 0, 0.3332362582744822, 0.4978213596502317],
      [0, 0, -0.4978213596502318, 0.3332362582744822],
    ];

    function expectClose(
      R: { re: number[][]; im: number[][] },
      oracle: number[][],
      digits: number
    ) {
      for (let i = 0; i < oracle.length; i++) {
        for (let j = 0; j < oracle.length; j++) {
          expect(R.re[i][j]).toBeCloseTo(oracle[i][j], digits);
          // f of a real matrix is real — imaginary parts must cancel.
          expect(Math.abs(R.im[i][j])).toBeLessThan(1e-8);
        }
      }
    }

    it('funm(4×4 complex-defective, exp) = scipy.expm (analytic derivatives)', () => {
      expectClose(funm(J4, complexExp, expDerivs), expm4, 9);
    });

    it('funm(4×4 complex-defective, exp) via NUMERICAL derivatives (real-direction FD, tol 1e-6)', () => {
      // The previously-untested path: real-direction finite difference on a
      // complex eigenvalue node. For analytic f the real-direction derivative
      // equals the complex derivative, so this stays within the ~1e-6 budget.
      expectClose(funm(J4, complexExp), expm4, 6);
    });

    it('cosm(4×4 complex-defective) = scipy.cosm (analytic trig derivatives)', () => {
      expectClose(cosm(J4), cosm4, 9);
    });

    it('sinm(4×4 complex-defective) = scipy.sinm (analytic trig derivatives)', () => {
      expectClose(sinm(J4), sinm4, 9);
    });

    // Higher multiplicity (×3) — 6×6 real-Jordan block, exercises the 2nd
    // derivative (numerical stencil order 2). a=0.2, b=0.4.
    const J6 = [
      [0.2, 0.4, 1, 0, 0, 0],
      [-0.4, 0.2, 0, 1, 0, 0],
      [0, 0, 0.2, 0.4, 1, 0],
      [0, 0, -0.4, 0.2, 0, 1],
      [0, 0, 0, 0, 0.2, 0.4],
      [0, 0, 0, 0, -0.4, 0.2],
    ];
    const cosm6 = [
      [
        1.0595228998664288, -0.08160388968976032, -0.21477592465417544, -0.4025646262898961,
        -0.5297614499332143, 0.04080194484488017,
      ],
      [
        0.08160388968976033, 1.0595228998664288, 0.40256462628989625, -0.21477592465417547,
        -0.040801944844880186, -0.5297614499332144,
      ],
      [0, 0, 1.0595228998664288, -0.08160388968976032, -0.21477592465417544, -0.4025646262898961],
      [0, 0, 0.08160388968976033, 1.0595228998664288, 0.4025646262898962, -0.21477592465417544],
      [0, 0, 0, 0, 1.0595228998664288, -0.08160388968976032],
      [0, 0, 0, 0, 0.08160388968976033, 1.0595228998664288],
    ];

    it('cosm(6×6 complex-defective, mult 3) = scipy.cosm (2nd-derivative confluent path)', () => {
      expectClose(cosm(J6), cosm6, 9);
    });

    it('funm(6×6 complex-defective, exp) via NUMERICAL derivatives up to order 2 (tol 1e-6)', () => {
      const expm6 = [
        [
          1.1249864385088715, 0.47563663737394696, 1.1249864385088715, 0.475636637373947,
          0.562493219254436, 0.23781831868697353,
        ],
        [
          -0.47563663737394696, 1.1249864385088715, -0.475636637373947, 1.1249864385088715,
          -0.23781831868697356, 0.5624932192544357,
        ],
        [0, 0, 1.1249864385088715, 0.47563663737394696, 1.1249864385088717, 0.475636637373947],
        [0, 0, -0.47563663737394696, 1.1249864385088715, -0.475636637373947, 1.1249864385088715],
        [0, 0, 0, 0, 1.1249864385088715, 0.47563663737394696],
        [0, 0, 0, 0, -0.47563663737394696, 1.1249864385088715],
      ];
      expectClose(funm(J6, complexExp), expm6, 6);
    });
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
