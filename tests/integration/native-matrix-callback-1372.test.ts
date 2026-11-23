import { describe, expect, it } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { fraction, map, matrix } from '@danielsimonjr/mathts-functions';

describe('native and boxed matrix map contracts (#1372)', () => {
  it('passes the native row and column separately and stores numbers', () => {
    const input = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(input.map((value, row, col) => value + 10 * row + 100 * col).toArray()).toEqual([
      [1, 102],
      [13, 114],
    ]);
  });

  it('preserves Fractions when mapping a boxed matrix', () => {
    const input = matrix([[0.5, 0.75]]);
    const result = map(input, (value: number) => fraction(value)) as {
      toArray(): { numerator: bigint; denominator: bigint }[][];
    };
    expect(result.toArray()[0].map((value) => [value.numerator, value.denominator])).toEqual([
      [1n, 2n],
      [3n, 4n],
    ]);
  });
});
