import { describe, expect, it } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { config, factory_pow, fraction, pow, runWithConfig } from '../src/index.js';

describe('#1551 Fraction rational pow (native factory)', () => {
  it('returns an exact Fraction when the power is rational', () => {
    const eight = fraction(8) as Fraction;
    const third = fraction(1, 3) as Fraction;
    const twoThirds = fraction(2, 3) as Fraction;
    const four = fraction(4) as Fraction;
    const half = fraction(1, 2) as Fraction;
    const negEight = fraction(-8) as Fraction;

    expect(String(pow(eight, third))).toBe(String(new Fraction(2n, 1n)));
    expect(String(factory_pow(eight, third))).toBe(String(new Fraction(2n, 1n)));
    expect(String(pow(eight, twoThirds))).toBe(String(new Fraction(4n, 1n)));
    expect(String(pow(four, half))).toBe(String(new Fraction(2n, 1n)));
    expect(String(pow(negEight, third))).toBe(String(new Fraction(-2n, 1n)));
    expect(String(pow(fraction(9, 4), half))).toBe(String(new Fraction(3n, 2n)));
  });

  it('falls back to the principal complex root when the result is not real-rational', () => {
    const got = factory_pow(fraction(-4), fraction(1, 2));
    expect(got).toBeInstanceOf(Complex);
    expect((got as Complex).re).toBeCloseTo(0, 12);
    expect((got as Complex).im).toBeCloseTo(2, 12);
  });

  it('throws in predictable mode when the result is not a Fraction', () => {
    expect(config().predictable).toBe(false);
    expect(() =>
      runWithConfig({ predictable: true }, () => factory_pow(fraction(2), fraction(1, 2)))
    ).toThrow(/non-rational/);
  });
});
