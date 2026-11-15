import { describe, expect, it } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { corr, mad, median, sqrt } from '../src/index.js';

describe('#1044 sqrt of a Fraction keeps the real domain', () => {
  it('returns a number for a non-negative Fraction', () => {
    expect(sqrt(new Fraction(1, 4))).toBe(0.5);
    expect(sqrt(new Fraction(0, 1))).toBe(0);
    expect(sqrt(new Fraction(2, 1))).toBe(Math.SQRT2);
  });

  it('returns a Complex for a negative Fraction, as for a negative number', () => {
    const r = sqrt(new Fraction(-1, 4));
    expect(r).toBeInstanceOf(Complex);
    expect((r as Complex).re).toBe(0);
    expect((r as Complex).im).toBe(0.5);
  });

  it('median, corr and mad of Fractions do not return a Complex', () => {
    const m = median([new Fraction(1, 3), new Fraction(1, 6)]);
    expect(m).not.toBeInstanceOf(Complex);
    expect(m).toBeInstanceOf(Fraction);
    expect(Number(m)).toBe(0.25);
    const c = corr(
      [new Fraction(1, 1), new Fraction(2, 1), new Fraction(4, 1)],
      [new Fraction(1, 1), new Fraction(3, 1), new Fraction(3, 1)]
    );
    expect(c).not.toBeInstanceOf(Complex);
    expect(mad([new Fraction(1, 1), new Fraction(2, 1), new Fraction(4, 1)])).not.toBeInstanceOf(
      Complex
    );
  });
});
