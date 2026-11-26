import { describe, it, expect } from 'vitest';
import { Fraction, Complex } from '../src/index.js';

/**
 * Regression tests for the G02 native fixes (#1550): the Fraction and Complex
 * rounding methods must honor the `places` / `decimals` argument the way
 * mathjs 15.3.0 does. Before the fix, `ceil`/`floor` silently ignored the
 * argument (`ceil(fraction(1,3), 2)` was `1/1`, not `17/50`).
 */

describe('Fraction.ceil / Fraction.floor with places (#1550)', () => {
  it('ceil to places matches fraction.js', () => {
    expect(new Fraction(1n, 3n).ceil(2)).toMatchObject({ numerator: 17n, denominator: 50n });
    expect(new Fraction(2n, 3n).ceil(2)).toMatchObject({ numerator: 67n, denominator: 100n });
    expect(new Fraction(4n, 3n).ceil(2)).toMatchObject({ numerator: 67n, denominator: 50n });
  });

  it('floor to places matches fraction.js', () => {
    expect(new Fraction(1n, 3n).floor(2)).toMatchObject({ numerator: 33n, denominator: 100n });
    expect(new Fraction(2n, 3n).floor(2)).toMatchObject({ numerator: 33n, denominator: 50n });
    expect(new Fraction(-1n, 3n).floor(2)).toMatchObject({ numerator: -17n, denominator: 50n });
  });

  it('ceil of a negative rounds toward +infinity', () => {
    expect(new Fraction(-1n, 3n).ceil(2)).toMatchObject({ numerator: -33n, denominator: 100n });
    expect(new Fraction(-1n, 3n).ceil()).toMatchObject({ numerator: 0n, denominator: 1n });
    expect(new Fraction(-4n, 3n).ceil()).toMatchObject({ numerator: -1n, denominator: 1n });
  });

  it('the zero-places forms are unchanged', () => {
    expect(new Fraction(4n, 3n).ceil()).toMatchObject({ numerator: 2n, denominator: 1n });
    expect(new Fraction(4n, 3n).floor()).toMatchObject({ numerator: 1n, denominator: 1n });
    expect(new Fraction(-4n, 3n).ceil()).toMatchObject({ numerator: -1n, denominator: 1n });
    expect(new Fraction(-4n, 3n).floor()).toMatchObject({ numerator: -2n, denominator: 1n });
    expect(new Fraction(6n, 3n).ceil()).toMatchObject({ numerator: 2n, denominator: 1n });
    expect(new Fraction(6n, 3n).floor()).toMatchObject({ numerator: 2n, denominator: 1n });
  });

  it('a negative places count throws, as fraction.js and mathjs do', () => {
    expect(() => new Fraction(1234n, 1n).floor(-2)).toThrow(RangeError);
    expect(() => new Fraction(1250n, 1n).ceil(-2)).toThrow(RangeError);
  });

  it('a non-integer, NaN, or infinite places count throws, as fraction.js does', () => {
    // fraction.js: `10n ** BigInt(places || 0)` — BigInt rejects a non-integer
    // with RangeError (including 1.5, NaN, and ±Infinity).
    expect(() => new Fraction(1n, 3n).ceil(1.5)).toThrow(RangeError);
    expect(() => new Fraction(1n, 3n).floor(Number.NaN)).toThrow(RangeError);
    expect(() => new Fraction(1n, 3n).ceil(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => new Fraction(1n, 3n).floor(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('places=0 is the integer bound even when passed explicitly', () => {
    expect(new Fraction(1n, 3n).ceil(0)).toMatchObject({ numerator: 1n, denominator: 1n });
    expect(new Fraction(1n, 3n).floor(0)).toMatchObject({ numerator: 0n, denominator: 1n });
    expect(new Fraction(-1n, 3n).ceil(0)).toMatchObject({ numerator: 0n, denominator: 1n });
    expect(new Fraction(-1n, 3n).floor(0)).toMatchObject({ numerator: -1n, denominator: 1n });
  });
});

describe('Complex.ceil / Complex.floor with decimals (#1550)', () => {
  it('ceil to decimals scales both parts', () => {
    const c = new Complex(3.1415, -2.7182).ceil(2);
    expect(c.re).toBeCloseTo(3.15, 12);
    expect(c.im).toBeCloseTo(-2.71, 12);
  });

  it('floor to decimals scales both parts', () => {
    const c = new Complex(3.1415, -2.7182).floor(2);
    expect(c.re).toBeCloseTo(3.14, 12);
    expect(c.im).toBeCloseTo(-2.72, 12);
  });

  it('a fractional decimals count scales by 10^n, as in mathjs', () => {
    const c = new Complex(1, 2).ceil(0.5);
    expect(c.re).toBeCloseTo(Math.ceil(Math.pow(10, 0.5)) / Math.pow(10, 0.5), 12);
  });

  it('a negative decimals count scales down, as in mathjs', () => {
    const c = new Complex(1, 2).ceil(-3);
    expect(c.re).toBe(1000);
    expect(c.im).toBe(1000);
  });

  it('the zero-decimals forms are unchanged', () => {
    expect(new Complex(1.5, -2.5).ceil().re).toBe(2);
    expect(new Complex(1.5, -2.5).ceil().im).toBe(-2);
    expect(new Complex(1.5, -2.5).floor().re).toBe(1);
    expect(new Complex(1.5, -2.5).floor().im).toBe(-3);
  });

  it('decimals=0 passed explicitly matches the no-argument form', () => {
    const a = new Complex(1.5, -2.5);
    expect(a.ceil(0).re).toBe(a.ceil().re);
    expect(a.ceil(0).im).toBe(a.ceil().im);
    expect(a.floor(0).re).toBe(a.floor().re);
    expect(a.floor(0).im).toBe(a.floor().im);
  });

  it('NaN and Infinity decimals follow complex.js (scale by 10^n)', () => {
    const nanCeil = new Complex(1.5, -2.5).ceil(Number.NaN);
    expect(Number.isNaN(nanCeil.re)).toBe(true);
    expect(Number.isNaN(nanCeil.im)).toBe(true);
    const infFloor = new Complex(1.5, -2.5).floor(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(infFloor.re)).toBe(true);
    expect(Number.isNaN(infFloor.im)).toBe(true);
  });
});
