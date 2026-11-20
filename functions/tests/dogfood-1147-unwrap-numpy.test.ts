/**
 * #1147: `unwrapPhase` equals `numpy.unwrap`.
 *
 * Oracle: NumPy 2.3.5. Each value below is the exact double that the oracle prints, so `toEqual` pins it.
 */
import { describe, expect, it } from 'vitest';
import * as F from '../src/index.js';

describe('#1147 unwrapPhase equals numpy.unwrap', () => {
  const sampleSizes = Array.from({ length: 12 }, (_, k) =>
    Math.atan2(Math.sin(0.5 * k), Math.cos(0.5 * k))
  );
  const rows: [string, number[], number[]][] = [
    [
      'alternating 0 and 6e6',
      [0, 6e6, 0, 6e6, 0, 6e6],
      [
        0, -2.1453850027173758, -9.313225746154785e-10, -2.1453850036486983, -1.862645149230957e-9,
        -2.145385004580021,
      ],
    ],
    [
      'ramp with a jump',
      [0, 3.5, 7.0, -1.0, 10.0],
      [0, -2.7831853071795862, -5.5663706143591725, -7.283185307179586, -8.849555921538759],
    ],
    [
      'multiples of pi',
      [0, Math.PI, 0, -Math.PI, 2 * Math.PI + 0.1],
      [0, 3.141592653589793, 0, -3.141592653589793, -6.183185307179587],
    ],
    [
      'angle of a rotating phasor',
      sampleSizes,
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.4999999999999996, 3.9999999999999996, 4.5, 5, 5.5],
    ],
    ['one step of 4', [0, 4], [0, -2.2831853071795862]],
    // Steps one ulp below, at and one ulp above pi: the edge between "no correction" and "wrap".
    [
      'steps one ulp below pi',
      [0, 3.1415926535897927, 6.283185307179585, 0],
      [0, 3.1415926535897927, 6.283185307179585, 6.283185307179586],
    ],
    [
      'steps one ulp above pi',
      [0, 3.1415926535897936, 6.283185307179587, 0],
      [0, 3.141592653589793, 6.283185307179586, 6.283185307179585],
    ],
    [
      'steps of exactly pi',
      [0, Math.PI, 2 * Math.PI, 3 * Math.PI, 0],
      [0, 3.141592653589793, 6.283185307179586, 9.42477796076938, 6.283185307179586],
    ],
    ['Infinity first', [Infinity, 1, 2, -Infinity], [Infinity, NaN, NaN, NaN]],
    ['Infinity in the middle', [1, Infinity, 2], [1, NaN, NaN]],
    ['NaN in the middle', [1, NaN, 2], [1, NaN, NaN]],
    ['a difference that overflows', [-1e308, 1e308], [-1e308, NaN]],
    [
      'steps of 5e3',
      [0, 5e3, -5e3, 1e4, 0],
      [0, -1.4155045149500438, 1.4155045149518628, 3.4521762772783404, 6.283185307180247],
    ],
    ['one step of 6.6e6', [0, 6.6e6], [0, -2.35992350243032]],
    ['one step of 1e300 (numpy cancels it to 0)', [0, 1e300], [0, 0]],
    [
      'negative and large steps',
      [0, -3.2, 3.3, -1e5, 7],
      [0, 3.083185307179586, 3.3, 3.177349070290802, 0.716814692816115],
    ],
  ];
  it.each(rows)('%s', (_name, input, want) => {
    expect(F.unwrapPhase(input)).toEqual(want);
  });

  it('returns an empty array for an empty input', () => {
    expect(F.unwrapPhase([])).toEqual([]);
  });

  it('rejects a Matrix by name, as dct and hilbertTransform do (#1145), and does not return [undefined]', () => {
    const m = F.matrix([0, 4, 8]) as never;
    expect(() => F.unwrapPhase(m)).toThrow(TypeError);
    expect(() => F.unwrapPhase(m)).toThrow(/^unwrapPhase: phase must be an array or a typed array/);
  });

  it('accepts a typed array and gives the values of the array', () => {
    expect(F.unwrapPhase(new Float64Array([0, 4, 8]) as never)).toEqual(F.unwrapPhase([0, 4, 8]));
  });
});

describe('#1147 unwrapPhase cost is O(n) at any phase value', () => {
  // The old algorithm took about 2.25 s for 2,000 such samples and grows as n^2: about 225 s here.
  it('200,000 samples alternating 0 and 6e6 equal numpy.unwrap', { timeout: 20_000 }, () => {
    const x = Array.from({ length: 200_000 }, (_, i) => (i % 2 === 0 ? 0 : 6e6));
    const u = F.unwrapPhase(x);
    expect(u).toHaveLength(200_000);
    const want: [number, number][] = [
      [0, 0],
      [1, -2.1453850027173758],
      [2, -9.313225746154785e-10],
      [3, -2.1453850036486983],
      [99999, -2.145431567914784],
      [100000, -4.6566128730773926e-5],
      [199998, -9.313132613897324e-5],
      [199999, -2.1454781340435147],
    ];
    for (const [i, v] of want) expect(u[i], `sample ${i}`).toBe(v);
  });
});

describe('#1147 unwrapPhase rejects a nested array', () => {
  it('[[0,4],[8,1]] throws a TypeError that names the function', () => {
    expect(() =>
      F.unwrapPhase([
        [0, 4],
        [8, 1],
      ] as never)
    ).toThrow(TypeError);
    expect(() =>
      F.unwrapPhase([
        [0, 4],
        [8, 1],
      ] as never)
    ).toThrow(/unwrapPhase/);
  });
});
