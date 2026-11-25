import { describe, expect, it } from 'vitest';
import { Fraction, rationalPow } from '../../src/types/fraction.js';

describe('rationalPow (#1551)', () => {
  it('keeps integer exponents on the integer path', () => {
    expect(
      rationalPow(new Fraction(2n, 3n), new Fraction(3n, 1n))?.equals(new Fraction(8n, 27n))
    ).toBe(true);
    expect(
      rationalPow(new Fraction(2n, 3n), new Fraction(-1n, 1n))?.equals(new Fraction(3n, 2n))
    ).toBe(true);
  });

  it('extracts exact integer roots', () => {
    expect(rationalPow(new Fraction(8n), new Fraction(1n, 3n))?.equals(new Fraction(2n))).toBe(
      true
    );
    expect(rationalPow(new Fraction(4n), new Fraction(1n, 2n))?.equals(new Fraction(2n))).toBe(
      true
    );
    expect(rationalPow(new Fraction(8n), new Fraction(2n, 3n))?.equals(new Fraction(4n))).toBe(
      true
    );
    expect(rationalPow(new Fraction(-8n), new Fraction(1n, 3n))?.equals(new Fraction(-2n))).toBe(
      true
    );
    expect(
      rationalPow(new Fraction(9n, 4n), new Fraction(1n, 2n))?.equals(new Fraction(3n, 2n))
    ).toBe(true);
  });

  it('returns null when the result is not a real rational', () => {
    expect(rationalPow(new Fraction(2n), new Fraction(1n, 2n))).toBeNull();
    expect(rationalPow(new Fraction(-4n), new Fraction(1n, 2n))).toBeNull();
  });
});
