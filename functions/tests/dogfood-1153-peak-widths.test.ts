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

describe('#1153 findPeaks prominence stops at a NaN sample, as scipy.signal.find_peaks', () => {
  // The rewrite of the prominence walk made a NaN sample end the walk (a comparison with NaN is
  // false), as in SciPy 1.16.3. The old walk ran through it. Oracle: find_peaks(x, prominence=p).
  it.each([
    [[0, NaN, 3, 4, 0], 3, []],
    [[0, NaN, 3, 4, 0], 1, [3]],
    [[0, NaN, 3, 4, 0], 1.0001, []],
    [[5, 1, 3, NaN, 4, 5, 0, 2], 2, []],
  ] as [number[], number, number[]][])('findPeaks(%j, prominence %d) is %j', (x, p, want) => {
    expect(F.findPeaks(x, { prominence: p })).toEqual(want);
  });
});

describe('#1153 peakWidths with a typed array of peaks', () => {
  it('an Int32Array of peaks gives the same fractional widths as an array', () => {
    const x = [0, 1, 5, 1, 0];
    expect(F.peakWidths(x, [2])).toEqual([1.25]);
    const got = F.peakWidths(x, new Int32Array([2]) as never);
    expect(Array.isArray(got)).toBe(true);
    expect(got).toEqual([1.25]);
  });
});

describe('findPeaks and medfilt reject a Matrix by name', () => {
  const m = F.matrix([0, 1, 5, 1, 0]) as never;
  it('findPeaks(matrix) throws a TypeError that names the function', () => {
    expect(() => F.findPeaks(m)).toThrow(TypeError);
    expect(() => F.findPeaks(m)).toThrow(/findPeaks/);
  });
  it('medfilt(matrix) throws a TypeError that names the function', () => {
    expect(() => F.medfilt(m)).toThrow(TypeError);
    expect(() => F.medfilt(m)).toThrow(/medfilt/);
  });
  it('the array forms are unchanged', () => {
    expect(F.findPeaks([0, 1, 5, 1, 0])).toEqual([2]);
    // scipy.signal.medfilt pads with zeros (SciPy 1.16.3).
    expect(F.medfilt([0, 1, 5, 1, 0])).toEqual([0, 1, 1, 1, 0]);
  });
});

describe('medfilt equals scipy.signal.medfilt (zero padding)', () => {
  // Oracle: SciPy 1.16.3. Before the fix the edge windows were cut short, not padded with zeros:
  // [0, 1, 5, 1, 0] gave [1, 1, 1, 1, 1].
  const rows: [number[], number, number[]][] = [
    [[0, 1, 5, 1, 0], 3, [0, 1, 1, 1, 0]],
    [[3, -1, 4, -1, 5, -9, 2], 5, [0, 0, 3, -1, 2, 0, 0]],
    [[-5, -4, -3], 7, [0, 0, 0]],
    [[2, 8, 1], 3, [2, 2, 1]],
    [[1, 2], 9, [0, 0]],
    [[-1, -2, -3, -4], 3, [-1, -2, -3, -3]],
  ];
  it.each(rows)('medfilt(%j, %d)', (x, n, want) => {
    expect(F.medfilt(x, n)).toEqual(want);
  });
  it('a Float64Array gives the same result', () => {
    expect(F.medfilt(new Float64Array([0, 1, 5, 1, 0]) as never)).toEqual([0, 1, 1, 1, 0]);
  });
  it.each([0, -3, 2.5, NaN])('n = %d throws a RangeError', (n) => {
    expect(() => F.medfilt([1, 2, 3], n)).toThrow(/^medfilt: n must be a positive integer/);
  });
});
