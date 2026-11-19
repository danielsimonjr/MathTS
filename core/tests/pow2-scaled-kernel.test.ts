/**
 * `withPow2ScaledKernel` (#1212): the shared scale, run and unscale step of the kernels that
 * run on a matrix scaled by a power of 2.
 */
import { describe, it, expect } from 'vitest';
import { entryRange, ldexp, withPow2ScaledKernel, SQUARED } from '../src/pow2-scale.js';

const scale = (a: number[], e: number) => a.map((v) => ldexp(v, e));

describe('withPow2ScaledKernel', () => {
  it('runs the kernel on the input itself inside the window, with no scale or unscale', () => {
    const input = [1, 2, 3];
    let scaled = 0;
    let unscaled = 0;
    const out = withPow2ScaledKernel(
      entryRange(input),
      -SQUARED,
      SQUARED,
      input,
      (a, e) => (scaled++, scale(a, e)),
      (a) => a,
      (r) => (unscaled++, r)
    );
    expect(out).toBe(input);
    expect(scaled).toBe(0);
    expect(unscaled).toBe(0);
  });

  it('scales a large input into the window and unscales the result by the same exponent', () => {
    const input = [2 ** 600, 3 * 2 ** 599];
    const seen: number[][] = [];
    let exponent = 0;
    const out = withPow2ScaledKernel(
      entryRange(input),
      -SQUARED,
      SQUARED,
      input,
      scale,
      (a) => (seen.push(a), a.map((v) => v * 2)),
      (r, e) => ((exponent = e), scale(r, -e))
    );
    expect(Math.max(...seen[0])).toBeLessThanOrEqual(2 ** SQUARED);
    expect(exponent).toBeLessThan(0);
    expect(out).toEqual(input.map((v) => v * 2));
    expect(input).toEqual([2 ** 600, 3 * 2 ** 599]);
  });

  it('scales a small input up, and returns the kernel result as it is without an unscale', () => {
    const input = [2 ** -600, 2 ** -601];
    const out = withPow2ScaledKernel(entryRange(input), -SQUARED, SQUARED, input, scale, (a) =>
      Math.max(...a)
    );
    expect(out).toBeGreaterThanOrEqual(2 ** -SQUARED);
  });

  it('takes the unscaled run for a NaN entry', () => {
    const input = [NaN, 2 ** 600];
    let scaled = 0;
    const out = withPow2ScaledKernel(
      entryRange(input),
      -SQUARED,
      SQUARED,
      input,
      (a, e) => (scaled++, scale(a, e)),
      (a) => a
    );
    expect(out).toBe(input);
    expect(scaled).toBe(0);
  });

  it('reuses the input for the second run when the first run is kept apart (span beyond the double range)', () => {
    // 2^-1000 would fall below 2^-1022 after the scale, so the unscaled run is tried first.
    const input = [2 ** 700, 2 ** -1000];
    const runs: number[][] = [];
    withPow2ScaledKernel(
      entryRange(input),
      -SQUARED,
      SQUARED,
      input,
      scale,
      (a) => (runs.push([...a]), Infinity),
      (r) => r
    );
    expect(runs.length).toBe(2);
    expect(runs[0]).toEqual([2 ** 700, 2 ** -1000]);
    expect(input).toEqual([2 ** 700, 2 ** -1000]);
  });
});
