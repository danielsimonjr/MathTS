/**
 * Dogfood #1011: a number as the data argument of a stable reduction primitive.
 * A number has no `length`, so the range end was NaN and the block recursion never ended.
 * Each primitive now throws a TypeError that names the function.
 */
import { describe, it, expect } from 'vitest';
import {
  pairwiseSum,
  pairwiseSumChecked,
  pairwiseDot,
  pairwiseDotChecked,
  sumSquaredDeviations,
  sumSquaredDeviationsChecked,
} from '../src/index.js';

const BAD: unknown[] = [0, 1, 5, null, undefined, {}, true];

describe('stable primitives reject non-array-like data (#1011)', () => {
  it.each(BAD)('pairwiseSum(%j) throws a TypeError that names the function', (x) => {
    expect(() => pairwiseSum(x as never)).toThrow(TypeError);
    expect(() => pairwiseSum(x as never)).toThrow(/pairwiseSum/);
  });
  it.each(BAD)('sumSquaredDeviations(%j) throws a TypeError that names the function', (x) => {
    expect(() => sumSquaredDeviations(x as never)).toThrow(TypeError);
    expect(() => sumSquaredDeviations(x as never)).toThrow(/sumSquaredDeviations/);
  });
  it.each(BAD)('pairwiseDot(%j, %j) throws a TypeError that names the function', (x) => {
    expect(() => pairwiseDot(x as never, [1, 2] as never)).toThrow(TypeError);
    expect(() => pairwiseDot(x as never, [1, 2] as never)).toThrow(/pairwiseDot/);
    expect(() => pairwiseDot([1, 2], x as never)).toThrow(/pairwiseDot/);
  });
  it('pairwiseDot(1, 2) throws', () => {
    expect(() => pairwiseDot(1 as never, 2 as never)).toThrow(TypeError);
  });
  it('the checked variants return undefined or throw, never recurse', () => {
    for (const x of BAD) {
      expect(() => pairwiseSumChecked(x as never)).toThrow(TypeError);
      expect(() => sumSquaredDeviationsChecked(x as never)).toThrow(TypeError);
      expect(() => pairwiseDotChecked(x as never, [1] as never)).toThrow(TypeError);
    }
  });
  it('keeps the result for arrays, typed arrays and array-likes', () => {
    expect(pairwiseSum([1, 2, 3])).toBe(6);
    expect(pairwiseSum(new Float64Array([1, 2, 3]))).toBe(6);
    expect(pairwiseSum({ length: 2, 0: 4, 1: 5 })).toBe(9);
    expect(pairwiseSum([])).toBe(0);
    expect(sumSquaredDeviations([1, 2, 3])).toBe(2);
    expect(pairwiseDot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});
