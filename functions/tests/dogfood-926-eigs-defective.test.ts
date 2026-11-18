import { describe, it, expect } from 'vitest';
import { eig } from '@danielsimonjr/mathts-matrix';
import { eigs } from '../src/index.js';

function residual(A: number[][], value: unknown, v: number[]): number {
  const l = value as number;
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let s = 0;
    for (let j = 0; j < A.length; j++) s += A[i][j] * v[j];
    worst = Math.max(worst, Math.abs(s - l * v[i]));
  }
  return worst;
}

type R = { values: unknown[]; eigenvectors: { value: unknown; vector: number[] }[] };

describe('#926 eigs lists one eigenvector per independent direction', () => {
  it('returns one eigenvector for the defective eigenvalue 2', () => {
    const J = [
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const r = eigs(J) as R;
    expect(r.values).toHaveLength(3);
    expect(r.eigenvectors).toHaveLength(2);
    expect(r.eigenvectors.filter((p) => p.value === 2)).toHaveLength(1);
    for (const p of r.eigenvectors) expect(residual(J, p.value, p.vector)).toBeLessThan(1e-12);
  });

  it('keeps every eigenvector of a repeated eigenvalue that is not defective', () => {
    const r = eigs([
      [3, 0, 0],
      [0, 3, 0],
      [0, 0, 3],
    ]) as R;
    expect(r.eigenvectors).toHaveLength(3);
  });

  it('returns two of three for a partly defective eigenvalue', () => {
    const r = eigs([
      [2, 1, 0],
      [0, 2, 0],
      [0, 1, 2],
    ]) as R;
    expect(r.eigenvectors).toHaveLength(2);
  });

  it('returns one of three for a 3 x 3 Jordan block', () => {
    const r = eigs([
      [1, 2, 3],
      [0, 1, 4],
      [0, 0, 1],
    ]) as R;
    expect(r.eigenvectors).toHaveLength(1);
  });

  it('eig names the positions of the copies of the defective eigenvalue', () => {
    const g = eig([
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]).repeatedEigenvalues[0];
    expect(g.defective).toBe(true);
    expect(g.indices).toEqual([0, 1]);
  });
});

describe('#926 eigs and eig: groups, values and the vector option', () => {
  // diag(3, [[2,1],[0,2]], 3): eigenvalue 3 is repeated and not defective, 2 is defective.
  const D = [
    [3, 0, 0, 0],
    [0, 2, 1, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 3],
  ];

  it('eig gives the indices of each group when the copies are not adjacent', () => {
    const groups = eig(D).repeatedEigenvalues.map((g) => ({
      value: g.value.re,
      defective: g.defective,
      indices: g.indices,
    }));
    expect(groups).toEqual([
      { value: 3, defective: false, indices: [0, 3] },
      { value: 2, defective: true, indices: [1, 2] },
    ]);
  });

  it('eig gives the indices of each eigenvalue of a doubled complex pair', () => {
    const C = [
      [0, -1, 1, 0],
      [1, 0, 0, 1],
      [0, 0, 0, -1],
      [0, 0, 1, 0],
    ];
    const g = eig(C).repeatedEigenvalues;
    expect(g.map((x) => x.indices)).toEqual([
      [0, 2],
      [1, 3],
    ]);
    expect(g.every((x) => x.defective)).toBe(true);
  });

  it('keeps the vectors of the non-defective group and drops one of the defective group', () => {
    const r = eigs(D) as R;
    expect(r.values).toEqual([2, 2, 3, 3]);
    expect(r.eigenvectors.map((p) => p.value)).toEqual([2, 3, 3]);
    for (const p of r.eigenvectors) expect(residual(D, p.value, p.vector)).toBeLessThan(1e-12);
  });

  it('keeps all copies in values for a defective input', () => {
    const r = eigs([
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]) as R;
    expect(r.values).toEqual([2, 2, 3]);
  });

  it('returns only values when eigenvectors is false', () => {
    const r = eigs(
      [
        [2, 1, 0],
        [0, 2, 0],
        [0, 0, 3],
      ],
      { eigenvectors: false }
    ) as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(['values']);
    expect(r.values).toEqual([2, 2, 3]);
  });

  // The count of [[2s,s],[0,2s]] depends on the scale s (2 vectors at s = 2^-500, 1 at
  // s = 2^500). mathjs 15.2.0 does the same. The scale dependence is #1107.
  it.todo('[[2s,s],[0,2s]] gives one eigenvector at every scale s (#1107)');
});
