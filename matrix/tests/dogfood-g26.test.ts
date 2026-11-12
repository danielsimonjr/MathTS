/**
 * Dogfood G26 — DenseMatrix.multiply GEMM (#693) and SVD accuracy (#699).
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { DenseMatrix, matMul, svd } from '../src/index.js';
import { Matrix as MLMatrix, SVD as MLSvd } from 'ml-matrix';

function medianTime(fn: () => void, warmup: number, reps: number): number {
  for (let i = 0; i < warmup; i++) fn();
  const xs: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    xs.push(performance.now() - t0);
  }
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

function randSpd(n: number, seed: number): number[][] {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = rnd();
      A[i][j] += v;
      A[j][i] += v;
    }
    A[i][i] += n;
  }
  return A;
}

describe('G26 #693 DenseMatrix.multiply vs ml-matrix', () => {
  it('n=1000 median ≤ 1.15× ml-matrix mmul (issue AC)', () => {
    const n = 1000;
    const A = randSpd(n, 42);
    const B = randSpd(n, 99);
    const AD = DenseMatrix.fromArray(A);
    const BD = DenseMatrix.fromArray(B);
    const AM = new MLMatrix(A);
    const BM = new MLMatrix(B);
    const tMl = medianTime(() => {
      AM.mmul(BM);
    }, 2, 3);
    const tMathTs = medianTime(() => {
      AD.multiply(BD);
    }, 2, 3);
    expect(tMathTs / tMl).toBeLessThan(1.15);
  }, 120_000);

  it('matMul nested matches DenseMatrix.multiply on a spot check', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const B = [
      [5, 6],
      [7, 8],
    ];
    expect(matMul(A, B)).toEqual(ADmultiply(A, B));
  });
});

function ADmultiply(A: number[][], B: number[][]): number[][] {
  const C = DenseMatrix.fromArray(A).multiply(DenseMatrix.fromArray(B));
  return C.toArray();
}

describe('G26 #699 svd accuracy vs ml-matrix (3×3)', () => {
  it('singular values match ml-matrix within 7e-15', () => {
    const A = [
      [1, 2, 3],
      [0, 4, 5],
      [0, 0, 6],
    ];
    const { S } = svd(A);
    const ml = new MLSvd(new MLMatrix(A));
    const sv = ml.diagonal;
    for (let i = 0; i < S.length; i++) {
      expect(Math.abs(S[i] - sv[i])).toBeLessThan(7.1e-15);
    }
  });
});
