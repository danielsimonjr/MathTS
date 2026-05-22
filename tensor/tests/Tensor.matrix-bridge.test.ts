import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

/** EXPANSION_PLAN W7 — Tensor ↔ DenseMatrix converters. */
describe('Tensor ↔ DenseMatrix bridge', () => {
  it('builds a rank-2 Tensor from a DenseMatrix', () => {
    const m = DenseMatrix.fromArray([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const t = Tensor.fromDenseMatrix(m);
    expect([...t.shape]).toEqual([3, 3]);
    expect(t.toNested()).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it('round-trips a matrix through the tensor representation', () => {
    const original = [
      [1.5, -2],
      [0, 4.25],
    ];
    const back = Tensor.fromDenseMatrix(DenseMatrix.fromArray(original)).toDenseMatrix();
    expect(back.toArray()).toEqual(original);
  });

  it('rejects converting a non-rank-2 tensor to a matrix', () => {
    const t = new Tensor([2, 2, 2], new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(() => t.toDenseMatrix()).toThrow('rank-2');
  });
});
