import { describe, it, expect } from 'vitest';
// Issues #976 and #1003: the items that main already fixed before batch C2 are pinned here, so a
// later change cannot bring them back. Each pin names the fact in its title.
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { det, eigs, inv, lusolve, matrix as fmatrix } from '../src/index.js';

type Nested = number[][];

const A: Nested = [
  [1, 2],
  [3, 4],
];

function expectClose(actual: Nested, expected: Nested, tolerance = 1e-12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[i].length; j++) {
      expect(Math.abs(actual[i][j] - expected[i][j])).toBeLessThan(tolerance);
    }
  }
}

interface EigsResult {
  values: { toArray(): number[] };
  eigenvectors: Array<{ value: number; vector: { toArray(): number[] } }>;
}

describe('issue #976: det pins', () => {
  it('det of a native DenseMatrix is -2 // pin: fixed on main before C2', () => {
    expect(det(new DenseMatrix(A))).toBeCloseTo(-2, 12);
  });

  it('det of a MathJS matrix is -2 // pin: fixed on main before C2', () => {
    expect(det(fmatrix(A))).toBeCloseTo(-2, 12);
  });

  it('det of a number is the number', () => {
    expect(det(5 as never)).toBe(5);
  });

  it('det of a string returns the string, as mathjs 15.2.0 does (parity ruling)', () => {
    expect(det('abc' as never)).toBe('abc');
  });
});

describe('issue #1003: functions that accept a native DenseMatrix', () => {
  it('inv of a native DenseMatrix // pin: fixed on main before C2', () => {
    const r = inv(new DenseMatrix(A)) as { toArray(): Nested };
    expectClose(r.toArray(), [
      [-2, 1],
      [1.5, -0.5],
    ]);
  });

  it('lusolve of a native DenseMatrix // pin: fixed on main before C2', () => {
    const r = lusolve(new DenseMatrix(A), [5, 11]) as { toArray(): Nested };
    expectClose(r.toArray(), [[1], [2]]);
  });

  it('eigs of a native DenseMatrix // pin: fixed on main before C2 (batch A)', () => {
    // characteristic polynomial x^2 - 5x - 2, so the eigenvalues are (5 -+ sqrt(33)) / 2
    const lo = (5 - Math.sqrt(33)) / 2;
    const hi = (5 + Math.sqrt(33)) / 2;
    const r = eigs(new DenseMatrix(A)) as unknown as EigsResult;
    const values = r.values.toArray();
    expect(Math.abs(values[0] - lo)).toBeLessThan(1e-12);
    expect(Math.abs(values[1] - hi)).toBeLessThan(1e-12);
    expect(r.eigenvectors.length).toBe(2);
    for (const { value, vector } of r.eigenvectors) {
      const v = vector.toArray();
      expect(Math.abs(Math.hypot(v[0], v[1]) - 1)).toBeLessThan(1e-12);
      // A v = value v
      for (let i = 0; i < 2; i++) {
        const row = A[i][0] * v[0] + A[i][1] * v[1];
        expect(Math.abs(row - value * v[i])).toBeLessThan(1e-12);
      }
    }
  });
});
