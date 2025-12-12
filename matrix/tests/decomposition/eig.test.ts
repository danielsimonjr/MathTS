/**
 * Eigenvalue Decomposition Tests
 *
 * Tests for eigenvalue and eigenvector computation.
 */

import { describe, it, expect } from 'vitest';
import { eig, eigvals, powerIteration, EigResult } from '../../src/operations/eig.js';

/**
 * Helper: matrix-vector multiply
 */
function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < A[i].length; j++) {
      result[i] += A[i][j] * v[j];
    }
  }
  return result;
}

/**
 * Helper: scalar multiply vector
 */
function scalarMul(s: number, v: number[]): number[] {
  return v.map(x => x * s);
}

/**
 * Helper: vector norm
 */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Helper: Check if A*v ≈ λ*v
 */
function checkEigenpair(
  A: number[][],
  eigenvalue: { re: number; im: number },
  eigenvector: number[],
  tolerance: number = 1e-6
): boolean {
  if (eigenvalue.im !== 0) {
    // Skip complex eigenvalues
    return true;
  }

  const Av = matvec(A, eigenvector);
  const lambdaV = scalarMul(eigenvalue.re, eigenvector);
  const vNorm = norm(eigenvector);

  if (vNorm < tolerance) {
    // Zero vector, skip
    return true;
  }

  // Check residual
  let residual = 0;
  for (let i = 0; i < Av.length; i++) {
    residual += (Av[i] - lambdaV[i]) ** 2;
  }
  residual = Math.sqrt(residual) / vNorm;

  return residual < tolerance;
}

describe('Eigenvalue Decomposition', () => {
  describe('Basic eigenvalue computation', () => {
    it('should handle empty matrix', () => {
      const result = eig([]);

      expect(result.values).toEqual([]);
      expect(result.vectors).toEqual([]);
      expect(result.isSymmetric).toBe(true);
    });

    it('should compute eigenvalue of 1x1 matrix', () => {
      const result = eig([[5]]);

      expect(result.values.length).toBe(1);
      expect(result.values[0].re).toBeCloseTo(5);
      expect(result.values[0].im).toBeCloseTo(0);
      expect(result.vectors).toEqual([[1]]);
    });

    it('should compute eigenvalues of diagonal matrix', () => {
      const A = [
        [2, 0, 0],
        [0, 3, 0],
        [0, 0, 5],
      ];

      const result = eig(A);

      // Eigenvalues should be diagonal elements
      const eigenvalues = result.values.map(e => e.re).sort((a, b) => a - b);
      expect(eigenvalues[0]).toBeCloseTo(2);
      expect(eigenvalues[1]).toBeCloseTo(3);
      expect(eigenvalues[2]).toBeCloseTo(5);
    });

    it('should compute eigenvalues of 2x2 matrix', () => {
      const A = [
        [4, 2],
        [1, 3],
      ];

      const result = eig(A);

      // Characteristic polynomial: λ² - 7λ + 10 = 0
      // λ = (7 ± √9) / 2 = 5 or 2
      const eigenvalues = result.values.map(e => e.re).sort((a, b) => a - b);
      expect(eigenvalues[0]).toBeCloseTo(2);
      expect(eigenvalues[1]).toBeCloseTo(5);
    });

    it('should detect symmetric matrices', () => {
      const symmetric = [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ];

      const nonsymmetric = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      expect(eig(symmetric).isSymmetric).toBe(true);
      expect(eig(nonsymmetric).isSymmetric).toBe(false);
    });
  });

  describe('Symmetric matrices', () => {
    it('should have real eigenvalues for symmetric matrix', () => {
      const A = [
        [2, 1, 1],
        [1, 2, 1],
        [1, 1, 2],
      ];

      const result = eig(A);

      for (const e of result.values) {
        expect(e.im).toBeCloseTo(0);
      }
    });

    it('should satisfy A*v = λ*v for symmetric matrix', () => {
      const A = [
        [4, 1, 1],
        [1, 4, 1],
        [1, 1, 4],
      ];

      const result = eig(A);

      for (let i = 0; i < result.values.length; i++) {
        expect(
          checkEigenpair(A, result.values[i], result.vectors[i])
        ).toBe(true);
      }
    });

    it('should compute eigenvalues of identity matrix', () => {
      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const result = eig(I);

      for (const e of result.values) {
        expect(e.re).toBeCloseTo(1);
        expect(e.im).toBeCloseTo(0);
      }
    });
  });

  describe('Non-symmetric matrices', () => {
    it('should compute eigenvalues of upper triangular matrix', () => {
      const A = [
        [1, 2, 3],
        [0, 4, 5],
        [0, 0, 6],
      ];

      const result = eig(A);

      // Eigenvalues are diagonal elements
      const eigenvalues = result.values.map(e => e.re).sort((a, b) => a - b);
      expect(eigenvalues[0]).toBeCloseTo(1);
      expect(eigenvalues[1]).toBeCloseTo(4);
      expect(eigenvalues[2]).toBeCloseTo(6);
    });

    it('should detect complex eigenvalues', () => {
      // Rotation matrix has complex eigenvalues
      const theta = Math.PI / 4;
      const A = [
        [Math.cos(theta), -Math.sin(theta)],
        [Math.sin(theta), Math.cos(theta)],
      ];

      const result = eig(A);

      // Eigenvalues: e^{±iθ} = cos(θ) ± i*sin(θ)
      const hasComplex = result.values.some(e => Math.abs(e.im) > 0.01);
      expect(hasComplex).toBe(true);
    });
  });

  describe('eigvals function', () => {
    it('should return only eigenvalues', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];

      const values = eigvals(A);

      expect(values.length).toBe(2);
      // Eigenvalues: (5 ± √33) / 2
      const realParts = values.map(e => e.re).sort((a, b) => a - b);
      expect(realParts[0]).toBeCloseTo((5 - Math.sqrt(33)) / 2);
      expect(realParts[1]).toBeCloseTo((5 + Math.sqrt(33)) / 2);
    });
  });

  describe('powerIteration', () => {
    it('should find dominant eigenvalue', () => {
      const A = [
        [4, 1],
        [2, 3],
      ];

      const result = powerIteration(A);

      // Dominant eigenvalue is 5
      expect(result.value).toBeCloseTo(5, 3);
    });

    it('should return corresponding eigenvector', () => {
      const A = [
        [3, 0],
        [0, 2],
      ];

      const result = powerIteration(A);

      // Dominant eigenvalue is 3 with eigenvector [1, 0]
      expect(result.value).toBeCloseTo(3, 5);
      expect(Math.abs(result.vector[0])).toBeCloseTo(1, 3);
      expect(Math.abs(result.vector[1])).toBeCloseTo(0, 3);
    });
  });

  describe('Float64Array input', () => {
    it('should accept Float64Array', () => {
      // 2x2 matrix in row-major order
      const A = new Float64Array([1, 2, 3, 4]);

      const result = eig(A);

      expect(result.values.length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle matrix with repeated eigenvalues', () => {
      const A = [
        [2, 1],
        [0, 2],
      ];

      const result = eig(A);

      // Both eigenvalues are 2
      for (const e of result.values) {
        expect(e.re).toBeCloseTo(2);
      }
    });

    it('should handle nearly singular matrix', () => {
      const A = [
        [1, 0],
        [0, 1e-10],
      ];

      const result = eig(A);

      const eigenvalues = result.values.map(e => e.re).sort((a, b) => a - b);
      expect(eigenvalues[0]).toBeCloseTo(1e-10, 5);
      expect(eigenvalues[1]).toBeCloseTo(1);
    });
  });

  describe('Larger matrices', () => {
    it('should handle 5x5 symmetric matrix', () => {
      const A = [
        [5, 2, 1, 0, 0],
        [2, 5, 2, 1, 0],
        [1, 2, 5, 2, 1],
        [0, 1, 2, 5, 2],
        [0, 0, 1, 2, 5],
      ];

      const result = eig(A);

      expect(result.values.length).toBe(5);
      expect(result.isSymmetric).toBe(true);

      // All eigenvalues should be real for symmetric matrix
      for (const e of result.values) {
        expect(Math.abs(e.im)).toBeLessThan(1e-6);
      }
    });

    it('should handle random 4x4 matrix', () => {
      const A = [
        [4.1, 1.2, 0.8, 0.3],
        [1.0, 3.8, 1.5, 0.6],
        [0.5, 1.3, 4.2, 1.1],
        [0.2, 0.7, 0.9, 3.5],
      ];

      const result = eig(A);

      expect(result.values.length).toBe(4);

      // Check eigenpairs for real eigenvalues
      for (let i = 0; i < result.values.length; i++) {
        if (Math.abs(result.values[i].im) < 1e-6) {
          expect(
            checkEigenpair(A, result.values[i], result.vectors[i], 1e-4)
          ).toBe(true);
        }
      }
    });
  });
});
