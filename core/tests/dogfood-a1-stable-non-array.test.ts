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
  neumaierSum,
  neumaierCumsum,
  norm2,
  scaledDistance,
  extrema,
} from '../src/index.js';

const BAD: unknown[] = [0, 1, 5, null, undefined, {}, true];
// A `length` that is not a count, and strings (`pairwiseSum('abc')` was the string '00abc').
const BAD_LENGTH: Array<[string, unknown]> = [
  ['length NaN', { length: NaN }],
  ['length Infinity', { length: Infinity }],
  ['length -1', { length: -1 }],
  ['length 1.5', { length: 1.5 }],
  ['a string', 'abc'],
  ['an empty string', ''],
];

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
  it.each(BAD_LENGTH)('each primitive rejects %s', (_label, x) => {
    const bad = x as never;
    const calls: Array<[string, () => unknown]> = [
      ['pairwiseSum', () => pairwiseSum(bad)],
      ['pairwiseSumChecked', () => pairwiseSumChecked(bad)],
      ['pairwiseDot', () => pairwiseDot(bad, [1])],
      ['pairwiseDotChecked', () => pairwiseDotChecked([1], bad)],
      ['sumSquaredDeviations', () => sumSquaredDeviations(bad)],
      ['sumSquaredDeviationsChecked', () => sumSquaredDeviationsChecked(bad)],
      ['neumaierSum', () => neumaierSum(bad)],
      ['neumaierCumsum', () => neumaierCumsum(bad, [])],
      ['norm2', () => norm2(bad)],
      ['scaledDistance', () => scaledDistance([1], bad)],
      ['extrema', () => extrema(bad)],
    ];
    for (const [name, call] of calls) {
      expect(call, name).toThrow(TypeError);
      expect(call, name).toThrow(new RegExp(`^${name}:`));
    }
  });
  it.each([
    ['neumaierSum', () => neumaierSum(5 as never)],
    ['neumaierCumsum', () => neumaierCumsum(5 as never, [])],
    ['norm2', () => norm2(5 as never)],
    ['scaledDistance', () => scaledDistance(5 as never, [1])],
    ['scaledDistance', () => scaledDistance([1], 5 as never)],
    ['extrema', () => extrema(5 as never)],
  ] as Array<[string, () => unknown]>)('%s rejects the number 5', (name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(new RegExp(`^${name}:`));
  });
  it('keeps an explicit range and an omitted end', () => {
    expect(pairwiseSum([1, 2, 3], 1)).toBe(5);
    expect(pairwiseSum([1, 2, 3], 0, 2)).toBe(3);
    expect(pairwiseDot([1, 2, 3], [4, 5, 6], 1, 3)).toBe(28);
    expect(extrema([4, 1, 9], 1)).toEqual({ min: 1, max: 9, minIdx: 1, maxIdx: 2 });
    expect(norm2([3, 4])).toBe(5);
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
