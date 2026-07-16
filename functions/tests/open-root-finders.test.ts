import { describe, it, expect } from 'vitest';
import { newton, secant, halley } from '../src/index.js';

describe('open root-finders', () => {
  it('newton x^2-2 -> sqrt(2) (analytic derivative)', () => {
    expect(newton((x) => x * x - 2, 1, { fprime: (x) => 2 * x })).toBeCloseTo(Math.SQRT2, 10);
  });
  it('newton with numeric derivative (no fprime)', () => {
    expect(newton((x) => Math.cos(x) - x, 0.5)).toBeCloseTo(0.7390851332151607, 8);
  });
  it('secant x^2-2 -> sqrt(2)', () => {
    expect(secant((x) => x * x - 2, 1, 2)).toBeCloseTo(Math.SQRT2, 10);
  });
  it('halley x^3-2 -> cbrt(2)', () => {
    expect(
      halley((x) => x ** 3 - 2, 1, { fprime: (x) => 3 * x * x, fprime2: (x) => 6 * x })
    ).toBeCloseTo(Math.cbrt(2), 10);
  });
  it('halley with numeric derivatives (no fprime/fprime2)', () => {
    expect(halley((x) => x ** 3 - 2, 1)).toBeCloseTo(Math.cbrt(2), 8);
  });
  it('throws on non-convergence', () => {
    expect(() => newton((x) => x * x + 1, 0, { fprime: (x) => 2 * x, maxIter: 20 })).toThrow();
  });
});
