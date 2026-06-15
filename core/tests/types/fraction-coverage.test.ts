/**
 * Supplementary Fraction tests targeting previously-uncovered branches:
 * non-finite/integer factory paths, parse dispatch, scalar-argument arithmetic,
 * inverse-of-zero, pow(0), comparison aliases, integer floor/ceil, gcd(),
 * and continued-fraction round-trips.
 * @module @danielsimonjr/mathts-core/tests/types/fraction-coverage
 */

import { describe, it, expect } from 'vitest';
import { Fraction } from '../../src/types/fraction';

describe('Fraction (coverage supplement)', () => {
  describe('fromNumber', () => {
    it('throws on non-finite input', () => {
      expect(() => Fraction.fromNumber(Infinity)).toThrow();
      expect(() => Fraction.fromNumber(NaN)).toThrow();
    });
    it('returns an exact integer fraction for integer input', () => {
      const f = Fraction.fromNumber(7);
      expect(f.numerator).toBe(7n);
      expect(f.denominator).toBe(1n);
    });
    it('approximates a non-integer via continued fractions', () => {
      const f = Fraction.fromNumber(0.25);
      expect(f.numerator).toBe(1n);
      expect(f.denominator).toBe(4n);
    });
  });

  describe('parse dispatch', () => {
    it('parses a fraction string', () => {
      const f = Fraction.parse('3/4');
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(4n);
    });
    it('parses a decimal string', () => {
      expect(Fraction.parse('0.5').equals(new Fraction(1n, 2n))).toBe(true);
    });
    it('parses a repeating-decimal string', () => {
      expect(Fraction.parse('0.(3)').equals(new Fraction(1n, 3n))).toBe(true);
    });
    it('parses an integer string', () => {
      const f = Fraction.parse('5');
      expect(f.numerator).toBe(5n);
      expect(f.denominator).toBe(1n);
    });
  });

  describe('fromJSON numerator/denominator form', () => {
    it('accepts the {numerator, denominator} shape', () => {
      const f = Fraction.fromJSON({ numerator: '3', denominator: '8' });
      expect(f.numerator).toBe(3n);
      expect(f.denominator).toBe(8n);
    });
    it('accepts the {n, d} shape', () => {
      const f = Fraction.fromJSON({ n: '2', d: '5' });
      expect(f.numerator).toBe(2n);
      expect(f.denominator).toBe(5n);
    });
  });

  describe('toDecimal integer-result branch', () => {
    it('returns just the integer part when there is no remainder', () => {
      expect(new Fraction(6n, 3n).toDecimal(5)).toBe('2');
    });
    it('returns integer part when precision is 0', () => {
      expect(new Fraction(7n, 2n).toDecimal(0)).toBe('3');
    });
  });

  describe('scalar-argument arithmetic (non-Fraction Scalar)', () => {
    const scalar = { valueOf: () => 2 } as unknown as Fraction;

    it('add coerces a scalar to a Fraction', () => {
      expect(new Fraction(1n, 2n).add(scalar).equals(new Fraction(5n, 2n))).toBe(true);
    });
    it('subtract coerces a scalar to a Fraction', () => {
      expect(new Fraction(5n, 2n).subtract(scalar).equals(new Fraction(1n, 2n))).toBe(true);
    });
    it('multiply coerces a scalar to a Fraction', () => {
      expect(new Fraction(3n, 4n).multiply(scalar).equals(new Fraction(3n, 2n))).toBe(true);
    });
    it('divide coerces a scalar to a Fraction', () => {
      expect(new Fraction(3n, 2n).divide(scalar).equals(new Fraction(3n, 4n))).toBe(true);
    });
  });

  describe('inverse and division by zero', () => {
    it('throws inverting zero', () => {
      expect(() => new Fraction(0n, 1n).inverse()).toThrow();
    });
    it('throws dividing by a zero fraction', () => {
      expect(() => new Fraction(1n, 2n).divide(new Fraction(0n, 1n))).toThrow();
    });
  });

  describe('pow edge cases', () => {
    it('any fraction to the 0 power is 1', () => {
      expect(new Fraction(3n, 4n).pow(0).equals(new Fraction(1n, 1n))).toBe(true);
    });
    it('negative exponent inverts', () => {
      expect(new Fraction(2n, 3n).pow(-2).equals(new Fraction(9n, 4n))).toBe(true);
    });
    it('accepts bigint exponents', () => {
      expect(new Fraction(2n, 1n).pow(3n).equals(new Fraction(8n, 1n))).toBe(true);
    });
  });

  describe('comparison aliases', () => {
    const a = new Fraction(1n, 2n);
    const b = new Fraction(3n, 4n);
    it('lessThanOrEqual / greaterThanOrEqual', () => {
      expect(a.lessThanOrEqual(b)).toBe(true);
      expect(a.lessThanOrEqual(a)).toBe(true);
      expect(b.greaterThanOrEqual(a)).toBe(true);
    });
    it('compareTo and compare', () => {
      expect(a.compareTo(b)).toBe(-1);
      expect(b.compare(a)).toBe(1);
      expect(a.compare(a)).toBe(0);
    });
  });

  describe('integer floor/ceil short-circuit', () => {
    it('floor returns self for an integer fraction', () => {
      const f = new Fraction(5n, 1n);
      expect(f.floor()).toBe(f);
    });
    it('ceil returns self for an integer fraction', () => {
      const f = new Fraction(5n, 1n);
      expect(f.ceil()).toBe(f);
    });
    it('floor/ceil for non-integers', () => {
      expect(new Fraction(7n, 2n).floor().equals(new Fraction(3n, 1n))).toBe(true);
      expect(new Fraction(7n, 2n).ceil().equals(new Fraction(4n, 1n))).toBe(true);
      expect(new Fraction(-7n, 2n).floor().equals(new Fraction(-4n, 1n))).toBe(true);
    });
  });

  describe('gcd of a reduced fraction', () => {
    it('is always 1', () => {
      expect(new Fraction(6n, 8n).gcd()).toBe(1n);
    });
  });

  describe('continued fractions', () => {
    it('round-trips a positive fraction', () => {
      const f = new Fraction(7n, 3n);
      const cf = f.toContinuedFraction();
      expect(Fraction.fromContinuedFraction(cf).equals(f)).toBe(true);
    });
    it('handles negative fractions (negates the first term)', () => {
      const f = new Fraction(-7n, 3n);
      const cf = f.toContinuedFraction();
      expect(cf[0]).toBeLessThan(0n);
    });
    it('fromContinuedFraction of an empty list is zero', () => {
      expect(Fraction.fromContinuedFraction([]).equals(new Fraction(0n, 1n))).toBe(true);
    });
  });
});
