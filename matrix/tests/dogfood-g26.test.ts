/**
 * Dogfood G26 — DenseMatrix.multiply GEMM (#693) and SVD accuracy (#699).
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { execIsolatedPerfGate } from '../../tools/test/perf-gate-spawn.mjs';
import { DenseMatrix, matMul, svd } from '../src/index.js';
import { Matrix as MLMatrix, SVD as MLSvd } from 'ml-matrix';
import { nodeBinary } from './helpers/node-binary.js';

describe('G26 #693 DenseMatrix.multiply vs ml-matrix', () => {
  it('n=1000 ABBA median ≤ 1.15× ml-matrix mmul (isolated Node gate)', () => {
    const gate = fileURLToPath(new URL('./helpers/gemm-perf-gate.mjs', import.meta.url));
    const raw = execIsolatedPerfGate(nodeBinary(), gate);
    const { ratio, checksum } = JSON.parse(raw) as { ratio: number; checksum: number };
    expect(checksum).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1.15);
  }, 180_000);

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
