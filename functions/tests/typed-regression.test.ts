/**
 * Regression Tests for polyFit / leastSquares
 *
 * Strengthens the basic interpolation/numeric tests with:
 *  - clean-sample recovery of a known polynomial within machine tolerance
 *  - noisy-sample recovery within the expected statistical envelope
 *  - leastSquares against a closed-form solution for an overdetermined system
 *
 * These functions are sequential by design (see the 2026-05-23 re-measurement
 * notes in TODO.md). The tests below pin the *current*
 * (sequential) numerical behaviour so any future parallel-path refactor can be
 * validated against the same baseline.
 */

import { describe, it, expect } from 'vitest';

import { polyFit } from '../src/typed/interpolation.js';
import { leastSquares } from '../src/typed/numeric.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Evaluate polynomial p(x) = c[0] + c[1]*x + ... + c[d]*x^d. */
function evalPoly(coeffs: number[], x: number): number {
  let acc = 0;
  let xp = 1;
  for (let i = 0; i < coeffs.length; i++) {
    acc += coeffs[i] * xp;
    xp *= x;
  }
  return acc;
}

/** Mulberry32 — small deterministic PRNG so noisy tests are reproducible. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample y = p(x) + N(0, sigma) at the given xs using a deterministic PRNG. */
function noisySamples(
  xs: number[],
  trueCoeffs: number[],
  sigma: number,
  seed: number
): number[] {
  const rng = mulberry32(seed);
  return xs.map((x) => {
    // Box-Muller for one standard normal
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return evalPoly(trueCoeffs, x) + sigma * n;
  });
}

// ---------------------------------------------------------------------------
// polyFit — clean recovery
// ---------------------------------------------------------------------------

describe('polyFit — clean-sample recovery', () => {
  it('recovers a cubic exactly when sampled at integer points', () => {
    // p(x) = 1 - 2x + 3x^2 + 0.5x^3
    const trueC = [1, -2, 3, 0.5];
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = xs.map((x) => evalPoly(trueC, x));
    const coeffs = polyFit(xs, ys, 3);
    for (let i = 0; i < trueC.length; i++) {
      expect(coeffs[i]).toBeCloseTo(trueC[i], 8);
    }
  });

  it('recovers a degree-5 polynomial within 1e-6 from 30 clean samples on [-1, 1]', () => {
    const trueC = [0.7, -1.3, 0.4, 0.9, -0.6, 1.1];
    const n = 30;
    const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
    const ys = xs.map((x) => evalPoly(trueC, x));
    const coeffs = polyFit(xs, ys, 5);
    for (let i = 0; i < trueC.length; i++) {
      // Vandermonde is moderately ill-conditioned for degree 5 on [-1, 1];
      // 1e-6 is a comfortable bound for the clean-sample case.
      expect(coeffs[i]).toBeCloseTo(trueC[i], 6);
    }
  });
});

// ---------------------------------------------------------------------------
// polyFit — noisy recovery
// ---------------------------------------------------------------------------

describe('polyFit — noisy-sample recovery', () => {
  it('recovers a quadratic within 1e-6 from 1000 samples with sigma=1e-8 noise', () => {
    // sigma=1e-8 is tiny enough that the OLS estimator's error
    // (~ sigma / sqrt(n)) is well under 1e-6.
    const trueC = [2, -1, 0.5];
    const n = 1000;
    const xs = Array.from({ length: n }, (_, i) => -2 + (4 * i) / (n - 1));
    const ys = noisySamples(xs, trueC, 1e-8, /* seed */ 42);
    const coeffs = polyFit(xs, ys, 2);
    for (let i = 0; i < trueC.length; i++) {
      expect(Math.abs(coeffs[i] - trueC[i])).toBeLessThan(1e-6);
    }
  });

  it('recovers a cubic to within 1e-3 from 500 samples with sigma=1e-4 noise', () => {
    // Larger noise — verify the estimator is unbiased and converges.
    const trueC = [1, -0.5, 0.25, -0.1];
    const n = 500;
    const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
    const ys = noisySamples(xs, trueC, 1e-4, /* seed */ 7);
    const coeffs = polyFit(xs, ys, 3);
    for (let i = 0; i < trueC.length; i++) {
      expect(Math.abs(coeffs[i] - trueC[i])).toBeLessThan(1e-3);
    }
  });
});

// ---------------------------------------------------------------------------
// leastSquares — closed-form overdetermined system
// ---------------------------------------------------------------------------

describe('leastSquares — overdetermined systems', () => {
  it('matches the closed-form solution for a small 4×2 system', () => {
    // y = 2*x + 1 fit through 4 collinear points → x = [1, 2] exactly
    const A = [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const b = [1, 3, 5, 7];
    const x = leastSquares(A, b);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(2, 10);
  });

  it('recovers a 3-parameter linear model from 200 clean samples', () => {
    // y = 3 + 2*x1 - x2  fit through 200 noiseless samples on a [-1,1] grid
    const rng = mulberry32(123);
    const m = 200;
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < m; i++) {
      const x1 = 2 * rng() - 1;
      const x2 = 2 * rng() - 1;
      A.push([1, x1, x2]);
      b.push(3 + 2 * x1 - x2);
    }
    const x = leastSquares(A, b);
    expect(x[0]).toBeCloseTo(3, 8);
    expect(x[1]).toBeCloseTo(2, 8);
    expect(x[2]).toBeCloseTo(-1, 8);
  });

  it('recovers a 5-parameter linear model from 500 samples with sigma=1e-8 noise', () => {
    const rng = mulberry32(456);
    const m = 500;
    const trueX = [0.5, -1.2, 2.3, -0.4, 0.8];
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < m; i++) {
      const row: number[] = [];
      let y = 0;
      for (let j = 0; j < trueX.length; j++) {
        const v = 2 * rng() - 1;
        row.push(v);
        y += trueX[j] * v;
      }
      // Tiny Gaussian noise via Box-Muller
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      y += 1e-8 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      A.push(row);
      b.push(y);
    }
    const x = leastSquares(A, b);
    for (let i = 0; i < trueX.length; i++) {
      expect(Math.abs(x[i] - trueX[i])).toBeLessThan(1e-6);
    }
  });

  it('throws or returns finite values for a numerically singular system', () => {
    // Two columns of A are identical → AᵀA is singular. The implementation
    // currently throws inside `linsolve('singular matrix')` — pin that
    // behaviour so a future refactor does not silently start returning NaN.
    const A = [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ];
    const b = [2, 4, 6, 8];
    expect(() => leastSquares(A, b)).toThrow(/singular/);
  });
});
