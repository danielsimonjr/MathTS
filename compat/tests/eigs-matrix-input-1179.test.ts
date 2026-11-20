import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * Dogfood #1179: `eigs` of a Matrix runs the native solver. The compat instance delegates to the
 * functions `eigs`, so `math.eigs(math.matrix(A))` converges for a matrix with a complex pair
 * (it threw "failed to converge" for the matrix below) and returns Matrix values and vectors.
 */
const A = [
  [1.552, -1.952, 1.325, 4.959],
  [1.795, 1.731, -3.273, 3.832],
  [2.073, 3.275, 2.394, -1.623],
  [2.939, -3.078, 0.799, -2.662],
];

type Ri = { re: number; im: number };
const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re: number; im: number };
  return { re: o.re, im: o.im };
};

describe('compat eigs of a Matrix (#1179)', () => {
  const math = create(all) as unknown as {
    eigs(m: unknown): {
      values: { toArray(): unknown[] };
      eigenvectors: Array<{ value: unknown; vector: { toArray(): unknown[] } }>;
    };
    matrix(a: unknown): unknown;
    evaluate(e: string, scope?: Record<string, unknown>): unknown;
  };

  it('converges for the matrix with a complex pair and gives small residuals', () => {
    const r = math.eigs(math.matrix(A));
    expect(r.values.toArray()).toHaveLength(4);
    expect(r.eigenvectors).toHaveLength(4);
    for (const { value, vector } of r.eigenvectors) {
      const l = toRi(value);
      const v = vector.toArray().map(toRi);
      let worst = 0;
      for (let i = 0; i < 4; i++) {
        let re = 0;
        let im = 0;
        for (let j = 0; j < 4; j++) {
          re += A[i][j] * v[j].re;
          im += A[i][j] * v[j].im;
        }
        re -= l.re * v[i].re - l.im * v[i].im;
        im -= l.re * v[i].im + l.im * v[i].re;
        worst = Math.max(worst, Math.hypot(re, im));
      }
      expect(worst).toBeLessThan(1e-12);
    }
  });

  it('evaluate("eigs(A)") reaches the same solver', () => {
    const r = math.evaluate('eigs(A)', { A: math.matrix(A) }) as {
      values: { toArray(): unknown[] };
    };
    const values = r.values.toArray().map(toRi);
    expect(values.some((v) => Math.abs(v.im - 5.0001436666267844) < 1e-12)).toBe(true);
  });
});
