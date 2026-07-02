/**
 * Non-symmetric eigensolver correctness tests.
 *
 * Regression guard for the bug where the JS non-symmetric path returned
 * all-zero eigenvalues for companion-style matrices. The JS `eig` uses the
 * JAMA orthes/hqr2 algorithm, so eigenvalues match the true spectrum to machine
 * precision. (A WASM `matrix_eig_general` kernel once mirrored it; removed
 * 2026-07-01 as a scalar pessimization — eig runs in JS.)
 */

import { describe, it, expect } from 'vitest';
import { eig } from '../../src/operations/eig.js';

type Cplx = { re: number; im: number };

/** Companion matrix of x^n - 1; eigenvalues are the nth roots of unity. */
function companionRootsOfUnity(n: number): number[][] {
  const C = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 1; i < n; i++) C[i][i - 1] = 1;
  C[0][n - 1] = 1;
  return C;
}

/** True nth roots of unity. */
function rootsOfUnity(n: number): Cplx[] {
  const out: Cplx[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ re: Math.cos((2 * Math.PI * k) / n), im: Math.sin((2 * Math.PI * k) / n) });
  }
  return out;
}

/**
 * Assert two complex multisets are equal up to `tol`, via greedy nearest-match.
 * Returns the maximum matched distance (for reporting).
 */
function expectSpectrumMatch(got: Cplx[], want: Cplx[], tol = 1e-8): number {
  expect(got.length).toBe(want.length);
  const used = new Array(got.length).fill(false);
  let maxDiff = 0;
  for (const w of want) {
    let best = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < got.length; i++) {
      if (used[i]) continue;
      const dist = Math.hypot(got[i].re - w.re, got[i].im - w.im);
      if (dist < best) {
        best = dist;
        bestIdx = i;
      }
    }
    expect(best).toBeLessThan(tol);
    used[bestIdx] = true;
    if (best > maxDiff) maxDiff = best;
  }
  return maxDiff;
}

function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i] += A[i][j] * v[j];
  return out;
}

/** Residual ||A·v - λ·v|| for a real eigenpair. */
function realResidual(A: number[][], lambda: number, v: number[]): number {
  const Av = matvec(A, v);
  let r = 0;
  for (let i = 0; i < Av.length; i++) r += (Av[i] - lambda * v[i]) ** 2;
  return Math.sqrt(r);
}

/** Determinant via Gaussian elimination with partial pivoting. */
function det(A: number[][]): number {
  const n = A.length;
  const M = A.map((row) => row.slice());
  let d = 1;
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-300) return 0;
    if (piv !== k) {
      [M[k], M[piv]] = [M[piv], M[k]];
      d = -d;
    }
    d *= M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return d;
}

function trace(A: number[][]): number {
  let t = 0;
  for (let i = 0; i < A.length; i++) t += A[i][i];
  return t;
}

/** Sum of eigenvalues (real part). */
function sumRe(values: Cplx[]): number {
  return values.reduce((s, v) => s + v.re, 0);
}

/** Product of eigenvalues (complex), returned as { re, im }. */
function product(values: Cplx[]): Cplx {
  let re = 1;
  let im = 0;
  for (const v of values) {
    const nr = re * v.re - im * v.im;
    const ni = re * v.im + im * v.re;
    re = nr;
    im = ni;
  }
  return { re, im };
}

/** Deterministic pseudo-random generator for reproducible matrices. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function randomMatrix(n: number, seed: number): number[][] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rng() * 2 - 1));
}

describe('Non-symmetric eigensolver (JAMA orthes/hqr2)', () => {
  describe('Companion matrices of x^n - 1 (roots of unity, |λ| = 1)', () => {
    for (const n of [3, 4, 5, 8]) {
      it(`degree ${n}: eigenvalues are the nth roots of unity`, () => {
        const A = companionRootsOfUnity(n);
        const { values } = eig(A);

        // Every eigenvalue lies on the unit circle.
        for (const v of values) {
          expect(Math.hypot(v.re, v.im)).toBeCloseTo(1, 8);
        }

        // Spectrum matches the true nth roots of unity.
        const maxDiff = expectSpectrumMatch(values, rootsOfUnity(n), 1e-8);
        expect(maxDiff).toBeLessThan(1e-8);

        // Trace invariant: Σ re(λ) = trace(A).
        expect(sumRe(values)).toBeCloseTo(trace(A), 8);
        // Determinant invariant: Π λ = det(A) (imaginary part ≈ 0).
        const prod = product(values);
        expect(prod.re).toBeCloseTo(det(A), 6);
        expect(prod.im).toBeCloseTo(0, 6);
      });
    }
  });

  it('[[0,-1],[1,0]] has eigenvalues ±i', () => {
    const A = [
      [0, -1],
      [1, 0],
    ];
    const { values } = eig(A);
    expectSpectrumMatch(values, [
      { re: 0, im: 1 },
      { re: 0, im: -1 },
    ]);
  });

  it('rotation matrix has eigenvalues e^{±iθ}', () => {
    const theta = Math.PI / 5;
    const A = [
      [Math.cos(theta), -Math.sin(theta)],
      [Math.sin(theta), Math.cos(theta)],
    ];
    const { values } = eig(A);
    expectSpectrumMatch(values, [
      { re: Math.cos(theta), im: Math.sin(theta) },
      { re: Math.cos(theta), im: -Math.sin(theta) },
    ]);
  });

  it('Jordan block has repeated real eigenvalue', () => {
    const A = [
      [5, 1, 0],
      [0, 5, 1],
      [0, 0, 5],
    ];
    const { values } = eig(A);
    for (const v of values) {
      expect(v.re).toBeCloseTo(5, 8);
      expect(v.im).toBeCloseTo(0, 8);
    }
  });

  it('non-symmetric upper-triangular: eigenvalues on the diagonal', () => {
    const A = [
      [1, 2, 3],
      [0, 4, 5],
      [0, 0, 6],
    ];
    const { values, vectors } = eig(A);
    expectSpectrumMatch(values, [
      { re: 1, im: 0 },
      { re: 4, im: 0 },
      { re: 6, im: 0 },
    ]);
    // Real eigenvector residuals.
    for (let i = 0; i < values.length; i++) {
      if (values[i].im === 0) {
        expect(realResidual(A, values[i].re, vectors[i])).toBeLessThan(1e-7);
      }
    }
  });

  describe('Random non-symmetric matrices: invariants + eigenvector residuals', () => {
    for (const n of [4, 8, 16]) {
      it(`n=${n}: trace/det invariants and ||A·v - λ·v|| ≤ 1e-7`, () => {
        const A = randomMatrix(n, 12345 + n);
        const { values, vectors } = eig(A);

        expect(values.length).toBe(n);

        // Trace invariant.
        expect(sumRe(values)).toBeCloseTo(trace(A), 6);
        // Determinant invariant (Π λ is real for a real matrix).
        const prod = product(values);
        expect(prod.re).toBeCloseTo(det(A), Math.max(6 - Math.floor(n / 4), 2));
        expect(prod.im).toBeCloseTo(0, 4);

        // Real-eigenvalue eigenvector residuals.
        for (let i = 0; i < values.length; i++) {
          if (Math.abs(values[i].im) < 1e-9) {
            const v = vectors[i];
            const vNorm = Math.hypot(...v);
            if (vNorm > 1e-8) {
              expect(realResidual(A, values[i].re, v)).toBeLessThan(1e-7);
            }
          }
        }
      });
    }
  });
});
