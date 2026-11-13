/**
 * Dogfood G26 — DenseMatrix.multiply GEMM (#693) and SVD accuracy (#699).
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matMul, svd } from '../src/index.js';
import { Matrix as MLMatrix, SVD as MLSvd } from 'ml-matrix';

describe('G26 #693 DenseMatrix.multiply vs ml-matrix', () => {
  // The speed bound against ml-matrix mmul is the "gemm" gate of
  // tools/test/wall-clock-gates.json. It runs in its own CI step, not in this suite.
  it('n=48 product matches ml-matrix mmul', () => {
    const n = 48;
    let s = 42;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    const A = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
    const B = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
    const got = DenseMatrix.fromArray(A).multiply(DenseMatrix.fromArray(B)).toArray();
    const want = new MLMatrix(A).mmul(new MLMatrix(B)).to2DArray();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) expect(got[i][j]).toBeCloseTo(want[i][j], 10);
    }
  });

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
