import { describe, expect, it } from 'vitest';
import { Fraction } from '../../src/index.js';

describe('Fraction.fromNumber honours maxDenominator', () => {
  it('returns the last convergent within the cap, never one above it', () => {
    const f = Fraction.fromNumber(3.695, 64n);
    expect(f.denominator <= 64n).toBe(true);
    expect(Math.abs(f.toNumber() - 3.695)).toBeLessThan(1 / 64);
    const g = Fraction.fromNumber(0.3333333333, 64n);
    expect(g.numerator).toBe(1n);
    expect(g.denominator).toBe(3n);
  });

  it('an exactly representable number still comes back exact under the default cap', () => {
    expect(String(Fraction.fromNumber(0.5))).toBe('1/2');
    expect(String(Fraction.fromNumber(0.1))).toBe('1/10');
    expect(String(Fraction.fromNumber(-2.25))).toBe('-9/4');
  });
});
