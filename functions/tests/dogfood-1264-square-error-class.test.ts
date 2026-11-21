import { describe, expect, it } from 'vitest';
import { expm, matrix, pow, sparse, zeros } from '../src/index.js';

describe('a matrix that is not square throws a RangeError, as mathjs does', () => {
  it('expm of a 2 x 3, a 0 x 3 and a 3-D matrix', () => {
    expect(() =>
      expm(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ])
      )
    ).toThrow(RangeError);
    expect(() => expm(zeros(0, 3))).toThrow(RangeError);
    expect(() => expm(sparse([[1, 2, 3]]))).toThrow(RangeError);
    expect(() =>
      expm(
        matrix([
          [
            [1, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [0, 1],
          ],
        ])
      )
    ).toThrow(/2×2×2/);
  });
  it('pow keeps its RangeError', () => {
    expect(() =>
      pow(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ]),
        2
      )
    ).toThrow(RangeError);
  });
});
