/**
 * #1259 in the worker copy of `norm2` and `scaledDistance`: an infinite element gives Infinity,
 * also with a NaN element; else a NaN gives NaN (the IEEE 754 rule of `hypot`). The worker
 * partials and their combine step must give the value of core and of `Math.hypot`, for every
 * split of the list into chunks.
 */
import { describe, it, expect } from 'vitest';
import { norm2, scaledDistance } from '@danielsimonjr/mathts-core';
import {
  _workerScaledSsq,
  _workerScaledSsqDiff,
  _workerCombineScaledSsq,
} from '../src/worker-numerics.js';

const lists: number[][] = [
  [Infinity, NaN],
  [NaN, Infinity],
  [NaN, 1, -Infinity, 2],
  [Infinity, Infinity],
  [3, 4, NaN],
  [3, 4],
];

describe('worker 2-norm partials follow the IEEE rule (#1259)', () => {
  it.each(lists)('norm of (%s, ...) for every chunk split', (...xs) => {
    const want = Math.hypot(...xs);
    expect(norm2(xs)).toBe(want);
    for (let cut = 0; cut <= xs.length; cut++) {
      const parts = [_workerScaledSsq(xs, 0, cut), _workerScaledSsq(xs, cut, xs.length)];
      expect(_workerCombineScaledSsq(parts)).toBe(want);
      const zeros = xs.map(() => 0);
      const diffs = [
        _workerScaledSsqDiff(xs, zeros, 0, cut),
        _workerScaledSsqDiff(xs, zeros, cut, xs.length),
      ];
      expect(_workerCombineScaledSsq(diffs)).toBe(want);
      expect(scaledDistance(xs, zeros)).toBe(want);
    }
  });
});
