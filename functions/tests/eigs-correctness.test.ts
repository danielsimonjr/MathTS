import { describe, it, expect } from 'vitest';
import { eigs } from '@danielsimonjr/mathts-functions';

/**
 * Regression: the mathjs factory `eigs` returned grossly wrong eigenvalues for
 * EVERY non-symmetric matrix — even upper-triangular ones, whose eigenvalues are
 * just the diagonal. e.g. [[2,1,0],[0,3,1],[0,0,4]] gave [1.27, 3, 4.73] instead of
 * [2,3,4]. The public `eigs` now routes numeric square matrices through the native
 * orthes/hqr2 solver (correct for symmetric/non-symmetric/complex). Reference
 * eigenvalues from numpy.linalg.eigvals.
 */
const reals = (vals: Array<number | { re: number; im: number }>) =>
  vals.map((v) => (typeof v === 'object' ? v.re : v)).sort((a, b) => a - b);

describe('eigs: correctness on non-symmetric matrices (regression)', () => {
  it('upper-triangular → diagonal eigenvalues', () => {
    expect(reals((eigs([[2, 1, 0], [0, 3, 1], [0, 0, 4]]) as { values: number[] }).values)).toEqual([
      2, 3, 4,
    ]);
    const g = reals((eigs([[1, 2, 3], [0, 4, 5], [0, 0, 6]]) as { values: number[] }).values);
    g.forEach((v, i) => expect(v).toBeCloseTo([1, 4, 6][i], 9));
  });

  it('companion matrix → polynomial roots', () => {
    // companion of x³−6x²+11x−6 = (x−1)(x−2)(x−3)
    const v = reals((eigs([[6, -11, 6], [1, 0, 0], [0, 1, 0]]) as { values: number[] }).values);
    v.forEach((x, i) => expect(x).toBeCloseTo([1, 2, 3][i], 8));
  });

  it('eigenvalue sum equals the trace (a similarity invariant)', () => {
    for (const A of [
      [[6, -11, 6], [1, 0, 0], [0, 1, 0]],
      [[4, 1, 2, 0], [0, 3, 1, 1], [0, 0, 2, 1], [0, 0, 0, 5]],
    ]) {
      const trace = A.reduce((s, r, i) => s + r[i], 0);
      const sum = (eigs(A) as { values: Array<number | { re: number; im: number }> }).values.reduce(
        (s, v) => s + (typeof v === 'object' ? v.re : v),
        0
      );
      expect(sum).toBeCloseTo(trace, 8);
    }
  });

  it('complex spectrum — rotation [[0,-1],[1,0]] → ±i', () => {
    const v = (eigs([[0, -1], [1, 0]]) as { values: Array<{ re: number; im: number }> }).values;
    const ims = v.map((z) => (typeof z === 'object' ? z.im : 0)).sort((a, b) => a - b);
    expect(ims[0]).toBeCloseTo(-1, 9);
    expect(ims[1]).toBeCloseTo(1, 9);
  });

  it('symmetric matrices remain correct (no regression)', () => {
    const v = reals((eigs([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]) as { values: number[] }).values);
    expect(v[0]).toBeCloseTo(2 - Math.SQRT2, 9);
    expect(v[1]).toBeCloseTo(2, 9);
    expect(v[2]).toBeCloseTo(2 + Math.SQRT2, 9);
  });

  it('eigenvectors satisfy A·v = λ·v for a real non-symmetric spectrum', () => {
    const A = [[2, 1, 0], [0, 3, 1], [0, 0, 4]];
    const { values, eigenvectors } = eigs(A) as {
      values: number[];
      eigenvectors: Array<{ value: number; vector: number[] }>;
    };
    expect(eigenvectors).toHaveLength(3);
    void values;
    for (const { value, vector } of eigenvectors) {
      for (let r = 0; r < 3; r++) {
        let Av = 0;
        for (let c = 0; c < 3; c++) Av += A[r][c] * vector[c];
        expect(Av).toBeCloseTo(value * vector[r], 7);
      }
    }
  });
});
