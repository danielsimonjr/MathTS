/**
 * Dogfood #1157 - rank decides by a QR with column pivoting and uses the SVD only near the cutoff.
 *
 * The decision must equal the singular-value rule `count(S > max(S) * max(m, n) * eps)`. A matrix
 * is built from a chosen spectrum (U diag(s) V^T, U and V orthogonal), so the expected rank is
 * known by construction and does not come from the SVD under test. The smallest singular values
 * sit far above, far below and next to the cutoff.
 */
import { describe, it, expect } from 'vitest';
import { singularValues } from '@danielsimonjr/mathts-matrix';
import { nullspace, rank } from '../src/index.js';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

/** Orthogonal n x n matrix: Gram-Schmidt of a pseudo-random matrix, twice for stability. */
function orthogonal(n: number, rnd: () => number): number[][] {
  const q: number[][] = [];
  for (let j = 0; j < n; j++) {
    let v = Array.from({ length: n }, () => rnd() + rnd() + rnd());
    for (let pass = 0; pass < 2; pass++) {
      for (const u of q) {
        let d = 0;
        for (let i = 0; i < n; i++) d += v[i] * u[i];
        v = v.map((x, i) => x - d * u[i]);
      }
    }
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    q.push(v.map((x) => x / norm));
  }
  return Array.from({ length: n }, (_, i) => q.map((col) => col[i]));
}

/** A = U diag(s) V^T for square n. */
function withSpectrum(s: number[], seed: number): number[][] {
  const n = s.length;
  const rnd = lcg(seed);
  const U = orthogonal(n, rnd);
  const V = orthogonal(n, rnd);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += U[i][k] * s[k] * V[j][k];
      return sum;
    })
  );
}

function svdRule(A: number[][]): number {
  const s = singularValues(A);
  const cut = Math.max(...s) * Math.max(A.length, A[0].length) * Number.EPSILON;
  return s.filter((x) => x > cut).length;
}

describe('#1157 the QR decision of rank equals the singular-value rule', () => {
  for (const n of [6, 24]) {
    const cut = n * Number.EPSILON; // the cutoff for sigma_max = 1
    const spectrum = (smallest: number): number[] =>
      Array.from({ length: n }, (_, i) => (i === n - 1 ? smallest : 1 / (1 + i)));

    // The larger smallest singular value (relative to the cutoff) counts; the smaller does not.
    for (const [factor, expected] of [
      [1e4, n],
      [100, n],
      [10, n],
      [0.1, n - 1],
      [0.01, n - 1],
      [1e-4, n - 1],
    ] as const) {
      it(`n=${n}: smallest singular value ${factor} x cutoff gives rank ${expected}`, () => {
        const A = withSpectrum(spectrum(factor * cut), 1000 + n);
        expect(rank(A)).toBe(expected);
        expect(rank(A)).toBe(svdRule(A));
        expect(rank(A) + nullspace(A).length).toBe(n);
      });
    }

    it(`n=${n}: a scaled copy has the same rank (scale 1e-150 and 1e150)`, () => {
      const A = withSpectrum(spectrum(100 * cut), 7 + n);
      for (const k of [1e-150, 1e150]) {
        expect(rank(A.map((row) => row.map((v) => v * k)))).toBe(n);
      }
    });
  }

  it('a rank-deficient product, a Hilbert matrix and a Kahan matrix equal the singular-value rule', () => {
    const rnd = lcg(99);
    const n = 30;
    const U = Array.from({ length: n }, () => Array.from({ length: 5 }, () => rnd() * 4));
    const V = Array.from({ length: 5 }, () => Array.from({ length: n }, () => rnd() * 4));
    const product = U.map((row) =>
      V[0].map((_, j) => row.reduce((sum, u, k) => sum + u * V[k][j], 0))
    );
    const hilbert = Array.from({ length: 14 }, (_, i) =>
      Array.from({ length: 14 }, (_, j) => 1 / (i + j + 1))
    );
    const c = Math.cos(1.2);
    const s = Math.sin(1.2);
    const kahan = Array.from({ length: 40 }, (_, i) =>
      Array.from({ length: 40 }, (_, j) => (i === j ? s ** i : j > i ? -c * s ** i : 0))
    );
    expect(rank(product)).toBe(5);
    for (const A of [product, hilbert, kahan]) expect(rank(A)).toBe(svdRule(A));
  });
});
