import { describe, expect, it } from 'vitest';
import {
  bignumber,
  chiSquareTest,
  fisherExact,
  fraction,
  kolmogorovSmirnovTest,
  mannWhitneyTest,
  medianSelect,
  shapiroWilkTest,
} from '../src/index.js';

describe('number-only statistics reject boxed data (#1313)', () => {
  it.each([
    ['BigNumber', bignumber(2)],
    ['Fraction', fraction(3, 2)],
  ])('reports %s in each numeric input path', async (kind, boxed) => {
    const exact = boxed as unknown as number;
    const input = [1, exact, 3];
    const message = (name: string) => new RegExp(`^${name}: expects number data, got a ${kind}`);
    await expect(chiSquareTest(input, [2, 2, 2])).rejects.toThrow(message('chiSquareTest'));
    await expect(chiSquareTest([1, 2, 3], input)).rejects.toThrow(message('chiSquareTest'));
    await expect(
      chiSquareTest([
        [1, exact],
        [3, 4],
      ])
    ).rejects.toThrow(message('chiSquareTest'));
    await expect(kolmogorovSmirnovTest(input)).rejects.toThrow(message('kolmogorovSmirnovTest'));
    await expect(mannWhitneyTest([1, 2], input)).rejects.toThrow(message('mannWhitneyTest'));
    await expect(shapiroWilkTest(input)).rejects.toThrow(message('shapiroWilkTest'));
    expect(() => medianSelect(input)).toThrow(message('medianSelect'));
    expect(() => medianSelect([exact])).toThrow(TypeError);
    expect(() =>
      fisherExact([
        [1, exact],
        [3, 4],
      ])
    ).toThrow(TypeError);
  });
});
