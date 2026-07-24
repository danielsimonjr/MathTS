/**
 * Oracle regression: `eig` complex eigenvector exposure via `vectorsIm`.
 *
 * JAMA's hqr2 solver already computes complex eigenvectors internally (stored
 * in the real EISPACK-convention `V` matrix), but until now `eig.ts` dropped
 * them, emitting an all-zero column for every complex-conjugate eigenvalue
 * pair. `EigResult.vectorsIm` now carries the imaginary parts so the full
 * complex eigenvector `vectors[k] + i*vectorsIm[k]` is recoverable.
 *
 * Oracle strategy: eigenvectors are only defined up to a complex scalar, so
 * we NEVER compare vector components to a fixed reference. Instead we check
 * the implementation-independent residual `A v - lambda v ≈ 0` in complex
 * arithmetic, plus unit-norm and non-triviality of the complex part.
 *
 * Reference eigenvalue sets (closed-form / numpy-pinned):
 *   B = [[0,-1],[1,0]]                                    -> {i, -i}
 *   C = [[0,-1,0,0],[1,0,0,0],[0,0,3,-1],[0,0,1,3]]        -> {i, -i, 3+i, 3-i}
 */
import { describe, it, expect } from 'vitest';
import { eig } from '../src/operations/eig.js';

interface Cplx {
  re: number;
  im: number;
}

function cmul(a: Cplx, b: Cplx): Cplx {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function csub(a: Cplx, b: Cplx): Cplx {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cabs(a: Cplx): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

/** max_i |sum_j A[i][j] v_j - lambda v_i| for complex v = re + i*im. */
function complexResidual(
  A: number[][],
  lambda: { re: number; im: number },
  vre: number[],
  vim: number[]
): number {
  const n = A.length;
  let maxErr = 0;
  for (let i = 0; i < n; i++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let j = 0; j < n; j++) {
      sumRe += A[i][j] * vre[j];
      sumIm += A[i][j] * vim[j];
    }
    const Av: Cplx = { re: sumRe, im: sumIm };
    const lv: Cplx = cmul(lambda, { re: vre[i], im: vim[i] });
    const err = cabs(csub(Av, lv));
    if (err > maxErr) maxErr = err;
  }
  return maxErr;
}

function sortValues(values: Array<{ re: number; im: number }>): Array<{ re: number; im: number }> {
  return [...values].sort((a, b) => a.re - b.re || a.im - b.im);
}

describe('eig complex eigenvectors (vectorsIm) — oracle', () => {
  it('B = [[0,-1],[1,0]] has eigenvalues {i, -i} with correct complex residual', () => {
    const B = [
      [0, -1],
      [1, 0],
    ];
    const r = eig(B);

    const sorted = sortValues(r.values);
    expect(sorted[0].re).toBeCloseTo(0, 9);
    expect(sorted[0].im).toBeCloseTo(-1, 9);
    expect(sorted[1].re).toBeCloseTo(0, 9);
    expect(sorted[1].im).toBeCloseTo(1, 9);

    for (let k = 0; k < r.values.length; k++) {
      const lambda = r.values[k];
      const vre = r.vectors[k];
      const vim = r.vectorsIm[k];
      const res = complexResidual(B, lambda, vre, vim);
      expect(res).toBeLessThan(1e-9);

      if (Math.abs(lambda.im) > 1e-9) {
        // Unit-normalized complex column.
        let normSq = 0;
        for (let i = 0; i < vre.length; i++) normSq += vre[i] * vre[i] + vim[i] * vim[i];
        expect(Math.sqrt(normSq)).toBeCloseTo(1, 9);
        // Non-trivial imaginary part.
        const imMag = Math.sqrt(vim.reduce((s, x) => s + x * x, 0));
        expect(imMag).toBeGreaterThan(1e-6);
      }
    }
  });

  it('C = block-diag(rotation, 3+rotation) has eigenvalues {i,-i,3+i,3-i} with correct complex residual', () => {
    const C = [
      [0, -1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 3, -1],
      [0, 0, 1, 3],
    ];
    const r = eig(C);

    const sorted = sortValues(r.values);
    const expected = sortValues([
      { re: 0, im: 1 },
      { re: 0, im: -1 },
      { re: 3, im: 1 },
      { re: 3, im: -1 },
    ]);
    for (let i = 0; i < 4; i++) {
      expect(sorted[i].re).toBeCloseTo(expected[i].re, 9);
      expect(sorted[i].im).toBeCloseTo(expected[i].im, 9);
    }

    for (let k = 0; k < r.values.length; k++) {
      const lambda = r.values[k];
      const vre = r.vectors[k];
      const vim = r.vectorsIm[k];
      const res = complexResidual(C, lambda, vre, vim);
      expect(res).toBeLessThan(1e-9);

      if (Math.abs(lambda.im) > 1e-9) {
        let normSq = 0;
        for (let i = 0; i < vre.length; i++) normSq += vre[i] * vre[i] + vim[i] * vim[i];
        expect(Math.sqrt(normSq)).toBeCloseTo(1, 9);
        const imMag = Math.sqrt(vim.reduce((s, x) => s + x * x, 0));
        expect(imMag).toBeGreaterThan(1e-6);
      }
    }
  });

  it('symmetric matrix keeps real vectors + all-zero vectorsIm (back-compat)', () => {
    const S = [
      [2, 1],
      [1, 2],
    ];
    const r = eig(S);

    const sorted = sortValues(r.values);
    expect(sorted[0].re).toBeCloseTo(1, 9);
    expect(sorted[0].im).toBeCloseTo(0, 9);
    expect(sorted[1].re).toBeCloseTo(3, 9);
    expect(sorted[1].im).toBeCloseTo(0, 9);

    for (let k = 0; k < r.values.length; k++) {
      const lambda = r.values[k];
      const vre = r.vectors[k];
      const vim = r.vectorsIm[k];

      expect(vim.every((x) => Math.abs(x) < 1e-12)).toBe(true);

      const res = complexResidual(S, lambda, vre, vim);
      expect(res).toBeLessThan(1e-9);
    }
  });

  it('computeVectors: false returns an all-zero vectorsIm of matching shape', () => {
    const B = [
      [0, -1],
      [1, 0],
    ];
    const r = eig(B, { computeVectors: false });
    expect(r.vectorsIm).toHaveLength(2);
    for (const row of r.vectorsIm) {
      expect(row).toHaveLength(2);
      expect(row.every((x) => x === 0)).toBe(true);
    }
  });

  it('n=0 and n=1 special cases include vectorsIm', () => {
    const empty = eig([]);
    expect(empty.vectorsIm).toEqual([]);

    const one = eig([[5]]);
    expect(one.vectorsIm).toEqual([[0]]);
  });
});
