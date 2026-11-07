import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';

describe('D6 search linalg exports', () => {
  it('has the primitives search already uses', () => {
    for (const name of [
      'inv',
      'det',
      'ols',
      'matrixRank',
      'rationalNullspace',
      'svd',
      'eigs',
      'leastSquares',
    ] as const) {
      expect(typeof F[name]).toBe('function');
    }
  });
});
