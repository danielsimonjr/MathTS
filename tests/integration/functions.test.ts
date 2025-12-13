/**
 * Integration tests for MathTS functions
 * Sprint 25: Main Package Assembly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Complex,
  Fraction,
  BigNumber,
  isComplex,
} from '@mathts/core';
import {
  add,
  subtract,
  multiply,
  divide,
  abs,
  sqrt,
  pow,
  exp,
  log,
  sin,
  cos,
  tan,
  sum,
  mean,
  min,
  max,
  gcd,
  lcm,
  round,
  floor,
  ceil,
  mod,
  equal,
  smaller,
  larger,
  compare,
  initializePool,
  terminatePool,
} from '@mathts/functions';

describe('MathTS Functions Integration', () => {
  beforeAll(async () => {
    // Initialize worker pool for parallel operations
    await initializePool();
  });

  afterAll(async () => {
    // Clean up worker pool
    await terminatePool();
  });

  describe('Arithmetic Operations', () => {
    describe('add', () => {
      it('should add numbers', () => {
        expect(add(2, 3)).toBe(5);
        expect(add(-1, 1)).toBe(0);
        expect(add(0.1, 0.2)).toBeCloseTo(0.3);
      });

      it('should add Complex numbers', () => {
        const a = new Complex(1, 2);
        const b = new Complex(3, 4);
        const result = add(a, b);
        expect(isComplex(result)).toBe(true);
        expect(result.re).toBe(4);
        expect(result.im).toBe(6);
      });

      it('should add Fractions', () => {
        const a = new Fraction(1, 2);
        const b = new Fraction(1, 3);
        const result = add(a, b);
        expect(result.numerator).toBe(5n);
        expect(result.denominator).toBe(6n);
      });

      it('should add BigNumbers', () => {
        const a = BigNumber.parse('0.1');
        const b = BigNumber.parse('0.2');
        const result = add(a, b);
        expect(result.toString()).toBe('0.3');
      });

      it('should handle mixed types (number + Complex)', () => {
        const a = 2;
        const b = new Complex(3, 4);
        const result = add(a, b);
        expect(isComplex(result)).toBe(true);
        expect(result.re).toBe(5);
        expect(result.im).toBe(4);
      });

      // TODO: Variadic addition requires typed-function@3.x with proper rest parameter support
      it.skip('should support variadic addition', () => {
        expect(add(1, 2, 3, 4, 5)).toBe(15);
      });
    });

    describe('subtract', () => {
      it('should subtract numbers', () => {
        expect(subtract(5, 3)).toBe(2);
        expect(subtract(1, 1)).toBe(0);
      });

      it('should subtract Complex numbers', () => {
        const a = new Complex(5, 6);
        const b = new Complex(2, 3);
        const result = subtract(a, b);
        expect(result.re).toBe(3);
        expect(result.im).toBe(3);
      });
    });

    describe('multiply', () => {
      it('should multiply numbers', () => {
        expect(multiply(2, 3)).toBe(6);
        expect(multiply(-2, 3)).toBe(-6);
        expect(multiply(0, 100)).toBe(0);
      });

      it('should multiply Complex numbers', () => {
        const a = new Complex(1, 2);
        const b = new Complex(3, 4);
        const result = multiply(a, b);
        // (1 + 2i)(3 + 4i) = 3 + 4i + 6i + 8i² = 3 + 10i - 8 = -5 + 10i
        expect(result.re).toBe(-5);
        expect(result.im).toBe(10);
      });

      it('should multiply Fractions', () => {
        const a = new Fraction(1, 2);
        const b = new Fraction(2, 3);
        const result = multiply(a, b);
        expect(result.numerator).toBe(1n);
        expect(result.denominator).toBe(3n);
      });
    });

    describe('divide', () => {
      it('should divide numbers', () => {
        expect(divide(6, 2)).toBe(3);
        expect(divide(5, 2)).toBe(2.5);
      });

      it('should handle division by zero', () => {
        expect(divide(1, 0)).toBe(Infinity);
        expect(divide(-1, 0)).toBe(-Infinity);
      });

      it('should divide Fractions exactly', () => {
        const a = new Fraction(1, 2);
        const b = new Fraction(3, 4);
        const result = divide(a, b);
        // (1/2) / (3/4) = (1/2) * (4/3) = 4/6 = 2/3
        expect(result.numerator).toBe(2n);
        expect(result.denominator).toBe(3n);
      });
    });
  });

  describe('Unary Operations', () => {
    describe('abs', () => {
      it('should compute absolute value of numbers', () => {
        expect(abs(-5)).toBe(5);
        expect(abs(5)).toBe(5);
        expect(abs(0)).toBe(0);
      });

      it('should compute magnitude of Complex numbers', () => {
        const c = new Complex(3, 4);
        expect(abs(c)).toBe(5); // |3 + 4i| = 5
      });
    });

    describe('sqrt', () => {
      it('should compute square root of positive numbers', () => {
        expect(sqrt(4)).toBe(2);
        expect(sqrt(9)).toBe(3);
        expect(sqrt(2)).toBeCloseTo(Math.sqrt(2));
      });

      it('should return Complex for negative numbers', () => {
        const result = sqrt(-4);
        expect(isComplex(result)).toBe(true);
        expect(result.re).toBeCloseTo(0);
        expect(result.im).toBeCloseTo(2);
      });
    });

    describe('pow', () => {
      it('should compute powers', () => {
        expect(pow(2, 3)).toBe(8);
        expect(pow(3, 2)).toBe(9);
        expect(pow(2, 0)).toBe(1);
        expect(pow(2, -1)).toBe(0.5);
      });

      it('should compute Complex powers', () => {
        const c = new Complex(0, 1); // i
        const result = pow(c, 2);
        // i² = -1
        expect(result.re).toBeCloseTo(-1);
        expect(result.im).toBeCloseTo(0);
      });
    });
  });

  describe('Exponential and Logarithmic', () => {
    describe('exp', () => {
      it('should compute e^x', () => {
        expect(exp(0)).toBe(1);
        expect(exp(1)).toBeCloseTo(Math.E);
        expect(exp(2)).toBeCloseTo(Math.E ** 2);
      });
    });

    describe('log', () => {
      it('should compute natural logarithm', () => {
        expect(log(1)).toBe(0);
        expect(log(Math.E)).toBeCloseTo(1);
        expect(log(10)).toBeCloseTo(Math.log(10));
      });

      it('should compute logarithm with base', () => {
        expect(log(8, 2)).toBeCloseTo(3); // log₂(8) = 3
        expect(log(100, 10)).toBeCloseTo(2); // log₁₀(100) = 2
      });
    });
  });

  describe('Trigonometric Functions', () => {
    describe('sin', () => {
      it('should compute sine', () => {
        expect(sin(0)).toBe(0);
        expect(sin(Math.PI / 2)).toBeCloseTo(1);
        expect(sin(Math.PI)).toBeCloseTo(0);
      });
    });

    describe('cos', () => {
      it('should compute cosine', () => {
        expect(cos(0)).toBe(1);
        expect(cos(Math.PI / 2)).toBeCloseTo(0);
        expect(cos(Math.PI)).toBeCloseTo(-1);
      });
    });

    describe('tan', () => {
      it('should compute tangent', () => {
        expect(tan(0)).toBe(0);
        expect(tan(Math.PI / 4)).toBeCloseTo(1);
      });
    });
  });

  describe('Rounding Operations', () => {
    describe('round', () => {
      it('should round to nearest integer', () => {
        expect(round(1.4)).toBe(1);
        expect(round(1.5)).toBe(2);
        expect(round(1.6)).toBe(2);
        expect(round(-1.4)).toBe(-1);
      });

      it('should round to specified decimals', () => {
        expect(round(3.14159, 2)).toBeCloseTo(3.14);
        expect(round(3.14159, 3)).toBeCloseTo(3.142);
      });
    });

    describe('floor', () => {
      it('should floor numbers', () => {
        expect(floor(1.9)).toBe(1);
        expect(floor(-1.1)).toBe(-2);
      });
    });

    describe('ceil', () => {
      it('should ceil numbers', () => {
        expect(ceil(1.1)).toBe(2);
        expect(ceil(-1.9)).toBe(-1);
      });
    });
  });

  describe('Modular Arithmetic', () => {
    describe('mod', () => {
      it('should compute modulo', () => {
        expect(mod(5, 3)).toBe(2);
        expect(mod(10, 5)).toBe(0);
      });

      it('should handle negative numbers correctly', () => {
        // mod always returns non-negative for positive divisor
        expect(mod(-5, 3)).toBe(1); // (-5 % 3 + 3) % 3 = 1
      });
    });

    describe('gcd', () => {
      it('should compute greatest common divisor', () => {
        expect(gcd(12, 8)).toBe(4);
        expect(gcd(17, 5)).toBe(1); // coprime
        expect(gcd(100, 25)).toBe(25);
      });

      it('should handle bigint', () => {
        expect(gcd(12n, 8n)).toBe(4n);
      });
    });

    describe('lcm', () => {
      it('should compute least common multiple', () => {
        expect(lcm(4, 6)).toBe(12);
        expect(lcm(3, 5)).toBe(15);
        expect(lcm(12, 8)).toBe(24);
      });
    });
  });

  describe('Comparison Operations', () => {
    describe('equal', () => {
      it('should check equality', () => {
        expect(equal(5, 5)).toBe(true);
        expect(equal(5, 6)).toBe(false);
      });

      it('should compare Complex numbers', () => {
        const a = new Complex(1, 2);
        const b = new Complex(1, 2);
        const c = new Complex(1, 3);
        expect(equal(a, b)).toBe(true);
        expect(equal(a, c)).toBe(false);
      });
    });

    describe('smaller and larger', () => {
      it('should compare numbers', () => {
        expect(smaller(3, 5)).toBe(true);
        expect(smaller(5, 3)).toBe(false);
        expect(larger(5, 3)).toBe(true);
        expect(larger(3, 5)).toBe(false);
      });
    });

    describe('compare', () => {
      it('should return -1, 0, or 1', () => {
        expect(compare(3, 5)).toBe(-1);
        expect(compare(5, 5)).toBe(0);
        expect(compare(5, 3)).toBe(1);
      });
    });
  });

  describe('Statistical Operations', () => {
    describe('sum', () => {
      it('should sum arrays', () => {
        expect(sum([1, 2, 3, 4, 5])).toBe(15);
        expect(sum([0.1, 0.2, 0.3])).toBeCloseTo(0.6);
      });
    });

    describe('mean', () => {
      it('should compute mean of arrays', () => {
        expect(mean([1, 2, 3, 4, 5])).toBe(3);
        expect(mean([10, 20])).toBe(15);
      });

      it('should return NaN for empty arrays', () => {
        expect(mean([])).toBeNaN();
      });
    });

    describe('min and max', () => {
      it('should find minimum', () => {
        expect(min([3, 1, 4, 1, 5])).toBe(1);
        expect(min(3, 1, 4)).toBe(1);
      });

      it('should find maximum', () => {
        expect(max([3, 1, 4, 1, 5])).toBe(5);
        expect(max(3, 1, 4)).toBe(4);
      });
    });
  });

  describe('Parallel Array Operations', () => {
    it('should add Float64Arrays in parallel', async () => {
      const a = new Float64Array([1, 2, 3, 4, 5]);
      const b = new Float64Array([5, 4, 3, 2, 1]);
      const result = await add(a, b);
      expect(result).toBeInstanceOf(Float64Array);
      expect(Array.from(result)).toEqual([6, 6, 6, 6, 6]);
    });

    it('should multiply Float64Arrays in parallel', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([2, 2, 2]);
      const result = await multiply(a, b);
      expect(Array.from(result)).toEqual([2, 4, 6]);
    });

    it('should scale Float64Array by scalar', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const result = await multiply(a, 2);
      expect(Array.from(result)).toEqual([2, 4, 6, 8]);
    });

    it('should compute sqrt of Float64Array in parallel', async () => {
      const a = new Float64Array([1, 4, 9, 16]);
      const result = await sqrt(a);
      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    });

    it('should compute trigonometric functions on Float64Array', async () => {
      const angles = new Float64Array([0, Math.PI / 2, Math.PI]);

      const sinResult = await sin(angles);
      expect(sinResult[0]).toBeCloseTo(0);
      expect(sinResult[1]).toBeCloseTo(1);
      expect(sinResult[2]).toBeCloseTo(0);

      const cosResult = await cos(angles);
      expect(cosResult[0]).toBeCloseTo(1);
      expect(cosResult[1]).toBeCloseTo(0);
      expect(cosResult[2]).toBeCloseTo(-1);
    });
  });

  describe('Cross-Type Operations', () => {
    it('should maintain precision across type conversions', () => {
      // Fraction arithmetic is exact
      const f1 = new Fraction(1, 7);
      const f2 = new Fraction(2, 7);
      const fSum = add(f1, f2);
      expect(fSum.numerator).toBe(3n);
      expect(fSum.denominator).toBe(7n);

      // BigNumber avoids floating point issues
      const b1 = BigNumber.parse('0.1');
      const b2 = BigNumber.parse('0.2');
      const bSum = add(b1, b2);
      expect(bSum.equals(BigNumber.parse('0.3'))).toBe(true);
    });

    it('should compute Complex exponentials (Euler formula)', () => {
      // e^(i*π) = -1
      const iPi = new Complex(0, Math.PI);
      const result = exp(iPi);
      expect(result.re).toBeCloseTo(-1);
      expect(result.im).toBeCloseTo(0);
    });

    it('should handle chained operations', () => {
      // (2 + 3i) * (1 - i) + (4 + 2i)
      const a = new Complex(2, 3);
      const b = new Complex(1, -1);
      const c = new Complex(4, 2);

      const product = multiply(a, b); // (2+3i)(1-i) = 2 - 2i + 3i - 3i² = 2 + i + 3 = 5 + i
      const result = add(product, c);  // (5 + i) + (4 + 2i) = 9 + 3i

      expect(result.re).toBe(9);
      expect(result.im).toBe(3);
    });
  });
});
