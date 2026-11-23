/**
 * Dogfood #1280 - the slope of a scaled regression goes back to the units of the data.
 *
 * `fitLineScaled` divides x by `sx` and y by `sy`, two exact powers of 2. The slope and its
 * standard error go back by `sy / sx`. That ratio overflows for `sy = 2^500, sx = 2^-600`, and
 * `0 * Infinity` is NaN. The exact values below are finite: x is `[1, 2, 3] * 2^-600` and y is
 * `[1, 1 + 2^-52, 1] * 2^500` (slope 0); x is `[1, 1.5, 1.75] * 2^-530` and y is
 * `[1, 1 + 2^-40, 1 + 2^-39] * 2^500` (slope about 2^991.4).
 */
import { describe, expect, it } from 'vitest';
import { linearRegression, linregress } from '../src/index.js';

const xs = (v: number[], e: number) => v.map((t) => t * 2 ** e);

describe('#1280 a scaled regression has a finite slope when the exact slope is finite', () => {
  it('slope 0 with x of order 2^-600 and y of order 2^500', () => {
    const r = linearRegression(xs([1, 2, 3], -600), xs([1, 1 + 2 ** -52, 1], 500));
    expect(r.slope).toBe(0);
    // The exact standard error is about 2^1048: above the double range, so Infinity is right.
    expect(r.stdErr).toBe(Infinity);
  });

  it('slope about 2^991.4 with x of order 2^-530 and y of order 2^500', () => {
    const x = [1, 1.5, 1.75];
    const y = [1, 1 + 2 ** -40, 1 + 2 ** -39];
    const r = linearRegression(xs(x, -530), xs(y, 500));
    // The slope of the data of order 1, times the exact ratio 2^1030 in two exact steps.
    const unit = linearRegression(x, y);
    expect(Number.isFinite(r.slope)).toBe(true);
    expect(r.slope).toBe(unit.slope * 2 ** 515 * 2 ** 515);
    expect(r.stdErr).toBe(unit.stdErr * 2 ** 515 * 2 ** 515);
    expect(Math.log2(r.slope)).toBeCloseTo(991.4, 1);
  });

  it('linregress takes the same path', () => {
    const r = linregress(xs([1, 2, 3], -600), xs([1, 1 + 2 ** -52, 1], 500)) as {
      slope: number;
    };
    expect(r.slope).toBe(0);
  });

  it('data of order 1 keeps its bits (no scale)', () => {
    const r = linearRegression([1, 2, 3, 4], [2, 4.5, 5.5, 8]);
    expect(r.slope).toBe(1.9);
  });
});
