import { DenseMatrix, matrix } from '@danielsimonjr/mathts-matrix';
import { describe, expect, it } from 'vitest';
import { evaluate, index, size, subset } from '../src/index.js';

describe('#1310 native vector shape', () => {
  it('distinguishes flat input from a one-row matrix', () => {
    expect(size(matrix([1, 2]))).toEqual([2]);
    expect(size(matrix([]))).toEqual([0]);
    expect(size(new DenseMatrix([7]))).toEqual([1]);
    expect(size(DenseMatrix.fromArray([[1, 2]]))).toEqual([1, 2]);
    expect(size(DenseMatrix.zeros(0, 3))).toEqual([0, 3]);
  });

  it('uses one index for a native vector and two for an explicit row', () => {
    const v = DenseMatrix.fromArray([3, 7]);
    expect(subset(v, index(0))).toBe(3);
    expect(evaluate('v[end]', { v })).toBe(7);
    expect(evaluate('v[1,2]', { v: DenseMatrix.fromArray([[3, 7]]) })).toBe(7);
  });
});
