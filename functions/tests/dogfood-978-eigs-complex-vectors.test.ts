import { describe, it, expect } from 'vitest';
import { eigs } from '../src/index.js';

type C = { re: number; im: number };
const asC = (x: unknown): C =>
  typeof x === 'number' ? { re: x, im: 0 } : { re: (x as C).re, im: (x as C).im };

/** Largest entry of A v - lambda v. */
function residual(A: number[][], value: unknown, vector: unknown[]): number {
  const l = asC(value);
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
    worst = Math.max(
      worst,
      Math.hypot(re - (l.re * v.re - l.im * v.im), im - (l.re * v.im + l.im * v.re))
    );
  }
  return worst;
}

type Pairs = { eigenvectors: { value: unknown; vector: unknown[] }[] };

describe('#978 eigs eigenvectors of complex eigenvalues', () => {
  it('rotation matrix: Complex vectors with A v = lambda v', () => {
    const A = [
      [0, -1],
      [1, 0],
    ];
    const r = eigs(A) as Pairs;
    expect(r.eigenvectors).toHaveLength(2);
    for (const p of r.eigenvectors) {
      expect(residual(A, p.value, p.vector)).toBeLessThan(1e-14);
      expect(p.vector.some((x) => typeof x !== 'number' && (x as C).im !== 0)).toBe(true);
    }
  });

  it('4 x 4 with two complex pairs', () => {
    const A = [
      [0, -1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 3, -1],
      [0, 0, 1, 3],
    ];
    const r = eigs(A) as Pairs;
    expect(r.eigenvectors).toHaveLength(4);
    for (const p of r.eigenvectors) expect(residual(A, p.value, p.vector)).toBeLessThan(1e-13);
  });

  it('real eigenvalues keep plain number vectors', () => {
    const r = eigs([
      [2, 0],
      [0, 3],
    ]) as Pairs;
    for (const p of r.eigenvectors) for (const x of p.vector) expect(typeof x).toBe('number');
  });

  it('a defective complex pair (+-i doubled) lists one vector per direction', () => {
    const A = [
      [0, -1, 1, 0],
      [1, 0, 0, 1],
      [0, 0, 0, -1],
      [0, 0, 1, 0],
    ];
    const r = eigs(A) as Pairs;
    expect(r.eigenvectors).toHaveLength(2);
    for (const p of r.eigenvectors) expect(residual(A, p.value, p.vector)).toBeLessThan(1e-12);
  });
  it('mixed spectrum: every vector is Complex, as in mathjs', () => {
    const A = [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ];
    const r = eigs(A) as Pairs;
    expect(r.eigenvectors).toHaveLength(3);
    for (const p of r.eigenvectors) {
      expect(residual(A, p.value, p.vector)).toBeLessThan(1e-14);
      for (const x of p.vector) expect(typeof x).not.toBe('number');
    }
    const real = r.eigenvectors.find((p) => typeof p.value === 'number');
    expect(real?.value).toBe(1);
    for (const x of real!.vector) expect((x as C).im).toBe(0);
  });

  it('the vectors of a conjugate pair are conjugates', () => {
    const r = eigs([
      [1, -2, 0],
      [2, 1, 0],
      [0, 0, 5],
    ]) as Pairs;
    const cplx = r.eigenvectors.filter((p) => typeof p.value !== 'number');
    expect(cplx).toHaveLength(2);
    const [a, b] = cplx;
    expect(asC(a.value).im).toBeCloseTo(-asC(b.value).im, 14);
    for (let j = 0; j < 3; j++) {
      expect(asC(a.vector[j]).re).toBeCloseTo(asC(b.vector[j]).re, 14);
      expect(asC(a.vector[j]).im).toBeCloseTo(-asC(b.vector[j]).im, 14);
    }
  });
});
