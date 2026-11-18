/**
 * Dogfood #1192 — `eig` of an n x n zero matrix (n >= 3) must not throw.
 *
 * The Hessenberg QR deflation test compared the sub-diagonal with `eps * s`.
 * When the matrix norm is zero, `s` is zero and `0 < 0` never deflated.
 */

import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../src/index.js';

const zeros = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array<number>(n).fill(0));

const blockDiag = (a: number[][], b: number[][]): number[][] => {
  const n = a.length + b.length;
  const m = zeros(n);
  a.forEach((row, i) => row.forEach((v, j) => (m[i][j] = v)));
  b.forEach((row, i) => row.forEach((v, j) => (m[a.length + i][a.length + j] = v)));
  return m;
};

// Max |A v - lambda v| over all eigenpairs. Eigenvectors are ROWS:
// vectors[k] + i*vectorsIm[k] belongs to values[k].
const residual = (A: number[][], r: ReturnType<typeof eig>): number => {
  const n = A.length;
  let worst = 0;
  for (let k = 0; k < n; k++) {
    const { re: lr, im: li } = r.values[k];
    const vr = r.vectors[k];
    const vi = r.vectorsIm[k];
    for (let i = 0; i < n; i++) {
      let ar = 0;
      let ai = 0;
      for (let j = 0; j < n; j++) {
        ar += A[i][j] * vr[j];
        ai += A[i][j] * vi[j];
      }
      const er = ar - (lr * vr[i] - li * vi[i]);
      const ei = ai - (lr * vi[i] + li * vr[i]);
      worst = Math.max(worst, Math.hypot(er, ei));
    }
  }
  return worst;
};

const allFinite = (r: ReturnType<typeof eig>): boolean =>
  [...r.vectors, ...r.vectorsIm].every((row) => row.every(Number.isFinite));

const reOf = (v: unknown): number => (typeof v === 'number' ? v : (v as { re: number }).re);

describe('eig of zero matrices (#1192)', () => {
  for (let n = 1; n <= 12; n++) {
    it(`eig and eigvals of the ${n}x${n} zero matrix`, () => {
      const A = zeros(n);
      const r = eig(A);
      expect(r.values).toHaveLength(n);
      for (const v of r.values) expect(reOf(v)).toBe(0);
      expect(residual(A, r)).toBeLessThan(1e-12);
      const w = eigvals(A);
      expect(w).toHaveLength(n);
      for (const v of w) expect(reOf(v)).toBe(0);
    });
  }

  it('handles zero blocks, nilpotent and rotation-plus-zero matrices', () => {
    const cases: number[][][] = [
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 5],
      ],
      blockDiag(zeros(2), [
        [1, 2],
        [3, 4],
      ]),
      [
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      [
        [0, -1, 0],
        [1, 0, 0],
        [0, 0, 0],
      ],
      // Sub-diagonal exactly eps * s: deflates under <= (was one more QR sweep under <).
      [
        [1, 0, 0],
        [2 ** -51, 1, 0],
        [0, 3, 2],
      ],
      blockDiag(
        [
          [1, 2],
          [3, 4],
        ],
        zeros(3)
      ),
    ];
    for (const A of cases) {
      const r = eig(A);
      expect(r.values).toHaveLength(A.length);
      const trace = A.reduce((t, row, i) => t + row[i], 0);
      expect(r.values.reduce((t: number, v) => t + reOf(v), 0)).toBeCloseTo(trace, 10);
      expect(allFinite(r)).toBe(true);
      expect(residual(A, r)).toBeLessThan(1e-12);
    }
  });
});
