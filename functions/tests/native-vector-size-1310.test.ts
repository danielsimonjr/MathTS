import { DenseMatrix, matrix } from '@danielsimonjr/mathts-matrix';
import { describe, expect, it } from 'vitest';
import { size } from '../src/index.js';

describe('#1310 native vector shape', () => {
  it('distinguishes flat input from a one-row matrix', () => {
    expect(size(matrix([1, 2]))).toEqual([2]);
    expect(size(new DenseMatrix([7]))).toEqual([1]);
    expect(size(DenseMatrix.fromArray([[1, 2]]))).toEqual([1, 2]);
    expect(size(DenseMatrix.zeros(0, 3))).toEqual([0, 3]);
  });
});
