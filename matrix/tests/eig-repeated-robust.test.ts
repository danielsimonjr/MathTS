import { describe, it, expect } from 'vitest';
// Review contracts for eig().repeatedEigenvalues (issue #926): no false groups,
// order independence, lazy evaluation, symmetric input.
import { eig, eigvals } from '@danielsimonjr/mathts-matrix';

const diag = (d: number[]) => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));

describe('eig repeatedEigenvalues robustness', () => {
  it('does not group distinct close eigenvalues of a diagonal matrix', () => {
    expect(eig(diag([1, 1 + 1e-7])).repeatedEigenvalues).toEqual([]);
    expect(eig(diag([1e-8, 2e-8])).repeatedEigenvalues).toEqual([]);
  });

  it('does not report a complex pair with a small imaginary part as repeated', () => {
    expect(
      eig([
        [1, -1e-7],
        [1e-7, 1],
      ]).repeatedEigenvalues
    ).toEqual([]);
  });

  it('gives the same answer for any ordering of the diagonal', () => {
    const a = eig(diag([1, 1 + 0.9e-6, 1 + 1.8e-6])).repeatedEigenvalues;
    const b = eig(diag([1 + 0.9e-6, 1, 1 + 1.8e-6])).repeatedEigenvalues;
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  it('reports a symmetric repeated eigenvalue as non-defective', () => {
    const r = eig(diag([2, 2, 5])).repeatedEigenvalues;
    expect(r).toHaveLength(1);
    expect(r[0].independentEigenvectors).toBe(2);
    expect(r[0].defective).toBe(false);
  });

  it('detects a complex defective eigenvalue', () => {
    // Real Jordan-like block for the pair 1 +- i, each with algebraic multiplicity 2.
    const M = [
      [1, -1, 1, 0],
      [1, 1, 0, 1],
      [0, 0, 1, -1],
      [0, 0, 1, 1],
    ];
    const r = eig(M).repeatedEigenvalues;
    expect(r).toHaveLength(2);
    for (const g of r) {
      expect(g.algebraicMultiplicity).toBe(2);
      expect(g.independentEigenvectors).toBe(1);
      expect(g.defective).toBe(true);
    }
  });

  it('is computed on first access and cached', () => {
    const E = eig([
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    expect(E.repeatedEigenvalues).toBe(E.repeatedEigenvalues);
    expect(
      eigvals([
        [2, 1],
        [0, 2],
      ])
    ).toHaveLength(2);
  });
});
