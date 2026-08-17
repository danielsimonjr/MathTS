/**
 * Fraction tests
 * @module @danielsimonjr/mathts-core/tests/types/fraction
 */

import { describe, it, expect } from 'vitest';
import {
  Fraction,
  isFraction,
  FRACTION_ZERO,
  FRACTION_ONE,
  FRACTION_HALF,
  FRACTION_THIRD,
} from '../../src/types/fraction';

describe('Fraction', () => {
  describe('constructor and factory methods', () => {
    it('should create fraction with bigint', () => {
      const f = new Fraction(3n, 4n);
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
      expect(f.type).toBe('Fraction');
    });

    it('should create fraction with numbers', () => {
      const f = new Fraction(3, 4);
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });

    it('should create fraction with strings', () => {
      const f = new Fraction('3', '4');
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });

    it('should accept a Fraction argument (clone it) instead of throwing on BigInt', () => {
      // `new Fraction(frac)` must clone, not `BigInt(frac)` → lossy float → throw.
      // The Unit value-type converters rely on this for non-integer Fraction values
      // (e.g. degF's 5/9 conversion factor).
      const src = new Fraction(-160, 9);
      const clone = new Fraction(src);
      expect(clone.numerator).toBe(-160n);
      expect(clone.denominator).toBe(9n);
      expect(clone.equals(src)).toBe(true);
    });

    it('should default denominator to 1', () => {
      const f = new Fraction(5n);
      expect(f.numerator).toBe(5n);
      expect(f.denominator).toBe(1n);
    });

    it('should reduce to lowest terms automatically', () => {
      const f = new Fraction(6n, 8n);
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });

    it('should normalize sign to numerator', () => {
      const f = new Fraction(3n, -4n);
      expect(f.numerator).toBe(-3n);
      expect(f.denominator).toBe(4n);
    });

    it('should throw on zero denominator', () => {
      expect(() => new Fraction(1n, 0n)).toThrow();
    });

    it('should create from number', () => {
      const f = Fraction.fromNumber(0.5);
      expect(f.toNumber()).toBeCloseTo(0.5);
    });

    it('should create from decimal string', () => {
      const f = Fraction.fromDecimalString('0.25');
      expect(f.numerator).toBe(1n);
      expect(f.denominator).toBe(4n);
    });

    it('should parse repeating decimals', () => {
      const f = Fraction.fromDecimalString('0.(3)');
      expect(f.numerator).toBe(1n);
      expect(f.denominator).toBe(3n);
    });

    it('should parse fraction strings', () => {
      const f = Fraction.parse('3/4');
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });

    it('should create from JSON', () => {
      const f = Fraction.fromJSON({ n: '3', d: '4' });
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });
  });

  describe('type checking', () => {
    it('should identify Fraction instances', () => {
      expect(isFraction(new Fraction(1n, 2n))).toBe(true);
      expect(isFraction(FRACTION_HALF)).toBe(true);
      expect(isFraction(0.5)).toBe(false);
      expect(isFraction({})).toBe(false);
    });
  });

  describe('conversion methods', () => {
    it('should convert to string', () => {
      expect(new Fraction(3n, 4n).toString()).toBe('3/4');
      expect(new Fraction(5n, 1n).toString()).toBe('5');
      expect(new Fraction(-3n, 4n).toString()).toBe('-3/4');
    });

    it('should convert to number', () => {
      expect(new Fraction(3n, 4n).toNumber()).toBe(0.75);
      expect(new Fraction(1n, 3n).toNumber()).toBeCloseTo(1 / 3);
    });

    it('should valueOf return number', () => {
      expect(new Fraction(3n, 4n).valueOf()).toBe(0.75);
    });

    it('should convert to JSON', () => {
      const json = new Fraction(3n, 4n).toJSON();
      expect(json.mathjs).toBe('Fraction');
      expect(json.n).toBe('3');
      expect(json.d).toBe('4');
    });

    it('should convert to decimal string', () => {
      expect(new Fraction(3n, 4n).toDecimal(2)).toBe('0.75');
      expect(new Fraction(1n, 3n).toDecimal(6)).toBe('0.333333');
    });

    it('should convert to LaTeX', () => {
      expect(new Fraction(3n, 4n).toLatex()).toBe('\\frac{3}{4}');
      expect(new Fraction(5n, 1n).toLatex()).toBe('5');
      expect(new Fraction(-3n, 4n).toLatex()).toBe('-\\frac{3}{4}');
    });

    it('should convert to mixed number', () => {
      const mixed = new Fraction(7n, 3n).toMixed();
      expect(mixed.whole).toBe(2n);
      expect(mixed.numerator).toBe(1n);
      expect(mixed.denominator).toBe(3n);
    });
  });

  describe('arithmetic operations', () => {
    it('should add fractions', () => {
      const a = new Fraction(1n, 4n);
      const b = new Fraction(1n, 2n);
      const result = a.add(b);
      expect(result.numerator).toBe(3n);
      expect(result.denominator).toBe(4n);
    });

    it('should subtract fractions', () => {
      const a = new Fraction(3n, 4n);
      const b = new Fraction(1n, 2n);
      const result = a.subtract(b);
      expect(result.numerator).toBe(1n);
      expect(result.denominator).toBe(4n);
    });

    it('should multiply fractions', () => {
      const a = new Fraction(2n, 3n);
      const b = new Fraction(3n, 4n);
      const result = a.multiply(b);
      expect(result.numerator).toBe(1n);
      expect(result.denominator).toBe(2n);
    });

    it('should divide fractions', () => {
      const a = new Fraction(1n, 2n);
      const b = new Fraction(2n, 3n);
      const result = a.divide(b);
      expect(result.numerator).toBe(3n);
      expect(result.denominator).toBe(4n);
    });

    it('should negate fractions', () => {
      const f = new Fraction(3n, 4n);
      const neg = f.negate();
      expect(neg.numerator).toBe(-3n);
      expect(neg.denominator).toBe(4n);
    });

    it('should compute absolute value', () => {
      const f = new Fraction(-3n, 4n);
      const abs = f.abs();
      expect(abs.numerator).toBe(3n);
      expect(abs.denominator).toBe(4n);
    });

    it('should compute inverse', () => {
      const f = new Fraction(3n, 4n);
      const inv = f.inverse();
      expect(inv.numerator).toBe(4n);
      expect(inv.denominator).toBe(3n);
    });

    it('should compute power', () => {
      const f = new Fraction(2n, 3n);
      const pow = f.pow(3);
      expect(pow.numerator).toBe(8n);
      expect(pow.denominator).toBe(27n);
    });

    it('should compute negative power', () => {
      const f = new Fraction(2n, 3n);
      const pow = f.pow(-2);
      expect(pow.numerator).toBe(9n);
      expect(pow.denominator).toBe(4n);
    });

    it('should throw on division by zero', () => {
      expect(() => new Fraction(1n, 2n).divide(FRACTION_ZERO)).toThrow();
    });

    it('should compute modulo', () => {
      const a = new Fraction(7n, 3n);
      const b = new Fraction(2n, 1n);
      const mod = a.mod(b);
      expect(mod.toNumber()).toBeCloseTo(1 / 3);
    });
  });

  describe('comparison methods', () => {
    it('should check equality', () => {
      expect(new Fraction(1n, 2n).equals(new Fraction(2n, 4n))).toBe(true);
      expect(new Fraction(1n, 2n).equals(new Fraction(1n, 3n))).toBe(false);
    });

    it('should check less than', () => {
      expect(new Fraction(1n, 3n).lessThan(new Fraction(1n, 2n))).toBe(true);
      expect(new Fraction(1n, 2n).lessThan(new Fraction(1n, 3n))).toBe(false);
    });

    it('should check greater than', () => {
      expect(new Fraction(1n, 2n).greaterThan(new Fraction(1n, 3n))).toBe(true);
      expect(new Fraction(1n, 3n).greaterThan(new Fraction(1n, 2n))).toBe(false);
    });

    it('should compare', () => {
      expect(Fraction.compare(new Fraction(1n, 2n), new Fraction(1n, 3n))).toBe(1);
      expect(Fraction.compare(new Fraction(1n, 3n), new Fraction(1n, 2n))).toBe(-1);
      expect(Fraction.compare(new Fraction(1n, 2n), new Fraction(2n, 4n))).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should check if zero', () => {
      expect(FRACTION_ZERO.isZero()).toBe(true);
      expect(FRACTION_ONE.isZero()).toBe(false);
    });

    it('should check if positive', () => {
      expect(new Fraction(1n, 2n).isPositive()).toBe(true);
      expect(new Fraction(-1n, 2n).isPositive()).toBe(false);
      expect(FRACTION_ZERO.isPositive()).toBe(false);
    });

    it('should check if negative', () => {
      expect(new Fraction(-1n, 2n).isNegative()).toBe(true);
      expect(new Fraction(1n, 2n).isNegative()).toBe(false);
    });

    it('should check if integer', () => {
      expect(new Fraction(6n, 1n).isInteger()).toBe(true);
      expect(new Fraction(6n, 2n).isInteger()).toBe(true); // 6/2 reduces to 3/1
      expect(new Fraction(5n, 2n).isInteger()).toBe(false); // 5/2 cannot reduce
    });

    it('should check if unit fraction', () => {
      expect(new Fraction(1n, 5n).isUnit()).toBe(true);
      expect(new Fraction(-1n, 5n).isUnit()).toBe(true);
      expect(new Fraction(2n, 5n).isUnit()).toBe(false);
    });

    it('should floor', () => {
      expect(new Fraction(7n, 3n).floor().toNumber()).toBe(2);
      expect(new Fraction(-7n, 3n).floor().toNumber()).toBe(-3);
    });

    it('should ceil', () => {
      expect(new Fraction(7n, 3n).ceil().toNumber()).toBe(3);
      expect(new Fraction(-7n, 3n).ceil().toNumber()).toBe(-2);
    });

    it('should round', () => {
      expect(new Fraction(5n, 3n).round().toNumber()).toBe(2); // 1.666... rounds to 2
      expect(new Fraction(4n, 3n).round().toNumber()).toBe(1); // 1.333... rounds to 1
    });

    it('should truncate', () => {
      expect(new Fraction(7n, 3n).trunc().toNumber()).toBe(2);
      expect(new Fraction(-7n, 3n).trunc().toNumber()).toBe(-2);
    });

    it('should get sign', () => {
      expect(new Fraction(3n, 4n).sign()).toBe(1);
      expect(new Fraction(-3n, 4n).sign()).toBe(-1);
      expect(FRACTION_ZERO.sign()).toBe(0);
    });

    it('should clone', () => {
      const f = new Fraction(3n, 4n);
      const clone = f.clone();
      expect(clone.numerator).toBe(3n);
      expect(clone.denominator).toBe(4n);
      expect(clone).not.toBe(f);
    });

    it('should simplify (no-op since already reduced)', () => {
      const f = new Fraction(3n, 4n);
      expect(f.simplify()).toBe(f);
    });
  });

  describe('continued fractions', () => {
    it('should convert to continued fraction', () => {
      const cf = new Fraction(3n, 8n).toContinuedFraction();
      expect(cf).toEqual([0n, 2n, 1n, 2n]);
    });

    it('should create from continued fraction', () => {
      const f = Fraction.fromContinuedFraction([0n, 2n, 1n, 2n]);
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(8n);
    });
  });

  describe('mediant', () => {
    it('should compute mediant', () => {
      const a = new Fraction(1n, 3n);
      const b = new Fraction(1n, 2n);
      const med = a.mediant(b);
      expect(med.numerator).toBe(2n);
      expect(med.denominator).toBe(5n);
    });
  });

  describe('constants', () => {
    it('should have correct zero', () => {
      expect(FRACTION_ZERO.numerator).toBe(0n);
      expect(FRACTION_ZERO.denominator).toBe(1n);
    });

    it('should have correct one', () => {
      expect(FRACTION_ONE.numerator).toBe(1n);
      expect(FRACTION_ONE.denominator).toBe(1n);
    });

    it('should have correct half', () => {
      expect(FRACTION_HALF.numerator).toBe(1n);
      expect(FRACTION_HALF.denominator).toBe(2n);
    });

    it('should have correct third', () => {
      expect(FRACTION_THIRD.numerator).toBe(1n);
      expect(FRACTION_THIRD.denominator).toBe(3n);
    });
  });
});

describe('Fraction: non-integer number constructor (regression)', () => {
  // Regression: `new Fraction(0.25)` previously called BigInt(0.25) and threw
  // "cannot be converted to a BigInt", which broke the CAS simplify/derivative for
  // any fractional coefficient (e.g. derivative('x^4/4','x')). The constructor now
  // decomposes non-integer numbers into an exact integer ratio.
  it('constructs an exact ratio from a non-integer number', () => {
    expect(new Fraction(0.25).toString()).toBe('1/4');
    expect(new Fraction(0.5).toString()).toBe('1/2');
    expect(new Fraction(-0.75).toString()).toBe('-3/4');
  });

  it('handles non-integer numerator and denominator together', () => {
    expect(new Fraction(0.25, 0.5).toString()).toBe('1/2');
    expect(new Fraction(1.5, 0.5).toString()).toBe('3'); // 1.5 / 0.5 = 3
  });

  it('leaves integer and bigint construction unchanged', () => {
    expect(new Fraction(3, 4).toString()).toBe('3/4');
    expect(new Fraction(3n, 4n).toString()).toBe('3/4');
    expect(new Fraction(6, 4).toString()).toBe('3/2'); // reduces
  });
});

describe('Fraction constructor hot path', () => {
  it('adds same-denominator fractions without inflating the denominator', () => {
    const r = new Fraction(1n, 6n).add(new Fraction(5n, 6n));
    expect(r.numerator).toBe(1n);
    expect(r.denominator).toBe(1n);
  });

  it('keeps mixed-sign multiply and divide reduced', () => {
    const prod = new Fraction(-2n, 3n).multiply(new Fraction(3n, 4n));
    expect(prod.numerator).toBe(-1n);
    expect(prod.denominator).toBe(2n);
    const quot = new Fraction(-2n, 3n).divide(new Fraction(-4n, 9n));
    expect(quot.numerator).toBe(3n);
    expect(quot.denominator).toBe(2n);
  });

  it('accepts mixed integer number/bigint constructor arguments', () => {
    expect(new Fraction(5).toString()).toBe('5');
    expect(new Fraction(3n, 4).toString()).toBe('3/4');
    expect(new Fraction(6, 8n).toString()).toBe('3/4');
  });
});
