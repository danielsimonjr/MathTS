/**
 * Dogfood #1107 — `eig` at subnormal scale and its `maxIterations` option.
 *
 * - `repeatedEigenvalues` reports the same multiplicity at scale 2^-k as at scale 1.
 * - The eigenvectors of a matrix with subnormal entries are finite and unit length.
 * - `maxIterations` must be a positive integer.
 */

import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../src/index.js';

const jordan = (s: number): number[][] => [
  [s, s],
  [0, s],
];

describe('eig repeatedEigenvalues is scale invariant (#1107)', () => {
  for (const s of [1, 1e153, 1e-200, 1e-300]) {
    it(`reports one eigenvector for the Jordan block at scale ${s}`, () => {
      const r = eig(jordan(s)).repeatedEigenvalues;
      expect(r).toHaveLength(1);
      expect(r[0].algebraicMultiplicity).toBe(2);
      expect(r[0].independentEigenvectors).toBe(1);
      expect(r[0].defective).toBe(true);
      expect(eig(jordan(s)).isSymmetric).toBe(false);
      expect(Math.abs(r[0].value.re / s - 1)).toBeLessThan(1e-12);
    });
  }
  it('keeps a non-defective repeated eigenvalue at a tiny scale', () => {
    const r = eig([
      [1e-200, 0],
      [0, 1e-200],
    ]).repeatedEigenvalues;
    expect(r[0].independentEigenvectors).toBe(2);
    expect(r[0].defective).toBe(false);
  });
});

describe('eig eigenvectors for subnormal entries (#1107)', () => {
  it('returns finite unit eigenvectors', () => {
    const t = 4e-323;
    const A = [
      [1, t, 0],
      [t, 4, t],
      [0, t, 9],
    ];
    const r = eig(A);
    expect(r.values.map((v) => v.re).sort((a, b) => a - b)).toEqual([1, 4, 9]);
    for (let k = 0; k < 3; k++) {
      const v = r.vectors[k];
      expect(v.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...v)).toBeCloseTo(1, 12);
      // A v = lambda v up to the size of the subnormal coupling.
      const lam = r.values[k].re;
      for (let i = 0; i < 3; i++) {
        const av = A[i].reduce((s, a, j) => s + a * v[j], 0);
        expect(Math.abs(av - lam * v[i])).toBeLessThan(1e-300);
      }
    }
  });
});

describe('eig maxIterations validation (#1107)', () => {
  const I2 = [
    [2, 1],
    [1, 3],
  ];
  for (const bad of [NaN, null, 0, -1, 1.5, Infinity, '5']) {
    it(`rejects ${String(bad)}`, () => {
      const o = { maxIterations: bad } as unknown as { maxIterations: number };
      expect(() => eig(I2, o)).toThrow(RangeError);
      expect(() => eigvals(I2, o)).toThrow(/maxIterations must be a positive integer/);
    });
  }
  it('accepts undefined and a positive integer', () => {
    expect(eig(I2, { maxIterations: undefined }).values).toHaveLength(2);
    expect(eig(I2, { maxIterations: 50 }).values).toHaveLength(2);
  });
});
