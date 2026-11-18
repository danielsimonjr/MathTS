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

  it.each([1e-150, 1e-20, 1, 1e20])(
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
