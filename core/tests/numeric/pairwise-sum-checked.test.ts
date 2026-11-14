/**
 * `pairwiseSumChecked` is `pairwiseSum` with a number check in its leaf loop (#1039).
 *
 * It returns the exact bits of `pairwiseSum` when every element is a number, and `undefined`
 * when any element is not a number. The check sits inside the loop that adds, so a caller pays
 * no separate pass over the data.
 */
import { describe, expect, it } from 'vitest';
import { Fraction, pairwiseSum, pairwiseSumChecked } from '../../src/index.js';

/** A deterministic number array of length n with values of mixed magnitude. */
function data(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 10 ** ((i % 7) - 3));
}

describe('pairwiseSumChecked', () => {
  it('returns the same bits as pairwiseSum for every length from 0 to 300', () => {
    for (let n = 0; n <= 300; n++) {
      const xs = data(n);
      expect(Object.is(pairwiseSumChecked(xs), pairwiseSum(xs))).toBe(true);
    }
  });

  it('returns the same bits as pairwiseSum for long arrays', () => {
    for (const n of [1023, 1024, 1025, 65537, 1_000_003]) {
      const xs = data(n);
      expect(Object.is(pairwiseSumChecked(xs), pairwiseSum(xs))).toBe(true);
    }
  });

  it('keeps NaN and infinities as pairwiseSum does', () => {
    expect(pairwiseSumChecked([1, Number.NaN, 2])).toBeNaN();
    expect(pairwiseSumChecked([1, Number.POSITIVE_INFINITY])).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns undefined when any element is not a number, at any position', () => {
    for (const n of [1, 7, 8, 9, 300, 5000]) {
      for (const at of [0, n >> 1, n - 1]) {
        const xs: unknown[] = data(n);
        xs[at] = new Fraction(1, 3);
        expect(pairwiseSumChecked(xs)).toBeUndefined();
      }
    }
  });

  it('returns undefined for a string, a bigint, a boolean, a nested array and a hole', () => {
    expect(pairwiseSumChecked([1, '2'])).toBeUndefined();
    expect(pairwiseSumChecked([1, 2n])).toBeUndefined();
    expect(pairwiseSumChecked([1, true])).toBeUndefined();
    expect(pairwiseSumChecked([1, [2]])).toBeUndefined();
    // eslint-disable-next-line no-sparse-arrays -- a hole is the input under test
    expect(pairwiseSumChecked([1, , 3])).toBeUndefined();
  });

  it('returns 0 for an empty array', () => {
    expect(pairwiseSumChecked([])).toBe(0);
  });
});
