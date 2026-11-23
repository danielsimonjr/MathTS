import { describe, expect, it } from 'vitest';
import { size as oracleSize } from 'mathjs';
import { DenseMatrix, size, parallelMatrixSize } from '../src/index.js';

describe('matrix size of a nested array', () => {
  for (const measure of [size, parallelMatrixSize]) {
    describe(measure.name, () => {
      it.each([
        { data: [], shape: [0] },
        { data: [[], []], shape: [2, 0] },
        { data: [1, 2], shape: [2] },
        { data: [[[1], [2]]], shape: [1, 2, 1] },
        {
          data: [
            [
              [1, 2],
              [3, 4],
            ],
            [
              [5, 6],
              [7, 8],
            ],
          ],
          shape: [2, 2, 2],
        },
      ])('returns the full rectangular shape $shape', ({ data, shape }) => {
        expect(measure(data)).toEqual(shape);
        expect(measure(data)).toEqual(oracleSize(data));
      });

      it.each([
        {
          data: [
            [1, 2],
            [[3], [4]],
          ],
        },
        { data: [[1, 2], [3]] },
        {
          data: [
            [[1], [2]],
            [
              [3, 4],
              [5, 6],
            ],
          ],
        },
        { data: [1, [2]] },
      ])('rejects inconsistent nested dimensions', ({ data }) => {
        expect(() => measure(data)).toThrow(/Dimension mismatch/);
      });

      it('rejects a cyclic first branch instead of assuming a finite rank', () => {
        const cycle: unknown[] = [];
        cycle.push(cycle);
        expect(() => measure(cycle)).toThrow(/cyclic nested array/);
      });

      it('preserves the declared dimensions of an empty dense matrix', () => {
        expect(measure(DenseMatrix.zeros(0, 3))).toEqual([0, 3]);
      });
    });
  }

  it('preserves parallel size for flat typed arrays', () => {
    expect(parallelMatrixSize(new Float64Array(3))).toEqual([3]);
  });
});
