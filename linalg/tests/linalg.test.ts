import { describe, it, expect } from 'vitest';
import * as linalg from '../src/index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import type { LUResult, QRPivotedResult, LQResult, RQResult, QLResult } from '../src/index.js';

/**
 * Re-export of the decomposition operations from
 * `@danielsimonjr/mathts-matrix`. These verify the re-exported operations are
 * present and callable. Full decomposition correctness is covered by the matrix
 * package's own SVD/eig/QR/LU/Cholesky/Schur tests.
 */
describe('@danielsimonjr/mathts-linalg re-export surface', () => {
  it('exposes the decomposition operations', () => {
    const ops = [
      'eig',
      'eigvals',
      'powerIteration',
      'svd',
      'singularValues',
      'pinv',
      'lowRankApprox',
      'cond',
      'norm2',
      'normFro',
      'eigWasm',
      'eigvalsWasm',
      'spectralRadiusWasm',
      'svdWasm',
      'matrixPinv',
      'qr',
      'lu',
      'cholesky',
      'luSolve',
      'qrPivoted',
      'lq',
      'rq',
      'ql',
      'condest',
      'transposeNestedArray',
      'matrixExpm',
      'matrixLogm',
      'matrixSqrtm',
      'matrixSchur',
    ];
    for (const name of ops) {
      expect(typeof (linalg as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('@danielsimonjr/mathts-linalg QR-family and solve re-exports', () => {
  it('re-exported types and functions work together', () => {
    const A = new DenseMatrix(2, 2, [4, 3, 6, 3]);
    const fac: LUResult = linalg.lu(A);
    expect(Array.isArray(linalg.luSolve(fac, [1, 2]))).toBe(true);
    const p: QRPivotedResult = linalg.qrPivoted(A);
    const l: LQResult = linalg.lq(A);
    const r: RQResult = linalg.rq(A);
    const q: QLResult = linalg.ql(A);
    expect(p).toBeDefined();
    expect(l).toBeDefined();
    expect(r).toBeDefined();
    expect(q).toBeDefined();
    expect(linalg.condest(A)).toBeGreaterThan(0);
    expect(linalg.transposeNestedArray([[1, 2, 3]])).toEqual([[1], [2], [3]]);
  });
});
