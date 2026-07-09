import { describe, it, expect } from 'vitest';
import * as linalg from '../src/index.js';

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
