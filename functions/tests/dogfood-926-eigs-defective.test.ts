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
