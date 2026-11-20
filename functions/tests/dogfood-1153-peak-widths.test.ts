/**
 * #1153: `peakWidths` matches `scipy.signal.peak_widths`.
 *
 * Oracle: SciPy 1.16.3. Each value below is the exact double that the oracle prints, so `toEqual` pins it.
 */
import { describe, expect, it } from 'vitest';
import * as F from '../src/index.js';

describe('#1153 peakWidths matches scipy.signal.peak_widths', () => {
  const rows: [string, number[], number[], number | undefined, number[]][] = [
    ['a peak at the first sample has no prominence', [1, 3, 1], [0], undefined, [0]],
    ['a walk past the base at relHeight 1.5', [5, 1, 3, 1, 5], [2], 1.5, [2]],
    ['a walk to the base at relHeight 1', [5, 1, 3, 1, 5], [2], 1, [2]],
    ['relHeight 0.5', [0, 1, 5, 1, 0], [2], undefined, [1.25]],
    ['relHeight 1', [0, 1, 5, 1, 0], [2], 1, [4]],
    ['relHeight 2', [0, 1, 5, 1, 0], [2], 2, [4]],
    ['a taller neighbour peak, relHeight 0.5', [0, 2, 1, 3, 1, 2, 0], [3], undefined, [1.5]],
    ['a taller neighbour peak, relHeight 1', [0, 2, 1, 3, 1, 2, 0], [3], 1, [6]],
    ['a sample that is not a peak', [0, 1, 2, 3, 4], [2], undefined, [0]],
    ['a plateau', [0, 3, 3, 3, 0], [2], undefined, [3]],
    ['a plateau start', [2, 5, 5, 1, 7], [1], undefined, [1.875]],
    ['relHeight 0.7', [1, 4, 2, 6, 2, 4, 1], [1], 0.7, [1.1666666666666665]],
    ['a noisy signal, first peak', [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5], [5], undefined, [1.375]],
    [
      'a noisy signal, relHeight 0.8',
      [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
      [7],
      0.8,
      [2.299999999999999],
    ],
    ['nested peaks, relHeight 1 (first)', [0, 10, 4, 8, 1], [1], 1, [3.9]],
    ['nested peaks, relHeight 1 (second)', [0, 10, 4, 8, 1], [3], 1, [1.5714285714285716]],
    ['relHeight 1e308', [0, 1, 0], [1], 1e308, [2]],
    ['a plain triangle', [1, 3, 1], [1], undefined, [1]],
    ['relHeight Infinity on a zero prominence', [0, 1, 2, 3, 4], [2], Infinity, [0]],
  ];
  it.each(rows)('%s', (_name, x, peaks, rel, want) => {
    const got = rel === undefined ? F.peakWidths(x, peaks) : F.peakWidths(x, peaks, rel);
    expect(got).toEqual(want);
  });

  it('rejects a negative or NaN relHeight with a RangeError', () => {
    expect(() => F.peakWidths([1, 3, 1], [1], -1)).toThrow(RangeError);
    expect(() => F.peakWidths([1, 3, 1], [1], -1)).toThrow(/peakWidths: relHeight/);
    expect(() => F.peakWidths([1, 3, 1], [1], NaN)).toThrow(/peakWidths: relHeight/);
  });

  it('pin: an invalid index still throws the index error', () => {
    expect(() => F.peakWidths([1, 3, 1], [Infinity])).toThrow(
      'peakWidths: peak 0 is not a valid index for x'
    );
  });
});
