import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

describe('Tensor — tensor ops', () => {
  it('matMul multiplies 2x2 matrices', () => {
    const a = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const b = Tensor.fromNested(
      [
        [5, 6],
        [7, 8],
      ],
      [2, 2]
    );
    expect(a.matMul(b).toNested()).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('transpose reverses axes by default', () => {
    const a = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(a.transpose().toNested()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('reshape preserves row-major order', () => {
    const a = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(a.reshape([3, 2]).toNested()).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('einsum contracts a matrix-vector product', () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const v = Tensor.fromNested([10, 20], [2]);
    const spec = {
      contractions: [
        {
          pair: [
            [0, 1],
            [1, 0],
          ] as const,
        },
      ],
      free: [{ operand: 0, axis: 0 }],
    };
    expect(Tensor.einsum(spec, A, v).toNested()).toEqual([50, 110]);
  });

  it('einsum traces a matrix', () => {
    const A = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const spec = {
      contractions: [
        {
          pair: [
            [0, 0],
            [0, 1],
          ] as const,
        },
      ],
      free: [],
    };
    expect(Tensor.einsum(spec, A).toNested()).toBe(5);
  });
});
