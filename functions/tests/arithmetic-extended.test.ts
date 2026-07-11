/**
 * Extended Arithmetic Tests (Sprint 18)
 *
 * Tests for GCD/LCM, extended GCD, norm, and related functions.
 */

import { describe, it, expect } from 'vitest';
import { gcd, lcm, mod, xgcd, nthRoot, norm } from '../src/typed/arithmetic.js';
import { hypot } from '../src/typed/trigonometry.js';
import { Fraction } from '@danielsimonjr/mathts-core';

describe('Extended Arithmetic Functions (Sprint 18)', () => {
  describe('Greatest Common Divisor (gcd)', () => {
    it('should compute gcd of two positive numbers', () => {
      expect(gcd(12, 8)).toBe(4);
      expect(gcd(48, 18)).toBe(6);
      expect(gcd(100, 25)).toBe(25);
    });

    it('should handle coprime numbers', () => {
      expect(gcd(13, 17)).toBe(1);
      expect(gcd(7, 11)).toBe(1);
    });

    it('should handle one or zero', () => {
      expect(gcd(5, 0)).toBe(5);
      expect(gcd(0, 5)).toBe(5);
      expect(gcd(1, 100)).toBe(1);
    });

    it('should handle negative numbers', () => {
      expect(gcd(-12, 8)).toBe(4);
      expect(gcd(12, -8)).toBe(4);
      expect(gcd(-12, -8)).toBe(4);
    });

    it('should work with bigint', () => {
      expect(gcd(12n, 8n)).toBe(4n);
      expect(gcd(48n, 18n)).toBe(6n);
    });
  });

  describe('Least Common Multiple (lcm)', () => {
    it('should compute lcm of two positive numbers', () => {
      expect(lcm(4, 6)).toBe(12);
      expect(lcm(3, 5)).toBe(15);
      expect(lcm(12, 18)).toBe(36);
    });

    it('should handle coprime numbers', () => {
      expect(lcm(7, 11)).toBe(77);
    });

    it('should handle multiples', () => {
      expect(lcm(5, 10)).toBe(10);
      expect(lcm(3, 9)).toBe(9);
    });

    it('should work with bigint', () => {
      expect(lcm(4n, 6n)).toBe(12n);
      expect(lcm(3n, 5n)).toBe(15n);
    });
  });

  describe('Modulo (mod)', () => {
    it('should compute positive modulo', () => {
      expect(mod(5, 3)).toBe(2);
      expect(mod(7, 4)).toBe(3);
      expect(mod(10, 5)).toBe(0);
    });

    it('should handle negative dividend (Euclidean mod)', () => {
      // Euclidean modulo always returns non-negative
      expect(mod(-5, 3)).toBe(1); // -5 = -2*3 + 1
      expect(mod(-7, 4)).toBe(1); // -7 = -2*4 + 1
    });

    it('should work with bigint', () => {
      expect(mod(5n, 3n)).toBe(2n);
      expect(mod(-5n, 3n)).toBe(1n);
    });
  });

  describe('Extended GCD (xgcd)', () => {
    it('should return [gcd, x, y] where a*x + b*y = gcd', () => {
      const [g, x, y] = xgcd(12, 8);
      expect(g).toBe(4);
      expect(12 * x + 8 * y).toBe(4);
    });

    it('should work with larger numbers', () => {
      const [g, x, y] = xgcd(48, 18);
      expect(g).toBe(6);
      expect(48 * x + 18 * y).toBe(6);
    });

    it('should handle coprime numbers', () => {
      const [g, x, y] = xgcd(13, 17);
      expect(g).toBe(1);
      expect(13 * x + 17 * y).toBe(1);
    });

    it('should work with bigint', () => {
      const [g, x, y] = xgcd(12n, 8n);
      expect(g).toBe(4n);
      expect(12n * x + 8n * y).toBe(4n);
    });

    it('should handle known values', () => {
      // xgcd(35, 15) = gcd=5, and 35*(-1) + 15*3 = 5
      const [g, x, y] = xgcd(35, 15);
      expect(g).toBe(5);
      expect(35 * x + 15 * y).toBe(5);
    });

    it('should work with Fraction', () => {
      const f1 = new Fraction(12n, 1n);
      const f2 = new Fraction(8n, 1n);
      const [g, x, y] = xgcd(f1, f2) as Fraction[];

      expect(g.equals(new Fraction(4n, 1n))).toBe(true);
      expect(x.equals(new Fraction(1n, 1n))).toBe(true);
      expect(y.equals(new Fraction(-1n, 1n))).toBe(true);

      const resG = f1.multiply(x).add(f2.multiply(y)) as Fraction;
      expect(resG.equals(g)).toBe(true);

      const f3 = new Fraction(36163n, 1n);
      const f4 = new Fraction(21199n, 1n);
      const [g2, x2, y2] = xgcd(f3, f4) as Fraction[];

      expect(g2.equals(new Fraction(1247n, 1n))).toBe(true);
      expect(x2.equals(new Fraction(-7n, 1n))).toBe(true);
      expect(y2.equals(new Fraction(12n, 1n))).toBe(true);

      const resG2 = f3.multiply(x2).add(f4.multiply(y2)) as Fraction;
      expect(resG2.equals(g2)).toBe(true);
    });
  });

  describe('N-th Root (nthRoot)', () => {
    it('should compute square root', () => {
      expect(nthRoot(4, 2)).toBeCloseTo(2);
      expect(nthRoot(9, 2)).toBeCloseTo(3);
      expect(nthRoot(16, 2)).toBeCloseTo(4);
    });

    it('should compute cube root', () => {
      expect(nthRoot(8, 3)).toBeCloseTo(2);
      expect(nthRoot(27, 3)).toBeCloseTo(3);
      expect(nthRoot(125, 3)).toBeCloseTo(5);
    });

    it('should compute 4th root', () => {
      expect(nthRoot(16, 4)).toBeCloseTo(2);
      expect(nthRoot(81, 4)).toBeCloseTo(3);
    });

    it('should handle non-perfect roots', () => {
      expect(nthRoot(2, 2)).toBeCloseTo(Math.SQRT2);
      expect(nthRoot(10, 3)).toBeCloseTo(Math.pow(10, 1 / 3));
    });
  });

  describe('Hypotenuse (hypot)', () => {
    it('should compute hypotenuse of two numbers', () => {
      expect(hypot(3, 4)).toBe(5);
      expect(hypot(5, 12)).toBe(13);
    });

    it('should handle single number', () => {
      expect(hypot(5)).toBe(5);
      expect(hypot(-5)).toBe(5);
    });

    it('should handle multiple numbers', () => {
      expect(hypot(1, 2, 2)).toBe(3);
    });

    it('should handle array', () => {
      expect(hypot([3, 4])).toBe(5);
    });
  });

  describe('Norm', () => {
    describe('Scalar norm', () => {
      it('should return absolute value for numbers', () => {
        expect(norm(5)).toBe(5);
        expect(norm(-5)).toBe(5);
        expect(norm(0)).toBe(0);
      });
    });

    describe('Vector norm (Euclidean/L2)', () => {
      it('should compute L2 norm of vector', () => {
        expect(norm([3, 4])).toBe(5);
        expect(norm([1, 2, 2])).toBe(3);
      });

      it('should handle single element', () => {
        expect(norm([5])).toBe(5);
      });
    });

    describe('P-norm', () => {
      it('should compute L1 norm', () => {
        expect(norm([1, 2, 3], 1)).toBe(6);
        expect(norm([-1, 2, -3], 1)).toBe(6);
      });

      it('should compute L-infinity norm (max)', () => {
        expect(norm([1, -5, 3], Infinity)).toBe(5);
        expect(norm([1, 2, 3], Infinity)).toBe(3);
      });

      it('should compute L-negative-infinity norm (min)', () => {
        expect(norm([1, 5, 3], -Infinity)).toBe(1);
        expect(norm([2, 4, 6], -Infinity)).toBe(2);
      });

      it('should compute L0 norm (count of non-zero)', () => {
        expect(norm([1, 0, 2, 0, 3], 0)).toBe(3);
        expect(norm([0, 0, 0], 0)).toBe(0);
      });

      it('should compute arbitrary p-norm', () => {
        expect(norm([1, 2, 3], 3)).toBeCloseTo(Math.pow(1 + 8 + 27, 1 / 3));
      });
    });
  });
});
