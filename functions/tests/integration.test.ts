/**
 * Numerical Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { trapz, simpson, gaussQuad, romberg } from '../src/typed/integration.js';

describe('Numerical Integration', () => {
  describe('trapz', () => {
    it('should integrate with non-uniform spacing', () => {
      expect(trapz([1, 2, 3], [0, 1, 2])).toBe(4);
    });

    it('should integrate with uniform spacing (h=1)', () => {
      expect(trapz([0, 1, 0])).toBe(1);
    });

    it('should integrate constant function', () => {
      expect(trapz([5, 5, 5, 5], [0, 1, 2, 3])).toBe(15);
    });

    it('should handle two points', () => {
      expect(trapz([1, 3], [0, 2])).toBe(4);
    });

    it('should throw for fewer than 2 points', () => {
      expect(() => trapz([1])).toThrow();
    });

    it('should throw for mismatched lengths', () => {
      expect(() => trapz([1, 2], [0, 1, 2])).toThrow();
    });
  });

  describe('simpson', () => {
    it('should integrate x^2 from 0 to 1', () => {
      expect(simpson((x) => x ** 2, 0, 1)).toBeCloseTo(1 / 3, 10);
    });

    it('should integrate sin(x) from 0 to pi', () => {
      expect(simpson(Math.sin, 0, Math.PI)).toBeCloseTo(2, 7);
    });

    it('should integrate constant function', () => {
      expect(simpson(() => 3, 0, 5)).toBeCloseTo(15, 10);
    });

    it('should integrate x^3 from 0 to 1', () => {
      expect(simpson((x) => x ** 3, 0, 1)).toBeCloseTo(0.25, 8);
    });

    it('should handle odd n by rounding up', () => {
      // n=99 becomes n=100
      expect(simpson((x) => x ** 2, 0, 1, 99)).toBeCloseTo(1 / 3, 8);
    });
  });

  describe('gaussQuad', () => {
    it('should integrate x^2 from 0 to 1', () => {
      expect(gaussQuad((x) => x ** 2, 0, 1, 3)).toBeCloseTo(1 / 3, 12);
    });

    it('should integrate polynomial exactly (degree <= 2n-1)', () => {
      // 2-point rule is exact for degree <= 3
      expect(gaussQuad((x) => x ** 3, 0, 1, 2)).toBeCloseTo(0.25, 12);
    });

    it('should integrate exp(x) from 0 to 1', () => {
      expect(gaussQuad(Math.exp, 0, 1, 5)).toBeCloseTo(Math.E - 1, 10);
    });

    it('should throw for unsupported number of points', () => {
      expect(() => gaussQuad((x) => x, 0, 1, 1)).toThrow();
      expect(() => gaussQuad((x) => x, 0, 1, 6)).toThrow();
    });
  });

  describe('romberg', () => {
    it('should integrate sin(x) from 0 to pi', () => {
      expect(romberg(Math.sin, 0, Math.PI)).toBeCloseTo(2, 10);
    });

    it('should integrate x^2 from 0 to 1', () => {
      expect(romberg((x) => x ** 2, 0, 1)).toBeCloseTo(1 / 3, 10);
    });

    it('should integrate exp(x) from 0 to 1', () => {
      expect(romberg(Math.exp, 0, 1)).toBeCloseTo(Math.E - 1, 10);
    });

    it('should integrate 1/x from 1 to 2 (ln 2)', () => {
      expect(romberg((x) => 1 / x, 1, 2)).toBeCloseTo(Math.LN2, 10);
    });

    it('should handle custom tolerance', () => {
      const result = romberg(Math.sin, 0, Math.PI, 1e-6);
      expect(Math.abs(result - 2)).toBeLessThan(1e-6);
    });
  });
});
