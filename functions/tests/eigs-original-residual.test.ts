import { describe, expect, it } from 'vitest';
import { bignumber, complex, eigs } from '../src/index.js';
import type { Complex } from '@danielsimonjr/mathts-core';

function random(seed: number): () => number {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

type Result = { eigenvectors: { value: unknown; vector: unknown[] }[] };

function asComplex(value: unknown): Complex {
  if (typeof value === 'object' && value !== null && 're' in value) return value as Complex;
  return complex(Number(value)) as Complex;
}

function verifyResiduals(matrix: Complex[][], result: Result, tolerance: number): void {
  const scale = Math.max(...matrix.flat().map((z) => z.abs()));
  expect(result.eigenvectors.length).toBeGreaterThan(0);
  for (const { value, vector } of result.eigenvectors) {
    const lambda = asComplex(value);
    const v = vector.map(asComplex);
    const norm = Math.hypot(...v.map((z) => z.abs()));
    expect(norm).toBeGreaterThan(0);
    for (const [i, row] of matrix.entries()) {
      const residual = row
        .reduce((sum, a, j) => sum.add(a.mul(v[j])), lambda.mul(v[i]).neg())
        .abs();
      expect(residual / scale / norm).toBeLessThan(tolerance);
    }
  }
}

describe('eigs residuals in the input coordinates', () => {
  it('returns three accurate vectors for 60 nearly upper triangular Complex matrices (#1301)', () => {
    const next = random(123);
    for (let trial = 0; trial < 60; trial++) {
      const matrix = Array.from({ length: 3 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => {
          const scale = i > j ? 1e-9 : 1;
          return complex((next() - 0.5) * scale, (next() - 0.5) * scale) as Complex;
        })
      );
      const result = eigs(matrix) as unknown as Result;
      expect(result.eigenvectors).toHaveLength(3);
      verifyResiduals(matrix, result, 1e-12);
    }
  });

  it.each([1, 2 ** 40, 2 ** -60])(
    'verifies vectors of dense defective matrices at scale %s (#1299)',
    (scale) => {
      const next = random(52);
      for (let trial = 0; trial < 16; trial++) {
        const matrix = [
          [1, 1, 0],
          [0, 1, 0],
          [0, 0, 3],
        ];
        // Apply integer elementary similarities to a Jordan block and a simple eigenvalue.
        for (let step = 0; step < 6; step++) {
          const i = Math.floor(next() * 3);
          const j = (i + 1 + Math.floor(next() * 2)) % 3;
          const factor = next() < 0.5 ? -1 : 1;
          for (let k = 0; k < 3; k++) matrix[i][k] += factor * matrix[j][k];
          for (let k = 0; k < 3; k++) matrix[k][j] -= factor * matrix[k][i];
        }
        const numeric = matrix.map((row) => row.map((x) => x * scale));
        const complexMatrix = numeric.map((row) => row.map(asComplex));
        const bigMatrix = numeric.map((row) => row.map((x) => bignumber(x)));
        verifyResiduals(complexMatrix, eigs(complexMatrix) as unknown as Result, 1e-6);
        verifyResiduals(complexMatrix, eigs(bigMatrix) as unknown as Result, 1e-6);
      }
    }
  );
});
