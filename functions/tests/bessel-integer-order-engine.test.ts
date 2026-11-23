/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * The integer-order scalars J0, J1, Y0, Y1 (and the integer J_n, Y_n that start from them) must
 * match mpmath 1.3.0 to 40 u, with u = 2^-52 * sqrt(2 / (pi x)). Every input is the exact
 * double. The old code used the ascending series to x = 13 (88820 u at x = 12.999999, from
 * cancellation) and a Hankel phase that rounded x - pi / 4 (5586 u at x = 22926.8125).
 */
import { describe, it, expect } from 'vitest';
import { besselJ, besselJ0, besselJ1, besselY, besselY0, besselY1 } from '../src/typed/special.js';

// [x, J0, J1, Y0, Y1]
const ROWS: Array<[number, number, number, number, number]> = [
  [8, 0.1716508071375539, 0.23463634685391463, 0.22352148938756622, -0.15806046173124749],
  [10.5, -0.23664819446234714, -0.078850014227331483, -0.067530372497876398, 0.23370422835726859],
  [
    12.999999, 0.20692603205890958, -0.070318264456934731, -0.07820807460925315,
    -0.21008134637283055,
  ],
  [
    13.0000001, 0.20692610940887191, -0.0703180308882599, -0.078207843519734893,
    -0.21008141462546803,
  ],
  [14, 0.17107347611045867, 0.13337515469879324, 0.1271925685821837, -0.16664484185617226],
  [16.5, -0.19638069293686103, -0.0057642137356312267, 0.00018123245754096657, 0.19647583778590966],
  [20, 0.16702466434058316, 0.06683312417585005, 0.062640596809383831, -0.16551161436252129],
  [
    16301.313, -0.0022837628613650443, 0.0058169488730946987, 0.0058170189187912724,
    0.0022839412842300473,
  ],
  [
    22926.8125, 0.0013277085041525044, -0.005099448331462854, -0.0050994772856163698,
    -0.0013278197165541602,
  ],
];

const err = (got: unknown, want: number, x: number): number =>
  Math.abs((got as number) - want) / (2 ** -52 * Math.sqrt(2 / (Math.PI * Math.max(x, 1))));

describe('integer-order J0, J1, Y0, Y1 against mpmath', () => {
  for (const [x, j0, j1, y0, y1] of ROWS) {
    it(`x = ${x}: every value within 40 u`, () => {
      expect(err(besselJ0(x), j0, x)).toBeLessThanOrEqual(40);
      expect(err(besselJ1(x), j1, x)).toBeLessThanOrEqual(40);
      expect(err(besselY0(x), y0, x)).toBeLessThanOrEqual(40);
      expect(err(besselY1(x), y1, x)).toBeLessThanOrEqual(40);
      expect(err(besselJ(0, x), j0, x)).toBeLessThanOrEqual(40);
      expect(err(besselY(1, x), y1, x)).toBeLessThanOrEqual(40);
    });
  }

  it('the amplitude of x above 5.7e307 is not 0 (pi * x overflowed)', () => {
    const want = 3.108146590703153e-155;
    expect(Math.abs((besselJ(0.5, 5.8e307) as number) - want) / Math.abs(want)).toBeLessThan(1e-9);
    expect(besselJ0(5.8e307)).not.toBe(0);
  });
});
