/**
 * Dogfood #1240 - eigs keeps a complex pair beside a huge entry.
 *
 * Two causes, in two packages:
 *   - matrix `eig`: the hqr2 deflation test used the norm of the whole matrix as its scale when
 *     both diagonal entries beside a coupling were zero, so the coupling 1 of [[0,1],[-1,0]]
 *     beside 1e16 read as zero (tests in `matrix/tests/eig-zero-diagonal-deflation.test.ts`).
 *   - functions `eigs`: the tolerance that decides whether an eigenvalue is real (`im` is rounding
 *     noise) was relative to the largest entry of the whole matrix, so `1e-5 +- i` beside 1e20 was
 *     read as real. The tolerance is now relative to the entries of the rows whose Gershgorin disc
 *     holds the eigenvalue.
 */
import { describe, it, expect } from 'vitest';
import { eigs } from '../src/index.js';

type Ri = { re: number; im: number };

const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re?: unknown; im?: unknown };
  if (typeof o.re === 'number' && typeof o.im === 'number') return { re: o.re, im: o.im };
  return { re: Number(x), im: 0 };
};
const byValue = (p: Ri, q: Ri): number => p.re - q.re || p.im - q.im;

type EigResult = {
  values: unknown[];
  eigenvectors: Array<{ value: unknown; vector: unknown[] }>;
};
const run = (A: number[][]): EigResult => eigs(A as never) as unknown as EigResult;

/** The values, sorted by real part and then imaginary part. */
const sortedValues = (A: number[][]): Ri[] => run(A).values.map(toRi).sort(byValue);

/** |A v - l v| / (scale |v|) with the scale given, for a vector of numbers or Complex values. */
function residual(A: number[][], l: unknown, v: unknown[], scale: number): number {
  const lam = toRi(l);
  const vec = v.map(toRi);
  const vnorm = Math.hypot(...vec.map((z) => Math.hypot(z.re, z.im)));
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let ar = 0;
    let ai = 0;
    for (let j = 0; j < A.length; j++) {
      ar += A[i][j] * vec[j].re;
      ai += A[i][j] * vec[j].im;
    }
    const er = ar - (lam.re * vec[i].re - lam.im * vec[i].im);
    const ei = ai - (lam.re * vec[i].im + lam.im * vec[i].re);
    worst = Math.max(worst, Math.hypot(er, ei));
  }
  return worst / (scale * vnorm);
}

const near = (z: Ri, w: Ri, tol: number): boolean => Math.hypot(z.re - w.re, z.im - w.im) <= tol;

describe('eigs keeps a complex pair beside a huge entry (#1240)', () => {
  for (const s of [1e16, 1e20]) {
    it(`[[${s},0,0],[0,1e-5,1],[0,-1,1e-5]] gives 1e-5 +- i and ${s}`, () => {
      const A = [
        [s, 0, 0],
        [0, 1e-5, 1],
        [0, -1, 1e-5],
      ];
      const [a, b, c] = sortedValues(A);
      expect(near(a, { re: 1e-5, im: -1 }, 1e-14)).toBe(true);
      expect(near(b, { re: 1e-5, im: 1 }, 1e-14)).toBe(true);
      expect(c).toEqual({ re: s, im: 0 });
      // the eigenvectors of the pair, with the residual relative to the block (scale 1)
      for (const { value, vector } of run(A).eigenvectors) {
        if (Math.abs(toRi(value).re) < 1) {
          expect(residual(A, value, vector, 1)).toBeLessThan(1e-14);
        }
      }
    });

    it(`[[${s},0,0],[0,0,1],[0,-1,0]] gives +-i and ${s}`, () => {
      const A = [
        [s, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
      ];
      const [a, b, c] = sortedValues(A);
      expect(near(a, { re: 0, im: -1 }, 1e-14)).toBe(true);
      expect(near(b, { re: 0, im: 1 }, 1e-14)).toBe(true);
      expect(c).toEqual({ re: s, im: 0 });
      for (const { value, vector } of run(A).eigenvectors) {
        if (Math.abs(toRi(value).re) < 1) {
          expect(residual(A, value, vector, 1)).toBeLessThan(1e-14);
        }
      }
    });
  }

  it('the pair keeps its place when the huge entry is not on the diagonal block', () => {
    // a huge entry in the first row does not make the pair of the lower block real
    const A = [
      [1e20, 1e10, 1e10],
      [0, 0, 1],
      [0, -1, 0],
    ];
    const [a, b] = sortedValues(A);
    expect(near(a, { re: 0, im: -1 }, 1e-14)).toBe(true);
    expect(near(b, { re: 0, im: 1 }, 1e-14)).toBe(true);
  });

  it('a defective block beside a huge row gives the values of the block alone', () => {
    // J3 has a triple eigenvalue 2 with one eigenvector: an ill-conditioned triple root, so the
    // values are 1.99996 and 2.00002 +- 3.8e-5i (as in NumPy). A tolerance relative to the
    // whole matrix read that pair as real; the same block must not change with a huge row above it.
    const J3 = [
      [12, -7, -2],
      [-5, 6, 1],
      [70, -51, -12],
    ];
    const A = [[1e20, 1e10, 1e10, 1e10], ...J3.map((row) => [0, ...row])];
    const alone = sortedValues(J3);
    const beside = sortedValues(A).slice(0, 3);
    expect(alone.some((z) => z.im !== 0)).toBe(true);
    beside.forEach((z, i) => {
      expect(near(z, alone[i], 1e-9)).toBe(true);
    });
    expect(sortedValues(A)[3]).toEqual({ re: 1e20, im: 0 });
  });
});
