/**
 * typed-function integration tests
 * @module @danielsimonjr/mathts-core/tests/typed/mathts-typed
 */

import { describe, it, expect } from 'vitest';
import {
  mathTyped,
  createMathTSTyped,
  MATHTS_TYPES,
  MATHTS_CONVERSIONS,
  isNumber,
  isComplex,
  isFraction,
  isBigNumber,
} from '../../src/typed/mathts-typed';
import { Complex } from '../../src/types/complex';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';

describe('typed-function integration', () => {
  describe('type test functions', () => {
    it('should identify numbers', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber('42')).toBe(false);
      expect(isNumber(new Complex(1, 2))).toBe(false);
    });

    it('should identify Complex numbers', () => {
      expect(isComplex(new Complex(1, 2))).toBe(true);
      expect(isComplex(new Complex(5, 0))).toBe(true);
      expect(isComplex(42)).toBe(false);
      expect(isComplex({ re: 1, im: 2 })).toBe(false); // Not instanceof
    });

    it('should identify Fractions', () => {
      expect(isFraction(new Fraction(1n, 2n))).toBe(true);
      expect(isFraction(new Fraction(3, 4))).toBe(true);
      expect(isFraction(0.5)).toBe(false);
      expect(isFraction({ n: 1n, d: 2n })).toBe(false); // Not instanceof
    });

    it('should identify BigNumbers', () => {
      expect(isBigNumber(BigNumber.fromNumber(123))).toBe(true);
      expect(isBigNumber(BigNumber.parse('123.456'))).toBe(true);
      expect(isBigNumber(123)).toBe(false);
      expect(isBigNumber({ d: [1], e: 0, s: 1 })).toBe(false); // Not instanceof
    });
  });

  describe('type definitions', () => {
    it('should include all MathTS-specific types', () => {
      // Note: primitive types like 'number' are built into typed-function
      const typeNames = MATHTS_TYPES.map(t => t.name);
      expect(typeNames).toContain('bigint'); // Not built into typed-function
      expect(typeNames).toContain('Complex');
      expect(typeNames).toContain('Fraction');
      expect(typeNames).toContain('BigNumber');
      expect(typeNames).toContain('Matrix');
    });

    it('should have working test functions for each type', () => {
      const bigintType = MATHTS_TYPES.find(t => t.name === 'bigint');
      const complexType = MATHTS_TYPES.find(t => t.name === 'Complex');
      const fractionType = MATHTS_TYPES.find(t => t.name === 'Fraction');
      const bigNumberType = MATHTS_TYPES.find(t => t.name === 'BigNumber');

      expect(bigintType?.test(42n)).toBe(true);
      expect(complexType?.test(new Complex(1, 2))).toBe(true);
      expect(fractionType?.test(new Fraction(1n, 2n))).toBe(true);
      expect(bigNumberType?.test(BigNumber.fromNumber(123))).toBe(true);
    });
  });

  describe('type conversions', () => {
    it('should include conversions to Complex', () => {
      const toComplexConversions = MATHTS_CONVERSIONS.filter(c => c.to === 'Complex');
      const fromTypes = toComplexConversions.map(c => c.from);
      expect(fromTypes).toContain('number');
      expect(fromTypes).toContain('Fraction');
      expect(fromTypes).toContain('BigNumber');
      expect(fromTypes).toContain('string');
    });

    it('should convert number to Complex', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'number' && c.to === 'Complex');
      const result = conversion?.convert(42);
      expect(result).toBeInstanceOf(Complex);
      expect((result as Complex).re).toBe(42);
      expect((result as Complex).im).toBe(0);
    });

    it('should convert Fraction to Complex', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'Fraction' && c.to === 'Complex');
      const fraction = new Fraction(1n, 2n);
      const result = conversion?.convert(fraction);
      expect(result).toBeInstanceOf(Complex);
      expect((result as Complex).re).toBeCloseTo(0.5);
    });

    it('should convert number to Fraction', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'number' && c.to === 'Fraction');
      const result = conversion?.convert(0.5);
      expect(result).toBeInstanceOf(Fraction);
      expect((result as Fraction).toNumber()).toBeCloseTo(0.5);
    });

    it('should convert number to BigNumber', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'number' && c.to === 'BigNumber');
      const result = conversion?.convert(123.456);
      expect(result).toBeInstanceOf(BigNumber);
      expect((result as BigNumber).valueOf()).toBeCloseTo(123.456);
    });

    it('should convert Fraction to number', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'Fraction' && c.to === 'number');
      const fraction = new Fraction(3n, 4n);
      const result = conversion?.convert(fraction);
      expect(result).toBe(0.75);
    });

    it('should convert BigNumber to number', () => {
      const conversion = MATHTS_CONVERSIONS.find(c => c.from === 'BigNumber' && c.to === 'number');
      const bn = BigNumber.fromNumber(123.456);
      const result = conversion?.convert(bn);
      expect(result).toBeCloseTo(123.456);
    });
  });

  describe('mathTyped instance', () => {
    it('should create polymorphic add function', () => {
      const add = mathTyped('add', {
        'number, number': (a: number, b: number) => a + b,
        'Complex, Complex': (a: Complex, b: Complex) => a.add(b),
        'Fraction, Fraction': (a: Fraction, b: Fraction) => a.add(b),
        'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.add(b),
      });

      // Test with numbers
      expect(add(2, 3)).toBe(5);

      // Test with Complex
      const c1 = new Complex(1, 2);
      const c2 = new Complex(3, 4);
      const cResult = add(c1, c2);
      expect(cResult).toBeInstanceOf(Complex);
      expect(cResult.re).toBe(4);
      expect(cResult.im).toBe(6);

      // Test with Fraction
      const f1 = new Fraction(1n, 4n);
      const f2 = new Fraction(1n, 2n);
      const fResult = add(f1, f2);
      expect(fResult).toBeInstanceOf(Fraction);
      expect(fResult.toNumber()).toBe(0.75);

      // Test with BigNumber
      const bn1 = BigNumber.fromNumber(100);
      const bn2 = BigNumber.fromNumber(200);
      const bnResult = add(bn1, bn2);
      expect(bnResult).toBeInstanceOf(BigNumber);
      expect(bnResult.valueOf()).toBe(300);
    });

    it('should auto-convert types when needed', () => {
      const multiply = mathTyped('multiply', {
        'number, number': (a: number, b: number) => a * b,
        'Complex, Complex': (a: Complex, b: Complex) => a.multiply(b),
      });

      // Mixed types: number is auto-converted to Complex
      const result = multiply(new Complex(2, 3), 4);
      expect(result).toBeInstanceOf(Complex);
      expect(result.re).toBe(8);  // (2+3i) * 4 = 8 + 12i
      expect(result.im).toBe(12);
    });

    it('should handle string to number conversion', () => {
      const parse = mathTyped('parse', {
        'number': (n: number) => n,
      });

      // String is auto-converted to number
      expect(parse('42')).toBe(42);
      expect(parse('3.14')).toBeCloseTo(3.14);
    });

    it('should throw on invalid conversion', () => {
      const parse = mathTyped('parse', {
        'number': (n: number) => n,
      });

      expect(() => parse('not a number')).toThrow();
    });
  });

  describe('createMathTSTyped', () => {
    it('should create isolated typed instance', () => {
      const typed1 = createMathTSTyped();
      const typed2 = createMathTSTyped();

      const fn1 = typed1('test', { 'number': () => 'fn1' });
      const fn2 = typed2('test', { 'number': () => 'fn2' });

      expect(fn1(1)).toBe('fn1');
      expect(fn2(1)).toBe('fn2');
    });

    it('should have all types available', () => {
      const myTyped = createMathTSTyped();

      const identify = myTyped('identify', {
        'number': () => 'number',
        'Complex': () => 'Complex',
        'Fraction': () => 'Fraction',
        'BigNumber': () => 'BigNumber',
      });

      expect(identify(42)).toBe('number');
      expect(identify(new Complex(1, 2))).toBe('Complex');
      expect(identify(new Fraction(1n, 2n))).toBe('Fraction');
      expect(identify(BigNumber.fromNumber(123))).toBe('BigNumber');
    });
  });

  describe('polymorphic math operations', () => {
    it('should create full arithmetic suite', () => {
      const add = mathTyped('add', {
        'number, number': (a: number, b: number) => a + b,
        'Complex, Complex': (a: Complex, b: Complex) => a.add(b),
        'Fraction, Fraction': (a: Fraction, b: Fraction) => a.add(b),
        'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.add(b),
      });

      const subtract = mathTyped('subtract', {
        'number, number': (a: number, b: number) => a - b,
        'Complex, Complex': (a: Complex, b: Complex) => a.subtract(b),
        'Fraction, Fraction': (a: Fraction, b: Fraction) => a.subtract(b),
        'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.subtract(b),
      });

      const multiply = mathTyped('multiply', {
        'number, number': (a: number, b: number) => a * b,
        'Complex, Complex': (a: Complex, b: Complex) => a.multiply(b),
        'Fraction, Fraction': (a: Fraction, b: Fraction) => a.multiply(b),
        'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.multiply(b),
      });

      const divide = mathTyped('divide', {
        'number, number': (a: number, b: number) => a / b,
        'Complex, Complex': (a: Complex, b: Complex) => a.divide(b),
        'Fraction, Fraction': (a: Fraction, b: Fraction) => a.divide(b),
        'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.divide(b),
      });

      // Test all operations with Fraction
      const half = new Fraction(1n, 2n);
      const quarter = new Fraction(1n, 4n);

      expect(add(half, quarter).toNumber()).toBe(0.75);
      expect(subtract(half, quarter).toNumber()).toBe(0.25);
      expect(multiply(half, quarter).toNumber()).toBe(0.125);
      expect(divide(half, quarter).toNumber()).toBe(2);
    });
  });
});
