/**
 * parallelStatNorm(data, 2) for a Float64Array. The #1280 rescue must not change the plain path:
 * ordinary data keeps the bits of the plain sum of squares (the hot loop, one pass), and only a
 * sum of squares that is outside the safe range goes through the scaled norm of core.
 */
import { describe, expect, it } from 'vitest';
import { parallelStatNorm } from '../src/index.js';

const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);
const lcg = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};
const plainNorm = (d: Float64Array): number => {
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  return Math.sqrt(sum);
};

describe('parallelStatNorm(Float64Array, 2)', () => {
  it('returns the bits of the plain sum of squares for data of order 1', () => {
    const rnd = lcg(11);
    for (let t = 0; t < 60; t++) {
      const d = new Float64Array(50 + t * 17);
      for (let i = 0; i < d.length; i++) d[i] = (rnd() - 0.5) * 20;
      expect(parallelStatNorm(d, 2)).toBe(plainNorm(d));
    }
  });

  it('keeps every digit when the squares are subnormal', () => {
    const base = Float64Array.from([1.1, 2.3, 4.7, 7.9, 11.3]);
    const tiny = base.map((v) => v * 2 ** -535);
    expect(rel(parallelStatNorm(tiny, 2) as number, plainNorm(base) * 2 ** -535)).toBeLessThan(
      4 * Number.EPSILON
    );
  });

  it('does not overflow when the squares do', () => {
    const base = Float64Array.from([1.1, 2.3, 4.7, 7.9, 11.3]);
    const big = base.map((v) => v * 2 ** 600);
    expect(rel(parallelStatNorm(big, 2) as number, plainNorm(base) * 2 ** 600)).toBeLessThan(
      4 * Number.EPSILON
    );
  });

  it('gives 0 for zeros and NaN for a NaN', () => {
    expect(parallelStatNorm(new Float64Array(8), 2)).toBe(0);
    expect(parallelStatNorm(Float64Array.from([1, NaN, 2]), 2)).toBeNaN();
  });
});
