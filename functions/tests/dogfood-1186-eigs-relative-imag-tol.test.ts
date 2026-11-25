import { describe, it, expect } from 'vitest';
import { eigs } from '../src/index.js';

type C = { re: number; im: number };
const asC = (x: unknown): C =>
  typeof x === 'number' ? { re: x, im: 0 } : { re: (x as C).re, im: (x as C).im };

/** Largest entry of A v - lambda v, divided by max|A| (a scale-free residual). */
function relResidual(A: number[][], value: unknown, vector: unknown[]): number {
  const l = asC(value);
  const scale = Math.max(...A.flat().map(Math.abs));
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < A.length; j++) {
      const v = asC(vector[j]);
      re += A[i][j] * v.re;
      im += A[i][j] * v.im;
    }
    const v = asC(vector[i]);
    re -= l.re * v.re - l.im * v.im;
    im -= l.re * v.im + l.im * v.re;
    worst = Math.max(worst, Math.hypot(re, im));
  }
  return worst / scale;
}

const eigsOf = (A: number[][]) =>
  eigs(A) as unknown as {
    values: unknown[];
    eigenvectors: { value: unknown; vector: unknown[] }[];
  };

describe('eigs keeps a complex pair at every matrix scale (#1186)', () => {
  const scales = [1e-300, 1e-150, 1e-100, 1e-50, 1e-20, 1e-12, 1, 1e12, 1e50, 1e150, 1e300];

  it.each(scales)('rotation at scale %s keeps the pair +-s i', (s) => {
    const A = [
      [0, -s],
      [s, 0],
    ];
    const r = eigsOf(A);
    const im = r.values.map((v) => asC(v).im).sort((p, q) => p - q);
    expect(r.values.map((v) => asC(v).re)).toEqual([0, 0]);
    expect(im[0] / s).toBeCloseTo(-1, 12);
    expect(im[1] / s).toBeCloseTo(1, 12);
    for (const p of r.eigenvectors) expect(relResidual(A, p.value, p.vector)).toBeLessThan(1e-12);
  });

  it.each([1e-150, 1e-20, 1, 1e20, 1e150])(
    'a pair with a real eigenvalue at scale %s keeps both kinds',
    (s) => {
      const A = [
        [0, -s, 0],
        [s, 0, 0],
        [0, 0, 2 * s],
      ];
      const r = eigsOf(A);
      expect(r.values.filter((v) => typeof v === 'number')).toEqual([2 * s]);
      expect(r.values.filter((v) => typeof v !== 'number')).toHaveLength(2);
      for (const p of r.eigenvectors) expect(relResidual(A, p.value, p.vector)).toBeLessThan(1e-12);
    }
  );

  it.each([1e-150, 1, 1e20])(
    'a near-real pair (relative imaginary part 1e-8) at scale %s stays complex',
    (s) => {
      const A = [
        [s, -1e-8 * s],
        [1e-8 * s, s],
      ];
      const r = eigsOf(A);
      for (const v of r.values) {
        expect(typeof v).not.toBe('number');
        expect(Math.abs(asC(v).im) / s).toBeCloseTo(1e-8, 6);
      }
    }
  );

  it('a near-real pair (relative imaginary part 1e-8) at scale 1e-20 (#1561)', () => {
    // #1561 removed the native solver, whose balanced solve kept this pair
    // complex at the 1e-20 scale. The mathjs factory iteration — the public
    // `eigs` since #1561, and the mathjs 15.3.0 oracle alike — rounds the pair
    // to the repeated real value 1e-20 there; the same pair stays complex at
    // the scales above. The assertion pins the factory (and oracle) behavior.
    const s = 1e-20;
    const A = [
      [s, -1e-8 * s],
      [1e-8 * s, s],
    ];
    const r = eigsOf(A);
    expect(r.values.map((v) => asC(v).re)).toEqual([s, s]);
  });

  it.each([1e-150, 1e-20, 1, 1e20, 1e150])('a defective real block at scale %s stays real', (s) => {
    const A = [
      [s, s],
      [0, s],
    ];
    const r = eigsOf(A);
    expect(r.values).toEqual([s, s]);
  });

  it.each([1e-20, 1, 1e8, 1e20])('a real non-symmetric matrix at scale %s stays real', (s) => {
    const A = [
      [1 * s, 2 * s],
      [3 * s, 4 * s],
    ];
    const r = eigsOf(A);
    for (const v of r.values) expect(typeof v).toBe('number');
  });

  it('the zero matrix has the real eigenvalue 0', () => {
    expect(
      eigsOf([
        [0, 0],
        [0, 0],
      ]).values
    ).toEqual([0, 0]);
  });
});

/** Rank of a list of complex vectors (Gram-Schmidt with a 1e-6 cut). */
function rank(vectors: unknown[][]): number {
  const basis: C[][] = [];
  for (const v of vectors) {
    let r = v.map(asC);
    for (const q of basis) {
      let pr = 0;
      let pi = 0;
      for (let j = 0; j < r.length; j++) {
        pr += q[j].re * r[j].re + q[j].im * r[j].im;
        pi += q[j].re * r[j].im - q[j].im * r[j].re;
      }
      r = r.map((x, j) => ({
        re: x.re - (pr * q[j].re - pi * q[j].im),
        im: x.im - (pr * q[j].im + pi * q[j].re),
      }));
    }
    const norm = Math.hypot(...r.flatMap((x) => [x.re, x.im]));
    if (norm > 1e-6) basis.push(r.map((x) => ({ re: x.re / norm, im: x.im / norm })));
  }
  return basis.length;
}

describe('eigs keeps a genuine near-real pair and rounds only rounding noise (#1186)', () => {
  it.each([1, 1e6, 1e300])('a pair with relative im 1e-12 at scale %s stays complex', (s) => {
    const A = [
      [s, -1e-12 * s],
      [1e-12 * s, s],
    ];
    const r = eigsOf(A);
    for (const v of r.values) {
      expect(typeof v).not.toBe('number');
      expect(Math.abs(asC(v).im) / s).toBeCloseTo(1e-12, 18);
    }
    expect(rank(r.eigenvectors.map((p) => p.vector))).toBe(2);
    for (const p of r.eigenvectors) expect(relResidual(A, p.value, p.vector)).toBeLessThan(1e-14);
  });

  it('[[1, -1e-12], [1e-12, 1]] returns 1 - 1e-12i and 1 + 1e-12i, as NumPy does', () => {
    const r = eigsOf([
      [1, -1e-12],
      [1e-12, 1],
    ]);
    // #1561: the pair comes from the factory's 2x2 solve, whose members are
    // [tr/2 + sqrt/2, tr/2 - sqrt/2] — the +i member first, as in mathjs. The
    // former native order (the -i member first) belonged to the removed
    // bypass.
    expect(r.values.map(asC)).toEqual([
      { re: 1, im: 1e-12 },
      { re: 1, im: -1e-12 },
    ]);
  });

  it('a similarity-transformed Jordan block that splits into a pair (#1561)', () => {
    // P * [[1, 1], [0, 1]] * inv(P): an ill-conditioned double eigenvalue whose
    // true spectrum is 1 +- 2.1e-8i. The native solver split it; the mathjs
    // factory iteration — the public `eigs` since #1561, and the mathjs 15.3.0
    // oracle alike — rounds it to the repeated real value 1. The eigenvalue
    // stays 1 and the eigenvector keeps a small residual.
    const A = [
      [2.3013132018361397, -1.2122386417804276],
      [1.3969329065322387, -0.30131320183613985],
    ];
    const r = eigsOf(A);
    for (const v of r.values) {
      expect(asC(v).re).toBeCloseTo(1, 12);
    }
    for (const p of r.eigenvectors) expect(relResidual(A, p.value, p.vector)).toBeLessThan(1e-9);
  });

  it('a repeated real eigenvalue whose copies come out as a noise pair is real, with independent vectors', () => {
    // P * diag(1, 1, 2) * inv(P): the solver returns 1 +- 2.0e-15i for the double eigenvalue.
    const A = [
      [4.666666666666669, -5.166666666666669, 3.166666666666668],
      [4.88888888888889, -5.88888888888889, 4.222222222222223],
      [4.888888888888891, -6.888888888888891, 5.222222222222223],
    ];
    const r = eigsOf(A);
    for (const v of r.values) expect(typeof v).toBe('number');
    // #1561: the third eigenvalue carries the factory's shifted-QR rounding
    // (measured 2.000000000000003); the native bypass returned an exact 2.
    expect(r.values as number[]).toEqual([
      expect.closeTo(1, 12),
      expect.closeTo(1, 12),
      expect.closeTo(2, 12),
    ]);
    expect((eigs(A, { eigenvectors: false }) as { values: unknown[] }).values).toEqual(r.values);
    expect(rank(r.eigenvectors.map((p) => p.vector))).toBe(3);
    for (const p of r.eigenvectors) expect(relResidual(A, p.value, p.vector)).toBeLessThan(1e-14);
  });
});
