import { describe, expect, it } from 'vitest';
import * as mathjs from 'mathjs';
import * as mathts from '@danielsimonjr/mathts-functions';
import { all, create } from '@danielsimonjr/mathts-compat';

const compat = create(all);
const reductions = ['mean', 'max', 'min', 'std', 'norm'] as const;

function errorFrom(operation: () => unknown): Error {
  try {
    operation();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected the reduction to fail');
}

describe('global reductions of an empty matrix (#1344)', () => {
  it.each([
    [0, 3],
    [3, 0],
    [0, 0],
  ])('matches mathjs for a %s by %s matrix', (rows, cols) => {
    const reference = mathjs.zeros(rows, cols);
    const matrix = mathts.zeros(rows, cols);
    const compatMatrix = compat.zeros(rows, cols);
    for (const name of reductions) {
      const operation = mathjs[name] as (value: unknown) => unknown;
      const expected = errorFrom(() => operation(reference));
      for (const [api, input] of [
        [mathts, matrix],
        [compat, compatMatrix],
      ] as const) {
        const reduce = api[name] as (value: unknown) => unknown;
        const actual = errorFrom(() => reduce(input));
        expect(actual.constructor).toBe(expected.constructor);
        expect(actual.message).toBe(expected.message);
      }
    }
  });

  it('retains the vector norm of an empty vector', () => {
    expect(mathts.norm([])).toBe(0);
    expect(mathts.norm(mathts.matrix([]))).toBe(0);
  });
});
