import { describe, it, expect } from 'vitest';
import { pow } from '@danielsimonjr/mathts-functions';

/**
 * B2 / parity: `pow(A, n)` for a square matrix (matrix power) was unsupported — the
 * public `pow` had only scalar signatures, so `pow([[…]], n)` threw "Unexpected type
 * of argument". mathjs supports matrix powers. The fix adds a synchronous
 * non-negative-integer matrix-power path (repeated multiply on the native DenseMatrix
 * backend); negative/fractional powers still route to the async `matrixPower`.
 *
 * Oracles are closed-form matrix products.
 * See [[feedback-oracle-tests-implementation-independent]].
 */
describe('pow — square-matrix power (non-negative integer)', () => {
  it('pow([[1,2],[3,4]], 2) = [[7,10],[15,22]]', () => {
    expect(
      pow(
        [
          [1, 2],
          [3, 4],
        ],
        2
      )
    ).toEqual([
      [7, 10],
      [15, 22],
    ]);
  });

  it('pow([[1,1],[0,1]], 3) = [[1,3],[0,1]] (Jordan block)', () => {
    expect(
      pow(
        [
          [1, 1],
          [0, 1],
        ],
        3
      )
    ).toEqual([
      [1, 3],
      [0, 1],
    ]);
  });

  it('pow(A, 0) = I', () => {
    expect(
      pow(
        [
          [5, 9],
          [2, 7],
        ],
        0
      )
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('pow(A, 1) = A', () => {
    expect(
      pow(
        [
          [5, 9],
          [2, 7],
        ],
        1
      )
    ).toEqual([
      [5, 9],
      [2, 7],
    ]);
  });

  it('rejects a non-square matrix with a clear error', () => {
    expect(() =>
      pow(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        2
      )
    ).toThrow(/square/);
  });

  it('directs fractional/negative powers to the async matrixPower', () => {
    expect(() =>
      pow(
        [
          [2, 0],
          [0, 2],
        ],
        -1
      )
    ).toThrow(/matrixPower/);
  });
});
