/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * besselI at a large x and a fractional order. The power series multiplied by h * h / ((m + 1)
 * (m + 1 + nu)) at every step. The rounding of h * h, and of the sum m + 1 + nu (its fraction
 * rounds to the grid of the binade), has the same error at every step, so the error of a term grew
 * with m: 4.3e-14 at (251.7, 726.3). Oracle: mpmath 1.3.0, 150 digits, on the exact doubles.
 */
import { describe, it, expect } from 'vitest';
import { besselI } from '../src/typed/special.js';

// [nu, x, I_nu(x)]
const ROWS: Array<[number, number, number]> = [
  [251.7092062774756, 726.3282708221323, 6.9152084841663325e294],
  [3.0113375638611783, 538.3004880642221, 1.0298376345442706e232],
  [19.841798640924814, 514.4414473350439, 3.1485295185429209e221],
  [45.49975004815564, 627.1952436955374, 7.4596523590882066e269],
];

describe('besselI series rounding', () => {
  it.each(ROWS)('besselI(%s, %s) is within 1e-14', (nu, x, want) => {
    const got = besselI(nu, x) as number;
    expect(Math.abs(got - want) / want).toBeLessThanOrEqual(1e-14);
  });
});
