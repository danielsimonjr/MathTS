/**
 * #1273: `sparse()` of a ragged nested array.
 *
 * The SparseMatrix constructor took the column count from the first row and read a 1-D input
 * from the first element only, so entries of a longer later row were dropped
 * (`sparse([[1], [2, 3]])` gave size [2, 1] and lost the 3). mathjs takes the column count
 * from the longest row, reads a value that is not an Array as a one-entry row, and fills the
 * short rows with zero. The oracle is the mathjs `sparse` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { size(): number[]; toArray(): unknown[]; storage(): string };
const sparse = math.sparse as unknown as Fn;
const matrix = math.matrix as unknown as Fn;
const mjSparse = mathjs.sparse as unknown as Fn;

const CASES: Array<[string, unknown, number[], number[][]]> = [
  [
    '[[1], [2, 3]]',
    [[1], [2, 3]],
    [2, 2],
    [
      [1, 0],
      [2, 3],
    ],
  ],
  [
    '[[1, 2], [3]]',
    [[1, 2], [3]],
    [2, 2],
    [
      [1, 2],
      [3, 0],
    ],
  ],
  [
    '[[1, 2], [3, 4, 5], [6]]',
    [[1, 2], [3, 4, 5], [6]],
    [3, 3],
    [
      [1, 2, 0],
      [3, 4, 5],
      [6, 0, 0],
    ],
  ],
  ['[[], [1]]', [[], [1]], [2, 1], [[0], [1]]],
  ['[[1], 2]', [[1], 2], [2, 1], [[1], [2]]],
  ['[1, [2]]', [1, [2]], [2, 1], [[1], [2]]],
  ['[1, 2] (a column)', [1, 2], [2, 1], [[1], [2]]],
];

describe('#1273 sparse() of a ragged nested array', () => {
  it.each(CASES)('sparse(%s) has the mathjs size and entries', (_name, input, size, dense) => {
    const expected = mjSparse(input) as Mat;
    expect(expected.size()).toEqual(size);
    expect(expected.toArray()).toEqual(dense);
    const actual = sparse(input) as Mat;
    expect(actual.storage()).toBe('sparse');
    expect(actual.size()).toEqual(size);
    expect(actual.toArray()).toEqual(dense);
  });

  it.each(CASES)(
    'matrix(%s, "sparse") has the same size and entries',
    (_name, input, size, dense) => {
      const actual = matrix(input, 'sparse') as Mat;
      expect(actual.storage()).toBe('sparse');
      expect(actual.size()).toEqual(size);
      expect(actual.toArray()).toEqual(dense);
    }
  );

  it('a 3-D input still throws the two-dimensional RangeError', () => {
    expect(() => sparse([[[1]]])).toThrow(RangeError);
    expect(() => sparse([[[1]]])).toThrow(/Matrix must be two dimensional/);
  });

  it('a rectangular input is unchanged', () => {
    const m = sparse([
      [1, 0],
      [0, 2],
    ]) as Mat;
    expect(m.size()).toEqual([2, 2]);
    expect(m.toArray()).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });

  it('an empty input is unchanged', () => {
    expect((sparse([]) as Mat).size()).toEqual((mjSparse([]) as Mat).size());
    expect((sparse([[]]) as Mat).size()).toEqual((mjSparse([[]]) as Mat).size());
  });
});
