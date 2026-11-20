/**
 * #1013: `matrix([1, 2])` threw in the matrix package.
 *
 * mathjs accepts a 1-D array and gives a vector of size [2]. A native DenseMatrix has only
 * `rows` and `cols`, so a 1-D array gives a 1 x n row matrix (the orientation that matches
 * mathjs broadcasting of `add(matrix([1, 2]), [[1, 2], [3, 4]])`).
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { matrix } from '../src/typed-operations.js';

describe('#1013 a 1-D array gives a 1 x n row DenseMatrix', () => {
  it('matrix([1, 2]) is a 1 x 2 row', () => {
    const m = matrix([1, 2]) as DenseMatrix;
    expect(m).toBeInstanceOf(DenseMatrix);
    expect(m.rows).toBe(1);
    expect(m.cols).toBe(2);
    expect(m.toArray()).toEqual([[1, 2]]);
  });

  it('DenseMatrix.fromArray([1, 2, 3]) is a 1 x 3 row', () => {
    const m = DenseMatrix.fromArray([1, 2, 3]);
    expect(m.rows).toBe(1);
    expect(m.cols).toBe(3);
    expect(m.get(0, 2)).toBe(3);
  });

  it('new DenseMatrix([1, 2, 3]) is a 1 x 3 row', () => {
    const m = new DenseMatrix([1, 2, 3]);
    expect(m.rows).toBe(1);
    expect(m.cols).toBe(3);
    expect(m.get(0, 2)).toBe(3);
    expect(m.toArray()).toEqual([[1, 2, 3]]);
  });

  it('a 1-D array of one element is a 1 x 1 matrix', () => {
    expect(DenseMatrix.fromArray([7]).toArray()).toEqual([[7]]);
  });

  it('a non-number element of a 1-D array throws', () => {
    expect(() => DenseMatrix.fromArray([1, 'a'] as unknown as number[])).toThrow(/numbers/);
  });

  it('an empty array still throws', () => {
    expect(() => new DenseMatrix([])).toThrow(/non-empty/);
    expect(() => new DenseMatrix([[]])).toThrow(/non-empty/);
  });

  it('a mix of rows and values throws a rectangular error', () => {
    expect(() => new DenseMatrix([1, [2]] as unknown as number[][])).toThrow(/rectangular/);
    expect(() => new DenseMatrix([[1], 2] as unknown as number[][])).toThrow(/rectangular/);
  });

  it('a 2-D array is unchanged', () => {
    const m = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(2);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
