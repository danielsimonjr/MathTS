import { describe, it, expect } from 'vitest';
import { rationalNullspace } from '../src/index.js';

const bigintA = [
  [1n, 0n, 0n, 0n, 0n, 0n, 0n],
  [0n, 1n, 0n, 0n, 0n, 0n, 0n],
];
const numberA = [
  [1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
];

describe('D4 rationalNullspace bigint cells', () => {
  it('accepts a 7-column bigint matrix', () => {
    const { basis } = rationalNullspace(bigintA);
    expect(basis.length).toBeGreaterThanOrEqual(5);
    for (const vec of basis) {
      for (const cell of vec) expect(cell.denominator).toBe(1n);
    }
  });
  it('matches the integer number[][] basis strings', () => {
    const b = rationalNullspace(bigintA).basis.map((row) => row.map((c) => c.toString()).join(','));
    const n = rationalNullspace(numberA).basis.map((row) => row.map((c) => c.toString()).join(','));
    expect(b).toEqual(n);
  });
  it('mixes bigint and non-integer number cells like Fraction cells', () => {
    const b = rationalNullspace([[1n, 2.5]]).basis.map((row) =>
      row.map((c) => c.toString()).join(',')
    );
    const n = rationalNullspace([[1, 2.5]]).basis.map((row) =>
      row.map((c) => c.toString()).join(',')
    );
    expect(b).toEqual(n);
  });
});
