import { describe, it, expect } from 'vitest';
// Issue #1180: the rank tolerance of the repeated-eigenvalue report was a fixed
// sqrt(eps) * ||A||_F. A defective block whose coupling lay below that size (but far above
// n * eps * ||A||_F) was reported as non-defective. The tolerance now follows the
// measured radius of the cluster, down to a floor of 8 * n * eps * ||A||_F.
import { eig } from '../src/index.js';

type M = number[][];

const jordan = (n: number, lambda: number, c: number): M =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? lambda : j === i + 1 ? c : 0))
  );
const mul = (A: M, B: M): M =>
  A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
// Inverse by Gauss-Jordan with partial pivoting (the test matrices are well conditioned).
const inverse = (S: M): M => {
  const n = S.length;
  const a = S.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    [a[i], a[p]] = [a[p], a[i]];
    const d = a[i][i];
    for (let j = 0; j < 2 * n; j++) a[i][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = a[r][i];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[i][j];
    }
  }
  return a.map((row) => row.slice(n));
};
const similar = (J: M, S: M): M => mul(mul(S, J), inverse(S));
const S3: M = [
  [1, 0.3, -0.2],
  [0.1, 1, 0.4],
  [-0.3, 0.2, 1],
];
const S5: M = [
  [1, 0.2, -0.1, 0.3, 0],
  [0.1, 1, 0.3, -0.2, 0.1],
  [-0.2, 0.1, 1, 0.2, 0.3],
  [0.3, -0.1, 0.2, 1, -0.2],
  [0, 0.2, -0.3, 0.1, 1],
];
const scaled = (A: M, s: number): M => A.map((r) => r.map((v) => v * s));

/** The report of the single repeated eigenvalue of `A`. */
function group(A: M) {
  const r = eig(A).repeatedEigenvalues;
  expect(r).toHaveLength(1);
  return r[0];
}
const shape = (A: M): [number, number] => {
  const g = group(A);
  return [g.independentEigenvectors, g.algebraicMultiplicity];
};

describe('eig repeated eigenvalue: coupling below sqrt(eps) * ||A|| (#1180)', () => {
  it.each([1e-3, 1e-6, 1e-9, 1e-12, 1e-13])('[[1,c],[0,1]], c = %s has 1 eigenvector', (c) => {
    expect(shape(jordan(2, 1, c))).toEqual([1, 2]);
  });

  it('does not pull in the 1e-9 coupling for the [[1,1e-9],[0,1]] example of the issue', () => {
    const g = group([
      [1, 1e-9],
      [0, 1],
    ]);
    expect(g.independentEigenvectors).toBe(1);
    expect(g.defective).toBe(true);
  });

  it('resolves down to 8 * n * eps * ||A||_F and not below', () => {
    // n = 2, ||A||_F = sqrt(3): the floor is about 6e-15.
    expect(shape(jordan(2, 1, 2e-14))).toEqual([1, 2]);
    expect(shape(jordan(2, 1, 1e-15))).toEqual([2, 2]);
    expect(shape(jordan(2, 1, 0))).toEqual([2, 2]);
  });

  it.each([1, 1e-3, 1e-6, 1e-9])('Jordan block of size 3, coupling %s, has 1 eigenvector', (c) => {
    expect(shape(jordan(3, 2, c))).toEqual([1, 3]);
  });

  it('keeps a size 4 Jordan block with O(1) coupling defective', () => {
    expect(shape(jordan(4, 1, 1))).toEqual([1, 4]);
  });

  it.each([1, 1e-6, 1e-9, 1e-10])('Jordan 2 + 1x1 block, coupling %s, has 2 eigenvectors', (c) => {
    expect(
      shape([
        [1, c, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toEqual([2, 3]);
  });

  it('keeps identity and repeated diagonal non-defective', () => {
    expect(shape(jordan(3, 5, 0))).toEqual([3, 3]);
    expect(shape(jordan(2, 1, 0))).toEqual([2, 2]);
    const g = eig([
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]).repeatedEigenvalues;
    expect(g).toHaveLength(1);
    expect(g[0].independentEigenvectors).toBe(2);
  });

  it.each([1e-150, 1e150])('is scale invariant (scale %s)', (s) => {
    expect(shape(scaled(jordan(2, 1, 1), s))).toEqual([1, 2]);
    expect(shape(scaled(jordan(2, 1, 1e-9), s))).toEqual([1, 2]);
    expect(shape(scaled(jordan(2, 1, 0), s))).toEqual([2, 2]);
  });

  it('counts a similarity-transformed non-defective eigenvalue as non-defective', () => {
    expect(shape(similar(jordan(3, 2, 0), S3))).toEqual([3, 3]);
    expect(shape(similar(jordan(5, 2, 0), S5))).toEqual([5, 5]);
  });

  it('counts a similarity-transformed Jordan block as defective', () => {
    expect(shape(similar(jordan(3, 2, 1), S3))).toEqual([1, 3]);
    expect(shape(similar(jordan(5, 2, 1), S5))).toEqual([1, 5]);
  });

  it.each([1e-6, 1e-9])('counts a similarity-transformed small coupling (%s)', (c) => {
    const J3 = jordan(3, 2, 0);
    J3[0][1] = c;
    expect(shape(similar(J3, S3))).toEqual([2, 3]);
    const J5 = jordan(5, 2, 0);
    J5[0][1] = c;
    expect(shape(similar(J5, S5))).toEqual([4, 5]);
  });
});
