import { describe, it, expect } from 'vitest';
import { cov } from '@danielsimonjr/mathts-functions';
import { Complex } from '@danielsimonjr/mathts-core';

// Oracle: numpy.cov([1, 2, 3, 4]) = 1.6666666666666665 (one variable, ddof=1).
// cov([1,2,3,4], [2,4,6,8]) = 10/3 (two 1-D vectors, unchanged path).

describe('cov of a 1-D array (#980)', () => {
  it('cov([1,2,3,4]) is the sample variance, not []', () => {
    expect(cov([1, 2, 3, 4]) as number).toBeCloseTo(1.6666666666666665, 15);
  });

  it('cov(Float64Array) of a 1-D array is the sample variance', () => {
    expect(cov(new Float64Array([1, 2, 3, 4])) as number).toBeCloseTo(1.6666666666666665, 15);
  });

  it('cov(x, y) of two 1-D vectors is unchanged', () => {
    expect(cov([1, 2, 3, 4], [2, 4, 6, 8]) as number).toBeCloseTo(10 / 3, 15);
  });

  it('cov of an empty 1-D array still throws the ddof error', () => {
    expect(() => cov([])).toThrow(/ddof|observations/i);
  });

  it('cov of a single 1-D value still throws the ddof error', () => {
    expect(() => cov([5])).toThrow(/ddof|observations/i);
  });

  it('cov of a 1-D array of Complex throws the number-data TypeError', () => {
    expect(() => cov([new Complex(1, 0), new Complex(2, 0), new Complex(3, 0)] as never[])).toThrow(
      /expects number data/
    );
  });

  it('a matrix with Float64Array rows stays a matrix and equals the plain-array result', () => {
    const typed = [new Float64Array([1, 2]), new Float64Array([3, 5]), new Float64Array([5, 7])];
    const plain = [
      [1, 2],
      [3, 5],
      [5, 7],
    ];
    const c = cov(typed as unknown as number[][]) as number[][];
    expect(Array.isArray(c[0])).toBe(true);
    expect(c).toEqual(cov(plain));
  });
});
