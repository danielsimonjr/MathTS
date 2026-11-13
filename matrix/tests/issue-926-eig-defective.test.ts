import { describe, it, expect } from 'vitest';
// Issue #926: eig must report defectiveness of repeated eigenvalues. Imported by
// package name, so the test runs against the built dist.
import { eig, eigvals } from '@danielsimonjr/mathts-matrix';

describe('issue #926: eig reports the independent eigenvectors of repeated eigenvalues', () => {
  it('reports the defective Jordan block: lambda=2 has 1 independent eigenvector', () => {
    const J = [
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const E = eig(J);
    const lambda2 = E.repeatedEigenvalues.find((r) => Math.abs(r.value.re - 2) < 1e-8);
    expect(lambda2).toBeDefined();
    expect(lambda2!.algebraicMultiplicity).toBe(2);
    expect(lambda2!.independentEigenvectors).toBe(1);
    expect(lambda2!.defective).toBe(true);
    // lambda=3 is simple, so it is not reported as repeated.
    expect(E.repeatedEigenvalues.some((r) => Math.abs(r.value.re - 3) < 1e-8)).toBe(false);
  });

  it('reports the identity as repeated but not defective (full rank)', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const E = eig(I);
    expect(E.repeatedEigenvalues).toHaveLength(1);
    const one = E.repeatedEigenvalues[0];
    expect(one.value.re).toBeCloseTo(1, 12);
    expect(one.algebraicMultiplicity).toBe(3);
    expect(one.independentEigenvectors).toBe(3);
    expect(one.defective).toBe(false);
  });

  it('reports nothing for a matrix with distinct eigenvalues', () => {
    const E = eig([
      [1, 2],
      [3, 4],
    ]);
    expect(E.repeatedEigenvalues).toEqual([]);
  });

  it('keeps the vectors field unchanged for the defective block', () => {
    const J = [
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const E = eig(J);
    expect(E.vectors).toHaveLength(3);
    expect(E.vectors[0]).toHaveLength(3);
  });

  it('keeps eigvals working and returns the field on a size-1 matrix', () => {
    expect(eigvals([[5]])).toEqual([{ re: 5, im: 0 }]);
    expect(eig([[5]]).repeatedEigenvalues).toEqual([]);
  });
});
