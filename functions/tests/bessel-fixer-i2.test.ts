/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * Bessel functions at the edges that the batch I2 code review found. Oracle: mpmath 1.3.0
 * (besselk and besseli at 300 digits, besselj at 60), on the exact doubles.
 *
 * - besselK above x = 700 (#1362): exp(-x) of the start values lost its bits from x = 708.4 and
 *   was 0 from 745.2, so the recurrence started from 0. The negative-order besselI uses the same
 *   K core.
 * - besselJ of a real order for 1e-5 <= x < 2: the Wronskian form w / (Y' - f Y) cancelled for
 *   a negative reduced order, and the factor `fact -= 1 / x` added one rounding per step.
 * - A huge x: besselIPlan gave a NaN exponent, and CF2 of besselK formed 2 (1 + x) = Infinity.
 * - x = Infinity: J and Y have the limit 0.
 */
import { describe, it, expect } from 'vitest';
import {
  besselI,
  besselJ,
  besselJ0,
  besselJ1,
  besselK,
  besselY,
  besselY0,
  besselY1,
} from '../src/typed/special.js';

const rel = (got: unknown, want: number): number =>
  Math.abs((got as number) - want) / Math.abs(want);

describe('besselK above x = 700 (#1362)', () => {
  // [nu, x, K_nu(x)]
  const ROWS: Array<[number, number, number]> = [
    [738.4, 720.25, 8.6291016259480173e-162],
    [1000.25, 730, 3.3815453468813235e-53],
    [738.4, 739.88, 6.414235418425539e-174],
    [1000.25, 739.88, 1.911264747801494e-60],
    [738.4, 744, 1.9147917481674586e-176],
    [1000.25, 744.9, 4.1948857789644155e-64],
    [100.5, 710, 2.5413642346102947e-307],
    [1000, 900, 1.6505109708029708e-170],
    [2000.5, 1200, 6.9754636243020937e100],
    [2100.5, 1300, 3.5732996241216202e72],
  ];
  it.each(ROWS)('besselK(%s, %s) is within 1e-14', (nu, x, want) => {
    expect(rel(besselK(nu, x), want)).toBeLessThanOrEqual(1e-14);
  });
  it('a subnormal result keeps its leading digits: besselK(10, 730)', () => {
    expect(rel(besselK(10, 730), 4.5822396049307409e-319)).toBeLessThan(1e-9);
  });
  it('a result above the double range is Infinity, at once for a huge order', () => {
    expect(besselK(3000.5, 1300)).toBe(Infinity);
    expect(besselK(3e9, 1e9)).toBe(Infinity);
    // No loop runs: an order of 1e15 did not return with a rescaled recurrence and no gate.
    expect(besselK(1e15, 701)).toBe(Infinity);
    expect(besselK(2e8, 701)).toBe(Infinity);
  });
  it('the gate does not overflow at the smallest x or the largest order', () => {
    expect(rel(besselK(0, 5e-324), 744.55600343703967)).toBeLessThan(1e-14);
    expect(rel(besselK(0.5, 5e-324), 5.6385522612647099e161)).toBeLessThan(1e-13);
    expect(rel(besselK(0.5, 1e-310), 1.2533141373155022e155)).toBeLessThan(1e-13);
    expect(rel(besselI(-0.5, 1e-310), 7.9788456080286657e154)).toBeLessThan(1e-13);
    expect(besselK(Number.MAX_VALUE, 2)).toBe(Infinity);
    expect(besselK(1e308, 1e308)).toBe(0);
    expect(besselI(1e306, 1e-300)).toBe(0);
  });
  it('the order limit holds where the gate does not decide', () => {
    // K_3e9(1988230252) is about e^0.17: the gate leaves it to the recurrence of 3e9 steps.
    expect(() => besselK(3e9, 1988230252)).toThrow(RangeError);
  });
  it('the array form counts the work of its elements', () => {
    expect(() => besselK(2e9, new Float64Array(4).fill(1325486833))).toThrow(RangeError);
  });
});

describe('besselI of a negative real order above x = 700', () => {
  it('besselI(-2000.5, 1200) is I + (2 / pi) sin(2000.5 pi) K', () => {
    expect(rel(besselI(-2000.5, 1200), 4.4407180646615429e100)).toBeLessThanOrEqual(1e-14);
    expect(rel(besselI(-1500.25, 900), 7.6270724312162802e74)).toBeLessThanOrEqual(1e-14);
  });
  it('besselI(-3000.5, 1300) is Infinity (the K term is above the double range)', () => {
    expect(besselI(-3000.5, 1300)).toBe(Infinity);
  });
});

describe('besselJ of a real order for 1e-5 <= x < 2 (bound B4: 1e-13)', () => {
  const ROWS: Array<[number, number, number]> = [
    [37.53325087047588, 7.237015760887747e-5, 2.0770087205297865e-211],
    [12.75, 1e-5, 7.9283784455126633e-78],
    [72.81109059247217, 0.006461207061988474, 2.2405916920849473e-287],
    [5.3, 1.5, 0.00098595722103076976],
    [20.7, 0.5, 1.6849752961544719e-32],
    [0.3, 1.9, 0.47201364515549976],
  ];
  it.each(ROWS)('besselJ(%s, %s) is within 1e-13', (nu, x, want) => {
    expect(rel(besselJ(nu, x), want)).toBeLessThanOrEqual(1e-13);
  });
});

describe('a huge x', () => {
  it('besselI is Infinity, not a RangeError, and besselK is 0, not NaN', () => {
    expect(besselI(0, 1e306)).toBe(Infinity);
    expect(Array.from(besselI(0, Float64Array.of(1e306)) as Float64Array)).toEqual([Infinity]);
    expect(besselK(0, 1e308)).toBe(0);
    expect(besselK(2.5, 1.7e308)).toBe(0);
  });
  it('besselI(1e300, 1e31) stays 0 (the order is far above x)', () => {
    expect(besselI(1e300, 1e31)).toBe(0);
  });
});

describe('x = Infinity gives the limit 0 for J and Y', () => {
  it('the scalars and the general orders', () => {
    expect(besselJ0(Infinity)).toBe(0);
    expect(besselJ1(Infinity)).toBe(0);
    expect(besselY0(Infinity)).toBe(0);
    expect(besselY1(Infinity)).toBe(0);
    expect(besselJ(0.5, Infinity)).toBe(0);
    expect(besselJ(2, Infinity)).toBe(0);
    expect(besselJ(-2.5, Infinity)).toBe(0);
    expect(besselY(2.5, Infinity)).toBe(0);
    expect(besselY(3, Infinity)).toBe(0);
  });
});
