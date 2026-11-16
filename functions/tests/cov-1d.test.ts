import { describe, it, expect } from 'vitest';
import { cov } from '@danielsimonjr/mathts-functions';
import { Complex } from '@danielsimonjr/mathts-core';

// Oracle: NumPy 2.3.4. np.cov([1, 2, 3, 4]) = 1.6666666666666665 (one variable, ddof=1).
// np.cov(x, y) is a 2x2 matrix; MathTS cov(x, y) is its [0, 1] entry.

describe('cov of a 1-D array (#980)', () => {
  it('cov([1,2,3,4]) is the sample variance, not []', () => {
    expect(cov([1, 2, 3, 4])).toBe(1.6666666666666665);
  });

  it('cov(Float64Array) of a 1-D array is the sample variance', () => {
    expect(cov(new Float64Array([1, 2, 3, 4]))).toBe(1.6666666666666665);
  });

  it('cov(x, y) of two 1-D vectors is the np.cov(x, y)[0, 1] entry', () => {
    expect(cov([1, 2, 3, 4], [2, 4, 6, 8])).toBe(3.333333333333333);
  });

  it('ddof and rowvar follow np.cov for a 1-D array', () => {
    expect(cov([1, 2, 3, 4], undefined, 0)).toBe(1.25); // np.cov(x, ddof=0)
    expect(cov([5], undefined, 0)).toBe(0); // np.cov([5], ddof=0)
    // np.cov ignores rowvar for a 1-D array
    expect(cov([1, 2, 3, 4], undefined, 1, { rowvar: true })).toBe(1.6666666666666665);
    expect(cov([1, 2, 3, 4], undefined, 1, { rowvar: false })).toBe(1.6666666666666665);
  });

  it('a one-column matrix gives the same value as the 1-D array', () => {
    expect((cov([[1], [2], [3], [4]]) as number[][])[0][0]).toBe(1.6666666666666665);
  });

  it('a mixed flat array throws the number-data TypeError', () => {
    expect(() => cov([1, [2]] as never)).toThrow(TypeError);
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
