import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { nullspace, rationalNullspace } from '../src/typed/numeric.js';

function ints(vector: Fraction[]): number[] {
  return vector.map((f) => {
    expect(f.denominator).toBe(1n);
    return Number(f.numerator);
  });
}

/** Exact matrix-vector product over Fraction. */
function apply(
  matrix: ReadonlyArray<ReadonlyArray<number | Fraction>>,
  vector: Fraction[]
): Fraction[] {
  return matrix.map((row) =>
    row.reduce(
      (sum: Fraction, entry, j) => {
        const coeff = entry instanceof Fraction ? entry : new Fraction(entry);
        return sum.add(coeff.mul(vector[j]));
      },
      new Fraction(0n, 1n)
    )
  );
}

describe('rationalNullspace', () => {
  it('returns an integer basis for the rank-1 row [1, 2]', () => {
    const { basis, rank } = rationalNullspace([
      [1, 2],
      [2, 4],
    ]);
    expect(rank).toBe(1);
    expect(basis).toHaveLength(1);
    // First nonzero entry is positive. Numeric nullspace keeps the free variable at +1,
    // which is the opposite orientation of this same line.
    expect(ints(basis[0])).toEqual([2, -1]);
    const numeric = nullspace([
      [1, 2],
      [2, 4],
    ]);
    expect(numeric).toHaveLength(1);
    expect(numeric[0][0]).toBeCloseTo(-2);
    expect(numeric[0][1]).toBeCloseTo(1);
  });

  it('returns no vectors for a full-rank matrix', () => {
    const { basis, rank } = rationalNullspace([
      [1, 0],
      [0, 1],
    ]);
    expect(rank).toBe(2);
    expect(basis).toEqual([]);
  });

  it('returns the coordinate basis of a zero matrix', () => {
    const { basis, rank } = rationalNullspace([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(rank).toBe(0);
    expect(basis.map(ints)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('matches the pendulum π-group T² · g / L', () => {
    // Columns: period (T), length (L), gravity (L T⁻²). Rows: L, T.
    const { basis, rank } = rationalNullspace([
      [0, 1, 1],
      [1, 0, -2],
    ]);
    expect(rank).toBe(2);
    expect(basis).toHaveLength(1);
    expect(ints(basis[0])).toEqual([2, -1, 1]);
    for (const product of apply(
      [
        [0, 1, 1],
        [1, 0, -2],
      ],
      basis[0]
    )) {
      expect(product.numerator).toBe(0n);
    }
  });

  it('matches the Schwarzschild π-group r · c² / (G M)', () => {
    // Columns: radius (L), mass (M), G (L³ M⁻¹ T⁻²), c (L T⁻¹). Rows: L, M, T.
    const matrix = [
      [1, 0, 3, 1],
      [0, 1, -1, 0],
      [0, 0, -2, -1],
    ];
    const { basis, rank } = rationalNullspace(matrix);
    expect(rank).toBe(3);
    expect(ints(basis[0])).toEqual([1, -1, -1, 2]);
    for (const product of apply(matrix, basis[0])) {
      expect(product.numerator).toBe(0n);
    }
  });

  it('keeps a one-third exponent exact', () => {
    const third = new Fraction(1n, 3n);
    const matrix = [
      [new Fraction(1n, 1n), third],
      [new Fraction(3n, 1n), new Fraction(1n, 1n)],
    ];
    const { basis, rank } = rationalNullspace(matrix);
    expect(rank).toBe(1);
    expect(ints(basis[0])).toEqual([1, -3]);
    for (const product of apply(matrix, basis[0])) {
      expect(product.numerator).toBe(0n);
    }
  });

  it('accepts a half that is written as a decimal', () => {
    const { basis, rank } = rationalNullspace([[0.5, 1]]);
    expect(rank).toBe(1);
    expect(ints(basis[0])).toEqual([2, -1]);
  });

  it('reports two groups when the nullity is two', () => {
    // Columns: length, time, velocity (L/T), a dimensionless ratio.
    // Rows: L, T. Rank 2, nullity 2.
    const { basis, rank } = rationalNullspace([
      [1, 0, 1, 0],
      [0, 1, -1, 0],
    ]);
    expect(rank).toBe(2);
    expect(basis.map(ints)).toEqual([
      [1, -1, -1, 0],
      [0, 0, 0, 1],
    ]);
  });

  it('returns an empty result for an empty matrix', () => {
    expect(rationalNullspace([])).toEqual({ basis: [], rank: 0 });
  });

  it('rejects a jagged matrix and a non-finite entry', () => {
    expect(() => rationalNullspace([[1, 2], [3]])).toThrow(/row 1/);
    expect(() => rationalNullspace([[Number.NaN]])).toThrow(/finite number/);
  });
});
