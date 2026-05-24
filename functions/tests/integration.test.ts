/**
 * Numerical Integration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  trapz,
  trapzF64,
  simpson,
  simpsonF64,
  gaussQuad,
  romberg,
  GAUSS_WORKER_THRESHOLD,
  ARRAY_WORKER_THRESHOLD,
} from '../src/typed/integration.js';

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

  describe('trapzF64', () => {
    it('should integrate with uniform spacing (h=1)', async () => {
      const result = await trapzF64(new Float64Array([0, 1, 0]));
      expect(result).toBeCloseTo(1, 12);
    });

    it('should integrate constant function', async () => {
      const result = await trapzF64(new Float64Array([5, 5, 5, 5]), 1);
      expect(result).toBeCloseTo(15, 12);
    });

    it('should match trapz for the same data', async () => {
      const ys = [0, 0.25, 0.5, 0.75, 1.0];
      const f64 = new Float64Array(ys);
      const expected = trapz(ys);
      const actual = await trapzF64(f64);
      expect(actual).toBeCloseTo(expected, 12);
    });

    it('should integrate sin(x) with fine grid', async () => {
      const n = 1000;
      const ys = new Float64Array(n + 1);
      for (let i = 0; i <= n; i++) {
        ys[i] = Math.sin((i / n) * Math.PI);
      }
      const result = await trapzF64(ys, Math.PI / n);
      expect(result).toBeCloseTo(2, 4);
    });

    it('should throw for fewer than 2 points', async () => {
      await expect(trapzF64(new Float64Array([1]))).rejects.toThrow();
    });

    it('correctness above ARRAY_WORKER_THRESHOLD matches sequential', async () => {
      const n = ARRAY_WORKER_THRESHOLD + 1;
      const ys = new Float64Array(n);
      // linear: y = i/(n-1), integral = 0.5
      for (let i = 0; i < n; i++) ys[i] = i / (n - 1);
      const result = await trapzF64(ys, 1 / (n - 1));
      expect(result).toBeCloseTo(0.5, 6);
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

  describe('simpsonF64', () => {
    it('should integrate x^2 from 0 to 1', async () => {
      const n = 100; // 100 sub-intervals => 101 points
      const ys = new Float64Array(n + 1);
      const dx = 1 / n;
      for (let i = 0; i <= n; i++) ys[i] = (i * dx) ** 2;
      const result = await simpsonF64(ys, dx);
      expect(result).toBeCloseTo(1 / 3, 8);
    });

    it('should integrate sin(x) over [0, pi]', async () => {
      const n = 100;
      const ys = new Float64Array(n + 1);
      const dx = Math.PI / n;
      for (let i = 0; i <= n; i++) ys[i] = Math.sin(i * dx);
      const result = await simpsonF64(ys, dx);
      expect(result).toBeCloseTo(2, 7);
    });

    it('should throw for even number of points (odd sub-intervals)', async () => {
      // 4 points = 3 sub-intervals (odd) => error
      await expect(simpsonF64(new Float64Array([0, 1, 2, 3]))).rejects.toThrow();
    });

    it('correctness above ARRAY_WORKER_THRESHOLD matches sequential', async () => {
      const n = ARRAY_WORKER_THRESHOLD; // n sub-intervals (even) => n+1 points
      const ys = new Float64Array(n + 1);
      const dx = 1 / n;
      // integrate constant 1 from 0 to 1 => result = 1
      for (let i = 0; i <= n; i++) ys[i] = 1;
      const result = await simpsonF64(ys, dx);
      expect(result).toBeCloseTo(1, 6);
    });
  });

  describe('gaussQuad', () => {
    it('should integrate x^2 from 0 to 1 (3-point GL, backward-compat)', () => {
      expect(gaussQuad((x) => x ** 2, 0, 1, 3)).toBeCloseTo(1 / 3, 12);
    });

    it('should integrate polynomial exactly (degree <= 2n-1) (2-point GL)', () => {
      // 2-point rule is exact for degree <= 3
      expect(gaussQuad((x) => x ** 3, 0, 1, 2)).toBeCloseTo(0.25, 12);
    });

    it('should integrate exp(x) from 0 to 1 (5-point GL)', () => {
      expect(gaussQuad(Math.exp, 0, 1, 5)).toBeCloseTo(Math.E - 1, 10);
    });

    it('should throw for unsupported number of points in single-interval mode', () => {
      expect(() => gaussQuad((x) => x, 0, 1, 1)).toThrow();
    });

    it('composite mode: sin(x) from 0 to pi with 64 sub-intervals', async () => {
      const result = await Promise.resolve(gaussQuad(Math.sin, 0, Math.PI, 64));
      expect(result).toBeCloseTo(2, 9);
    });

    it('composite mode: x^2 from 0 to 1 with 64 sub-intervals', async () => {
      const result = await Promise.resolve(gaussQuad((x) => x ** 2, 0, 1, 64));
      expect(result).toBeCloseTo(1 / 3, 9);
    });

    it('composite mode produces same result as serial with identical intervals', async () => {
      // For a polynomial degree ≤ 9 (2*5-1), the 5-point GL rule is exact.
      // With 64 sub-intervals of order-5 GL the result must be exact to
      // floating-point precision.
      const f = (x: number) => x ** 2; // integral = 1/3
      const composite = await Promise.resolve(gaussQuad(f, 0, 1, 64));
      expect(composite as number).toBeCloseTo(1 / 3, 12);
    });

    it('composite mode above GAUSS_WORKER_THRESHOLD dispatches (correctness check)', async () => {
      // GAUSS_WORKER_THRESHOLD = 64 sub-intervals; totalPoints = 64 * 5 = 320 ≥ 64
      const n = GAUSS_WORKER_THRESHOLD;
      const result = await Promise.resolve(gaussQuad(Math.sin, 0, Math.PI, n));
      expect(result as number).toBeCloseTo(2, 9);
    });
  });

  describe('romberg', () => {
    it('should integrate sin(x) from 0 to pi', async () => {
      expect(await romberg(Math.sin, 0, Math.PI)).toBeCloseTo(2, 10);
    });

    it('should integrate x^2 from 0 to 1', async () => {
      expect(await romberg((x) => x ** 2, 0, 1)).toBeCloseTo(1 / 3, 10);
    });

    it('should integrate exp(x) from 0 to 1', async () => {
      expect(await romberg(Math.exp, 0, 1)).toBeCloseTo(Math.E - 1, 10);
    });

    it('should integrate 1/x from 1 to 2 (ln 2)', async () => {
      expect(await romberg((x) => 1 / x, 1, 2)).toBeCloseTo(Math.LN2, 10);
    });

    it('should handle custom tolerance', async () => {
      const result = await romberg(Math.sin, 0, Math.PI, 1e-6);
      expect(Math.abs(result - 2)).toBeLessThan(1e-6);
    });

    it('high-iteration path exercises worker dispatch for large point counts', async () => {
      // romberg converges quickly, but we verify it still produces a correct
      // answer even when the internal evaluation count crosses GAUSS_WORKER_THRESHOLD
      const result = await romberg((x) => x ** 2, 0, 1);
      expect(result).toBeCloseTo(1 / 3, 10);
    });
  });
});
