/**
 * Extended Combinatorics Tests
 */

import { describe, it, expect } from 'vitest';
import {
  fibonacci,
  lucas,
  doubleFactorial,
  risingFactorial,
  fallingFactorial,
  subfactorial,
} from '../src/typed/combinatorics.js';

describe('Extended Combinatorics', () => {
  describe('fibonacci', () => {
    it('should return F(0) = 0', () => {
      expect(fibonacci(0)).toBe(0);
    });

    it('should return F(1) = 1', () => {
      expect(fibonacci(1)).toBe(1);
    });

    it('should return F(10) = 55', () => {
      expect(fibonacci(10)).toBe(55);
    });

    it('should return F(20) = 6765', () => {
      expect(fibonacci(20)).toBe(6765);
    });

    it('should return F(30) = 832040', () => {
      expect(fibonacci(30)).toBe(832040);
    });

    it('should throw for negative input', () => {
      expect(() => fibonacci(-1)).toThrow();
    });

    it('should throw for non-integer', () => {
      expect(() => fibonacci(1.5)).toThrow();
    });
  });

  describe('lucas', () => {
    it('should return L(0) = 2', () => {
      expect(lucas(0)).toBe(2);
    });

    it('should return L(1) = 1', () => {
      expect(lucas(1)).toBe(1);
    });

    it('should return L(10) = 123', () => {
      expect(lucas(10)).toBe(123);
    });

    it('should return L(5) = 11', () => {
      expect(lucas(5)).toBe(11);
    });

    it('should return L(15) = 1364', () => {
      expect(lucas(15)).toBe(1364);
    });

    it('should throw for negative input', () => {
      expect(() => lucas(-1)).toThrow();
    });
  });

  describe('doubleFactorial', () => {
    it('should return 7!! = 105', () => {
      expect(doubleFactorial(7)).toBe(105);
    });

    it('should return 6!! = 48', () => {
      expect(doubleFactorial(6)).toBe(48);
    });

    it('should return 0!! = 1', () => {
      expect(doubleFactorial(0)).toBe(1);
    });

    it('should return 1!! = 1', () => {
      expect(doubleFactorial(1)).toBe(1);
    });

    it('should return (-1)!! = 1', () => {
      expect(doubleFactorial(-1)).toBe(1);
    });

    it('should return 10!! = 3840', () => {
      expect(doubleFactorial(10)).toBe(3840);
    });

    it('should throw for < -1', () => {
      expect(() => doubleFactorial(-2)).toThrow();
    });
  });

  describe('risingFactorial', () => {
    it('should compute (3)^(4) = 3*4*5*6 = 360', () => {
      expect(risingFactorial(3, 4)).toBe(360);
    });

    it('should compute (1)^(5) = 5! = 120', () => {
      expect(risingFactorial(1, 5)).toBe(120);
    });

    it('should return 1 for n=0', () => {
      expect(risingFactorial(7, 0)).toBe(1);
    });

    it('should compute (5)^(1) = 5', () => {
      expect(risingFactorial(5, 1)).toBe(5);
    });

    it('should throw for negative n', () => {
      expect(() => risingFactorial(3, -1)).toThrow();
    });
  });

  describe('fallingFactorial', () => {
    it('should compute (5)_(3) = 5*4*3 = 60', () => {
      expect(fallingFactorial(5, 3)).toBe(60);
    });

    it('should compute (5)_(5) = 5! = 120', () => {
      expect(fallingFactorial(5, 5)).toBe(120);
    });

    it('should return 1 for n=0', () => {
      expect(fallingFactorial(7, 0)).toBe(1);
    });

    it('should compute (10)_(2) = 10*9 = 90', () => {
      expect(fallingFactorial(10, 2)).toBe(90);
    });

    it('should throw for negative n', () => {
      expect(() => fallingFactorial(3, -1)).toThrow();
    });
  });

  describe('subfactorial', () => {
    it('should return !0 = 1', () => {
      expect(subfactorial(0)).toBe(1);
    });

    it('should return !1 = 0', () => {
      expect(subfactorial(1)).toBe(0);
    });

    it('should return !2 = 1', () => {
      expect(subfactorial(2)).toBe(1);
    });

    it('should return !3 = 2', () => {
      expect(subfactorial(3)).toBe(2);
    });

    it('should return !5 = 44', () => {
      expect(subfactorial(5)).toBe(44);
    });

    it('should return !6 = 265', () => {
      expect(subfactorial(6)).toBe(265);
    });

    it('should throw for negative input', () => {
      expect(() => subfactorial(-1)).toThrow();
    });
  });
});
