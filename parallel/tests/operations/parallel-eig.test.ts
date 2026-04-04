/**
 * Parallel Eigendecomposition Tests
 *
 * Tests for parallelEig and parallelEigvals functions.
 * These currently exercise the sequential fallback path since
 * true parallel D&C eigensolving is not yet implemented.
 */

import { describe, it, expect } from 'vitest';
import { parallelEig, parallelEigvals } from '../../src/operations/eig.js';

/**
 * Sort eigenvalues by real part descending
 */
function sortEigenvalues(
  values: Array<{ re: number; im: number }>
): Array<{ re: number; im: number }> {
  return [...values].sort((a, b) => b.re - a.re);
}

describe('parallelEig', () => {
  it('handles empty matrix', async () => {
    const result = await parallelEig([]);
    expect(result.result.values).toEqual([]);
    expect(result.result.vectors).toEqual([]);
    expect(result.result.isSymmetric).toBe(true);
    expect(result.parallelized).toBe(false);
    expect(result.chunks).toBe(1);
  });

  it('finds eigenvalues of 1x1 matrix', async () => {
    const result = await parallelEig([[7]]);
    expect(result.result.values).toHaveLength(1);
    expect(result.result.values[0].re).toBeCloseTo(7, 8);
    expect(result.result.values[0].im).toBeCloseTo(0, 8);
    expect(result.parallelized).toBe(false);
  });

  it('finds eigenvalues of 2x2 identity matrix', async () => {
    const result = await parallelEig([
      [1, 0],
      [0, 1],
    ]);
    expect(result.result.values).toHaveLength(2);
    const sorted = sortEigenvalues(result.result.values);
    expect(sorted[0].re).toBeCloseTo(1, 6);
    expect(sorted[1].re).toBeCloseTo(1, 6);
  });

  it('finds eigenvalues of 2x2 symmetric matrix', async () => {
    const result = await parallelEig([
      [2, 1],
      [1, 2],
    ]);
    const sorted = sortEigenvalues(result.result.values);
    expect(sorted[0].re).toBeCloseTo(3, 4);
    expect(sorted[1].re).toBeCloseTo(1, 4);
    expect(result.result.isSymmetric).toBe(true);
  });

  it('finds eigenvalues of 3x3 symmetric matrix', async () => {
    const m = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ];
    const result = await parallelEig(m);
    expect(result.result.values).toHaveLength(3);

    // Sum of eigenvalues = trace = 9
    const sorted = sortEigenvalues(result.result.values);
    const eigSum = sorted.reduce((s, v) => s + v.re, 0);
    expect(eigSum).toBeCloseTo(9, 3);
  });

  it('finds eigenvalues of diagonal matrix', async () => {
    const m = [
      [5, 0, 0],
      [0, 3, 0],
      [0, 0, -1],
    ];
    const result = await parallelEig(m);
    const sorted = sortEigenvalues(result.result.values);
    expect(sorted[0].re).toBeCloseTo(5, 4);
    expect(sorted[1].re).toBeCloseTo(3, 4);
    expect(sorted[2].re).toBeCloseTo(-1, 4);
  });

  it('reports duration', async () => {
    const result = await parallelEig([
      [2, 0],
      [0, 3],
    ]);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });

  it('uses sequential for small matrices', async () => {
    const result = await parallelEig(
      [
        [1, 0],
        [0, 1],
      ],
      { threshold: 500 }
    );
    expect(result.parallelized).toBe(false);
  });

  it('respects forceSequential option', async () => {
    const result = await parallelEig(
      [
        [2, 1],
        [1, 2],
      ],
      { forceSequential: true }
    );
    expect(result.parallelized).toBe(false);
  });

  it('throws on non-square matrix', async () => {
    await expect(
      parallelEig([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).rejects.toThrow('Matrix must be square');
  });

  it('handles 4x4 symmetric matrix', async () => {
    const m = [
      [4, 1, 0, 0],
      [1, 3, 1, 0],
      [0, 1, 2, 1],
      [0, 0, 1, 1],
    ];
    const result = await parallelEig(m);
    expect(result.result.values).toHaveLength(4);

    // Sum of eigenvalues = trace = 10
    const eigSum = result.result.values.reduce((s, v) => s + v.re, 0);
    expect(eigSum).toBeCloseTo(10, 2);
  });

  it('handles matrix with negative eigenvalues', async () => {
    const m = [
      [-2, 0],
      [0, -5],
    ];
    const result = await parallelEig(m);
    const sorted = sortEigenvalues(result.result.values);
    expect(sorted[0].re).toBeCloseTo(-2, 4);
    expect(sorted[1].re).toBeCloseTo(-5, 4);
  });
});

describe('parallelEigvals', () => {
  it('returns only eigenvalues', async () => {
    const result = await parallelEigvals([
      [3, 1],
      [1, 3],
    ]);
    expect(result.result).toHaveLength(2);
    const sorted = sortEigenvalues(result.result);
    expect(sorted[0].re).toBeCloseTo(4, 4);
    expect(sorted[1].re).toBeCloseTo(2, 4);
    expect(result.parallelized).toBe(false);
  });

  it('handles diagonal matrix', async () => {
    const result = await parallelEigvals([
      [10, 0],
      [0, 20],
    ]);
    const sorted = sortEigenvalues(result.result);
    expect(sorted[0].re).toBeCloseTo(20, 4);
    expect(sorted[1].re).toBeCloseTo(10, 4);
  });
});
