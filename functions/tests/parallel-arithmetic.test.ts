/**
 * Tests for parallel-first typed arithmetic functions
 *
 * Tests both scalar operations (synchronous) and Float64Array operations (parallel async).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Complex, Fraction, BigNumber } from '@mathts/core';
import { computePool } from '@mathts/parallel';
import {
  add as parallelAdd,
  subtract as parallelSubtract,
  multiply as parallelMultiply,
  divide as parallelDivide,
  abs as parallelAbs,
  unaryMinus as parallelNegate,
  square as parallelSquare,
  sqrt as parallelSqrt,
  exp as parallelExp,
  log as parallelLog,
  sum as parallelSum,
  mean as parallelMean,
  variance as parallelVariance,
  std as parallelStd,
  min as parallelMin,
  max as parallelMax,
  norm as parallelNorm,
  dot as parallelDot,
  matmul as parallelMatmul,
  transpose as parallelTranspose,
} from '../src/index.js';
// Import trig functions from trigonometry module
import {
  sin as parallelSin,
  cos as parallelCos,
  tan as parallelTan,
} from '../src/typed/trigonometry.js';

describe('Parallel Arithmetic Functions', () => {
  // Initialize and terminate pool for parallel tests
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  describe('Scalar operations (synchronous)', () => {
    describe('Addition', () => {
      it('should add numbers', () => {
        expect(parallelAdd(1, 2)).toBe(3);
        expect(parallelAdd(1.5, 2.5)).toBe(4);
        expect(parallelAdd(-1, 1)).toBe(0);
      });

      it('should add bigints', () => {
        expect(parallelAdd(10n, 20n)).toBe(30n);
      });

      it('should add Complex numbers', () => {
        const c1 = new Complex(1, 2);
        const c2 = new Complex(3, 4);
        const result = parallelAdd(c1, c2) as Complex;
        expect(result.re).toBe(4);
        expect(result.im).toBe(6);
      });

      it('should add Fractions', () => {
        const f1 = new Fraction(1n, 2n);
        const f2 = new Fraction(1n, 3n);
        const result = parallelAdd(f1, f2) as Fraction;
        // 1/2 + 1/3 = 5/6
        expect(result.numerator).toBe(5n);
        expect(result.denominator).toBe(6n);
      });

      it('should add BigNumbers', () => {
        const b1 = BigNumber.fromNumber(10);
        const b2 = BigNumber.fromNumber(3);
        const result = parallelAdd(b1, b2) as BigNumber;
        expect(result.valueOf()).toBe(13);
      });

      // Note: Variadic signatures in typed-function require specific handling
      // The base add function in arithmetic.ts should be used for variadic addition
    });

    describe('Subtraction', () => {
      it('should subtract numbers', () => {
        expect(parallelSubtract(5, 3)).toBe(2);
        expect(parallelSubtract(1, 5)).toBe(-4);
      });

      it('should subtract Complex numbers', () => {
        const c1 = new Complex(5, 7);
        const c2 = new Complex(2, 3);
        const result = parallelSubtract(c1, c2) as Complex;
        expect(result.re).toBe(3);
        expect(result.im).toBe(4);
      });
    });

    describe('Multiplication', () => {
      it('should multiply numbers', () => {
        expect(parallelMultiply(3, 4)).toBe(12);
        expect(parallelMultiply(-2, 3)).toBe(-6);
      });

      it('should multiply Complex numbers', () => {
        const c1 = new Complex(1, 2);
        const c2 = new Complex(3, 4);
        const result = parallelMultiply(c1, c2) as Complex;
        // (1+2i)(3+4i) = 3 + 4i + 6i + 8i² = -5 + 10i
        expect(result.re).toBe(-5);
        expect(result.im).toBe(10);
      });
    });

    describe('Division', () => {
      it('should divide numbers', () => {
        expect(parallelDivide(10, 2)).toBe(5);
        expect(parallelDivide(7, 2)).toBe(3.5);
      });
    });

    describe('Unary operations', () => {
      it('should compute absolute value', () => {
        expect(parallelAbs(-5)).toBe(5);
        expect(parallelAbs(5)).toBe(5);
        expect(parallelAbs(-10n)).toBe(10n);
      });

      it('should negate numbers', () => {
        expect(parallelNegate(5)).toBe(-5);
        expect(parallelNegate(-3)).toBe(3);
      });

      it('should square numbers', () => {
        expect(parallelSquare(3)).toBe(9);
        expect(parallelSquare(-4)).toBe(16);
      });

      it('should compute square root', () => {
        expect(parallelSqrt(4)).toBe(2);
        expect(parallelSqrt(9)).toBe(3);
      });

      it('should return Complex for sqrt of negative', () => {
        const result = parallelSqrt(-4);
        expect(result).toBeInstanceOf(Complex);
        expect((result as Complex).im).toBe(2);
      });

      it('should compute exp', () => {
        expect(parallelExp(0)).toBe(1);
        expect(parallelExp(1)).toBeCloseTo(Math.E, 10);
      });

      it('should compute log', () => {
        expect(parallelLog(1)).toBe(0);
        expect(parallelLog(Math.E)).toBeCloseTo(1, 10);
      });
    });

    describe('Trigonometric operations', () => {
      it('should compute sin', () => {
        expect(parallelSin(0)).toBe(0);
        expect(parallelSin(Math.PI / 2)).toBeCloseTo(1, 10);
      });

      it('should compute cos', () => {
        expect(parallelCos(0)).toBe(1);
        expect(parallelCos(Math.PI)).toBeCloseTo(-1, 10);
      });

      it('should compute tan', () => {
        expect(parallelTan(0)).toBe(0);
        expect(parallelTan(Math.PI / 4)).toBeCloseTo(1, 10);
      });
    });

    describe('Statistical operations (Array)', () => {
      it('should compute sum of array', () => {
        expect(parallelSum([1, 2, 3, 4, 5])).toBe(15);
      });

      it('should compute mean of array', () => {
        expect(parallelMean([1, 2, 3, 4, 5])).toBe(3);
      });

      it('should compute variance of array', () => {
        // Variance of [1, 2, 3, 4, 5] = 2
        expect(parallelVariance([1, 2, 3, 4, 5])).toBe(2);
      });

      it('should compute std of array', () => {
        // sqrt(2) ≈ 1.414
        expect(parallelStd([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2), 10);
      });

      it('should compute min of array', () => {
        expect(parallelMin([3, 1, 4, 1, 5])).toBe(1);
      });

      it('should compute max of array', () => {
        expect(parallelMax([3, 1, 4, 1, 5])).toBe(5);
      });

      it('should compute norm of array', () => {
        // ||[3, 4]|| = 5
        expect(parallelNorm([3, 4])).toBe(5);
      });

      it('should compute dot product of arrays', () => {
        // [1, 2, 3] · [4, 5, 6] = 4 + 10 + 18 = 32
        expect(parallelDot([1, 2, 3], [4, 5, 6])).toBe(32);
      });
    });
  });

  describe('Float64Array operations (parallel async)', () => {
    describe('Element-wise operations', () => {
      it('should add Float64Arrays in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const b = new Float64Array([5, 4, 3, 2, 1]);
        const result = await parallelAdd(a, b);
        expect(result).toEqual(new Float64Array([6, 6, 6, 6, 6]));
      });

      it('should subtract Float64Arrays in parallel', async () => {
        const a = new Float64Array([5, 5, 5, 5, 5]);
        const b = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelSubtract(a, b);
        expect(result).toEqual(new Float64Array([4, 3, 2, 1, 0]));
      });

      it('should multiply Float64Arrays in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const b = new Float64Array([2, 2, 2, 2, 2]);
        const result = await parallelMultiply(a, b);
        expect(result).toEqual(new Float64Array([2, 4, 6, 8, 10]));
      });

      it('should divide Float64Arrays in parallel', async () => {
        const a = new Float64Array([10, 20, 30, 40, 50]);
        const b = new Float64Array([2, 4, 5, 8, 10]);
        const result = await parallelDivide(a, b);
        expect(result).toEqual(new Float64Array([5, 5, 6, 5, 5]));
      });

      it('should scale Float64Array by scalar', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelMultiply(a, 2);
        expect(result).toEqual(new Float64Array([2, 4, 6, 8, 10]));
      });
    });

    describe('Unary operations', () => {
      it('should compute abs of Float64Array in parallel', async () => {
        const a = new Float64Array([-3, -2, -1, 0, 1, 2, 3]);
        const result = await parallelAbs(a);
        expect(result).toEqual(new Float64Array([3, 2, 1, 0, 1, 2, 3]));
      });

      it('should negate Float64Array in parallel', async () => {
        const a = new Float64Array([1, -2, 3, -4, 5]);
        const result = await parallelNegate(a);
        expect(result).toEqual(new Float64Array([-1, 2, -3, 4, -5]));
      });

      it('should square Float64Array in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelSquare(a);
        expect(result).toEqual(new Float64Array([1, 4, 9, 16, 25]));
      });

      it('should compute sqrt of Float64Array in parallel', async () => {
        const a = new Float64Array([1, 4, 9, 16, 25]);
        const result = await parallelSqrt(a);
        expect(result).toEqual(new Float64Array([1, 2, 3, 4, 5]));
      });

      it('should compute exp of Float64Array in parallel', async () => {
        const a = new Float64Array([0, 1, 2]);
        const result = await parallelExp(a);
        expect(result[0]).toBeCloseTo(1, 10);
        expect(result[1]).toBeCloseTo(Math.E, 10);
        expect(result[2]).toBeCloseTo(Math.E * Math.E, 10);
      });

      it('should compute log of Float64Array in parallel', async () => {
        const a = new Float64Array([1, Math.E, Math.E * Math.E]);
        const result = await parallelLog(a);
        expect(result[0]).toBeCloseTo(0, 10);
        expect(result[1]).toBeCloseTo(1, 10);
        expect(result[2]).toBeCloseTo(2, 10);
      });
    });

    describe('Trigonometric operations', () => {
      it('should compute sin of Float64Array in parallel', async () => {
        const a = new Float64Array([0, Math.PI / 6, Math.PI / 2]);
        const result = await parallelSin(a);
        expect(result[0]).toBeCloseTo(0, 10);
        expect(result[1]).toBeCloseTo(0.5, 10);
        expect(result[2]).toBeCloseTo(1, 10);
      });

      it('should compute cos of Float64Array in parallel', async () => {
        const a = new Float64Array([0, Math.PI / 3, Math.PI]);
        const result = await parallelCos(a);
        expect(result[0]).toBeCloseTo(1, 10);
        expect(result[1]).toBeCloseTo(0.5, 10);
        expect(result[2]).toBeCloseTo(-1, 10);
      });

      it('should compute tan of Float64Array in parallel', async () => {
        const a = new Float64Array([0, Math.PI / 4]);
        const result = await parallelTan(a);
        expect(result[0]).toBeCloseTo(0, 10);
        expect(result[1]).toBeCloseTo(1, 10);
      });
    });

    describe('Statistical operations', () => {
      it('should compute sum of Float64Array in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelSum(a);
        expect(result).toBe(15);
      });

      it('should compute mean of Float64Array in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelMean(a);
        expect(result).toBe(3);
      });

      it('should compute variance of Float64Array in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelVariance(a);
        expect(result).toBeCloseTo(2, 5);
      });

      it('should compute std of Float64Array in parallel', async () => {
        const a = new Float64Array([1, 2, 3, 4, 5]);
        const result = await parallelStd(a);
        expect(result).toBeCloseTo(Math.sqrt(2), 5);
      });

      it('should compute min of Float64Array in parallel', async () => {
        const a = new Float64Array([3, 1, 4, 1, 5, 9, 2, 6]);
        const result = await parallelMin(a);
        expect(result).toBe(1);
      });

      it('should compute max of Float64Array in parallel', async () => {
        const a = new Float64Array([3, 1, 4, 1, 5, 9, 2, 6]);
        const result = await parallelMax(a);
        expect(result).toBe(9);
      });

      it('should compute norm of Float64Array in parallel', async () => {
        const a = new Float64Array([3, 4]);
        const result = await parallelNorm(a);
        expect(result).toBe(5);
      });

      it('should compute dot product of Float64Arrays in parallel', async () => {
        const a = new Float64Array([1, 2, 3]);
        const b = new Float64Array([4, 5, 6]);
        const result = await parallelDot(a, b);
        expect(result).toBe(32);
      });
    });

    describe('Matrix operations', () => {
      it('should multiply matrices in parallel', async () => {
        // 2x2 matrix multiplication
        const A = new Float64Array([1, 2, 3, 4]); // [[1, 2], [3, 4]]
        const B = new Float64Array([5, 6, 7, 8]); // [[5, 6], [7, 8]]
        // Result: [[19, 22], [43, 50]]
        const result = await parallelMatmul(A, 2, 2, B, 2);
        expect(result).toEqual(new Float64Array([19, 22, 43, 50]));
      });

      it('should transpose matrix in parallel', async () => {
        // [[1, 2, 3], [4, 5, 6]] -> [[1, 4], [2, 5], [3, 6]]
        const A = new Float64Array([1, 2, 3, 4, 5, 6]);
        const result = await parallelTranspose(A, 2, 3);
        expect(result).toEqual(new Float64Array([1, 4, 2, 5, 3, 6]));
      });
    });
  });

  // Note: Large array tests require the full worker pool implementation
  // These tests use sequential fallback for smaller arrays
  // Large array parallelization is tested in @mathts/workerpool package
  describe('Medium array operations (sequential fallback)', () => {
    it('should handle medium Float64Array addition', async () => {
      const size = 1000;
      const a = new Float64Array(size).fill(1);
      const b = new Float64Array(size).fill(2);
      const result = await parallelAdd(a, b);
      expect(result.length).toBe(size);
      expect(result[0]).toBe(3);
      expect(result[size - 1]).toBe(3);
    });

    it('should handle medium Float64Array sum', async () => {
      const size = 1000;
      const a = new Float64Array(size).fill(1);
      const result = await parallelSum(a);
      expect(result).toBe(size);
    });

    it('should handle medium matrix multiplication', async () => {
      const n = 10;
      const A = new Float64Array(n * n);
      const B = new Float64Array(n * n);

      // Initialize identity matrices
      for (let i = 0; i < n; i++) {
        A[i * n + i] = 1;
        B[i * n + i] = 1;
      }

      const result = await parallelMatmul(A, n, n, B, n);
      expect(result.length).toBe(n * n);
      // Identity * Identity = Identity
      expect(result[0]).toBe(1); // (0,0)
      expect(result[n + 1]).toBe(1); // (1,1)
    });
  });
});
