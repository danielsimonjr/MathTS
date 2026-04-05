/**
 * Tests for typed arithmetic functions
 */

import { describe, it, expect } from 'vitest';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import {
  add,
  subtract,
  multiply,
  divide,
  unaryMinus,
  abs,
  pow,
  sqrt,
  square,
  exp,
  log,
  round,
  floor,
  ceil,
  mod,
  gcd,
  lcm,
  equal,
  smaller,
  larger,
  min,
  max,
} from '../src/index.js';

describe('Typed Arithmetic Functions', () => {
  describe('Basic operations with numbers', () => {
    it('should add numbers', () => {
      expect(add(1, 2)).toBe(3);
      expect(add(1.5, 2.5)).toBe(4);
      expect(add(-1, 1)).toBe(0);
    });

    it('should subtract numbers', () => {
      expect(subtract(5, 3)).toBe(2);
      expect(subtract(1, 5)).toBe(-4);
    });

    it('should multiply numbers', () => {
      expect(multiply(3, 4)).toBe(12);
      expect(multiply(-2, 3)).toBe(-6);
    });

    it('should divide numbers', () => {
      expect(divide(10, 2)).toBe(5);
      expect(divide(7, 2)).toBe(3.5);
    });

    it('should negate numbers', () => {
      expect(unaryMinus(5)).toBe(-5);
      expect(unaryMinus(-3)).toBe(3);
    });

    it('should compute absolute value', () => {
      expect(abs(-5)).toBe(5);
      expect(abs(5)).toBe(5);
    });
  });

  describe('Operations with Complex numbers', () => {
    const c1 = new Complex(1, 2);
    const c2 = new Complex(3, 4);

    it('should add complex numbers', () => {
      const result = add(c1, c2) as Complex;
      expect(result.re).toBe(4);
      expect(result.im).toBe(6);
    });

    it('should subtract complex numbers', () => {
      const result = subtract(c1, c2) as Complex;
      expect(result.re).toBe(-2);
      expect(result.im).toBe(-2);
    });

    it('should multiply complex numbers', () => {
      const result = multiply(c1, c2) as Complex;
      // (1+2i)(3+4i) = 3 + 4i + 6i + 8i² = 3 + 10i - 8 = -5 + 10i
      expect(result.re).toBe(-5);
      expect(result.im).toBe(10);
    });

    it('should add number and complex', () => {
      const result = add(5, c1) as Complex;
      expect(result.re).toBe(6);
      expect(result.im).toBe(2);
    });
  });

  describe('Operations with Fractions', () => {
    const f1 = new Fraction(1n, 2n);
    const f2 = new Fraction(1n, 3n);

    it('should add fractions', () => {
      const result = add(f1, f2) as Fraction;
      // 1/2 + 1/3 = 5/6
      expect(result.numerator).toBe(5n);
      expect(result.denominator).toBe(6n);
    });

    it('should subtract fractions', () => {
      const result = subtract(f1, f2) as Fraction;
      // 1/2 - 1/3 = 1/6
      expect(result.numerator).toBe(1n);
      expect(result.denominator).toBe(6n);
    });

    it('should multiply fractions', () => {
      const result = multiply(f1, f2) as Fraction;
      // 1/2 * 1/3 = 1/6
      expect(result.numerator).toBe(1n);
      expect(result.denominator).toBe(6n);
    });

    it('should divide fractions', () => {
      const result = divide(f1, f2) as Fraction;
      // (1/2) / (1/3) = 3/2
      expect(result.numerator).toBe(3n);
      expect(result.denominator).toBe(2n);
    });
  });

  describe('Operations with BigNumber', () => {
    const b1 = BigNumber.fromNumber(10);
    const b2 = BigNumber.fromNumber(3);

    it('should add BigNumbers', () => {
      const result = add(b1, b2) as BigNumber;
      expect(result.valueOf()).toBe(13);
    });

    it('should subtract BigNumbers', () => {
      const result = subtract(b1, b2) as BigNumber;
      expect(result.valueOf()).toBe(7);
    });

    it('should multiply BigNumbers', () => {
      const result = multiply(b1, b2) as BigNumber;
      expect(result.valueOf()).toBe(30);
    });

    it('should divide BigNumbers', () => {
      const result = divide(b1, b2) as BigNumber;
      expect(result.valueOf()).toBeCloseTo(10 / 3, 10);
    });
  });

  describe('Power and root operations', () => {
    it('should compute power', () => {
      expect(pow(2, 3)).toBe(8);
      expect(pow(2, 0)).toBe(1);
      expect(pow(2, -1)).toBe(0.5);
    });

    it('should compute square root', () => {
      expect(sqrt(4)).toBe(2);
      expect(sqrt(9)).toBe(3);
    });

    it('should return complex for sqrt of negative', () => {
      const result = sqrt(-4);
      expect(result).toBeInstanceOf(Complex);
      expect((result as Complex).im).toBe(2);
    });

    it('should compute square', () => {
      expect(square(3)).toBe(9);
      expect(square(-4)).toBe(16);
    });
  });

  describe('Exponential and logarithmic', () => {
    it('should compute exp', () => {
      expect(exp(0)).toBe(1);
      expect(exp(1)).toBeCloseTo(Math.E, 10);
    });

    it('should compute natural log', () => {
      expect(log(1)).toBe(0);
      expect(log(Math.E)).toBeCloseTo(1, 10);
    });
  });

  describe('Rounding operations', () => {
    it('should round numbers', () => {
      expect(round(2.4)).toBe(2);
      expect(round(2.5)).toBe(3);
      expect(round(2.6)).toBe(3);
    });

    it('should floor numbers', () => {
      expect(floor(2.9)).toBe(2);
      expect(floor(-2.1)).toBe(-3);
    });

    it('should ceil numbers', () => {
      expect(ceil(2.1)).toBe(3);
      expect(ceil(-2.9)).toBe(-2);
    });
  });

  describe('Modular operations', () => {
    it('should compute mod', () => {
      expect(mod(7, 3)).toBe(1);
      expect(mod(-7, 3)).toBe(2); // Always positive
    });

    it('should compute gcd', () => {
      expect(gcd(12, 8)).toBe(4);
      expect(gcd(15, 5)).toBe(5);
      expect(gcd(17, 13)).toBe(1);
    });

    it('should compute lcm', () => {
      expect(lcm(4, 6)).toBe(12);
      expect(lcm(3, 5)).toBe(15);
    });
  });

  describe('Comparison operations', () => {
    it('should check equality', () => {
      expect(equal(5, 5)).toBe(true);
      expect(equal(5, 6)).toBe(false);
    });

    it('should check smaller', () => {
      expect(smaller(3, 5)).toBe(true);
      expect(smaller(5, 3)).toBe(false);
      expect(smaller(5, 5)).toBe(false);
    });

    it('should check larger', () => {
      expect(larger(5, 3)).toBe(true);
      expect(larger(3, 5)).toBe(false);
    });
  });

  describe('Min/max operations', () => {
    it('should find minimum', () => {
      expect(min(3, 5)).toBe(3);
      expect(min(-1, -5)).toBe(-5);
    });

    it('should find maximum', () => {
      expect(max(3, 5)).toBe(5);
      expect(max(-1, -5)).toBe(-1);
    });

    it('should find min of array', () => {
      expect(min([3, 1, 4, 1, 5])).toBe(1);
    });

    it('should find max of array', () => {
      expect(max([3, 1, 4, 1, 5])).toBe(5);
    });
  });

  describe('bigint operations', () => {
    it('should add bigints', () => {
      expect(add(10n, 20n)).toBe(30n);
    });

    it('should multiply bigints', () => {
      expect(multiply(10n, 20n)).toBe(200n);
    });

    it('should compute gcd of bigints', () => {
      expect(gcd(24n, 36n)).toBe(12n);
    });
  });
});
