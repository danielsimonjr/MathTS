/**
 * Interpolation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  linearInterp,
  lagrangeInterp,
  cubicSpline,
  hermiteInterp,
  pchipInterp,
  polyFit,
} from '../src/typed/interpolation.js';

describe('Interpolation', () => {
  describe('linearInterp', () => {
    it('should interpolate at midpoint', () => {
      expect(linearInterp([0, 1], [0, 1], 0.5)).toBe(0.5);
    });

    it('should interpolate between segments', () => {
      expect(linearInterp([0, 1, 2], [0, 1, 4], 1.5)).toBe(2.5);
    });

    it('should handle exact data points', () => {
      expect(linearInterp([0, 1, 2], [0, 2, 8], 1)).toBe(2);
    });

    it('should extrapolate beyond range', () => {
      expect(linearInterp([0, 1], [0, 2], 2)).toBe(4);
    });

    it('should throw for insufficient data', () => {
      expect(() => linearInterp([0], [0], 0)).toThrow();
    });
  });

  describe('lagrangeInterp', () => {
    it('should interpolate linear data exactly', () => {
      expect(lagrangeInterp([0, 1], [0, 1], 0.5)).toBeCloseTo(0.5, 12);
    });

    it('should interpolate quadratic data exactly', () => {
      // f(x) = x^2 at points 0, 1, 2
      expect(lagrangeInterp([0, 1, 2], [0, 1, 4], 1.5)).toBeCloseTo(2.25, 12);
    });

    it('should match polynomial at data points', () => {
      const xs = [0, 1, 2, 3];
      const ys = [1, 0, 1, 4]; // some polynomial
      for (let i = 0; i < xs.length; i++) {
        expect(lagrangeInterp(xs, ys, xs[i])).toBeCloseTo(ys[i], 10);
      }
    });
  });

  describe('cubicSpline', () => {
    it('should interpolate quadratic data closely', () => {
      const spline = cubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
      expect(spline(1.5)).toBeCloseTo(2.2, 0);
    });

    it('should pass through data points', () => {
      const xs = [0, 1, 2, 3, 4];
      const ys = [0, 1, 4, 9, 16];
      const spline = cubicSpline(xs, ys);
      for (let i = 0; i < xs.length; i++) {
        expect(spline(xs[i])).toBeCloseTo(ys[i], 10);
      }
    });

    it('should return a function', () => {
      const spline = cubicSpline([0, 1, 2], [0, 1, 0]);
      expect(typeof spline).toBe('function');
    });

    it('should throw for fewer than 3 points', () => {
      expect(() => cubicSpline([0, 1], [0, 1])).toThrow();
    });
  });

  describe('hermiteInterp', () => {
    it('should interpolate linear function with constant derivative', () => {
      expect(hermiteInterp([0, 1], [0, 1], [1, 1], 0.5)).toBeCloseTo(0.5, 10);
    });

    it('should match at data points', () => {
      expect(hermiteInterp([0, 1], [0, 1], [1, 1], 0)).toBeCloseTo(0, 10);
      expect(hermiteInterp([0, 1], [0, 1], [1, 1], 1)).toBeCloseTo(1, 10);
    });

    it('should handle cubic with derivatives', () => {
      // f(x) = x^3, f\x27(x) = 3x^2
      const xs = [0, 1, 2];
      const ys = [0, 1, 8];
      const dys = [0, 3, 12];
      expect(hermiteInterp(xs, ys, dys, 0.5)).toBeCloseTo(0.125, 4);
    });
  });

  describe('pchipInterp', () => {
    it('should pass through data points', () => {
      const xs = [0, 1, 2, 3];
      const ys = [0, 1, 4, 9];
      for (let i = 0; i < xs.length; i++) {
        expect(pchipInterp(xs, ys, xs[i])).toBeCloseTo(ys[i], 10);
      }
    });

    it('should preserve monotonicity', () => {
      // Monotone increasing data
      const xs = [0, 1, 2, 3, 4];
      const ys = [0, 1, 2, 3, 4];
      const prev = pchipInterp(xs, ys, 0.5);
      const next = pchipInterp(xs, ys, 1.5);
      expect(next).toBeGreaterThan(prev);
    });

    it('should work with 2 data points', () => {
      expect(pchipInterp([0, 1], [0, 1], 0.5)).toBeCloseTo(0.5, 10);
    });
  });

  describe('polyFit', () => {
    it('should fit a quadratic to x^2 data', () => {
      const coeffs = polyFit([0, 1, 2, 3], [0, 1, 4, 9], 2);
      // Should be close to [0, 0, 1]
      expect(coeffs[0]).toBeCloseTo(0, 8);
      expect(coeffs[1]).toBeCloseTo(0, 8);
      expect(coeffs[2]).toBeCloseTo(1, 8);
    });

    it('should fit a linear function', () => {
      const coeffs = polyFit([0, 1, 2, 3], [1, 3, 5, 7], 1);
      // y = 1 + 2x
      expect(coeffs[0]).toBeCloseTo(1, 8);
      expect(coeffs[1]).toBeCloseTo(2, 8);
    });

    it('should fit a constant', () => {
      const coeffs = polyFit([0, 1, 2], [5, 5, 5], 0);
      expect(coeffs[0]).toBeCloseTo(5, 8);
    });

    it('should throw for insufficient data', () => {
      expect(() => polyFit([0], [0], 2)).toThrow();
    });
  });
});
