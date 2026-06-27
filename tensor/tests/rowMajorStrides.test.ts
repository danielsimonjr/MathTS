import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

/**
 * Focused unit tests for the canonical `Tensor.rowMajorStrides` helper.
 *
 * This is the single shared implementation for Duplication Audit Cluster H —
 * formerly duplicated in `tensor/src/operations/kron.ts` and
 * `autograd/src/tape.ts` (both now delegate here). `parallel`'s local copy is
 * retained by design across a dependency boundary; these tests pin the exact
 * row-major contract so any divergence would surface.
 */
describe('Tensor.rowMajorStrides', () => {
  it('returns [] for a scalar (rank-0) shape', () => {
    expect(Tensor.rowMajorStrides([])).toEqual([]);
  });

  it('returns [1] for a rank-1 shape', () => {
    expect(Tensor.rowMajorStrides([5])).toEqual([1]);
  });

  it('computes contiguous row-major strides for a rank-2 shape', () => {
    // shape [2, 3]: stride for axis 1 is 1, axis 0 is 3.
    expect(Tensor.rowMajorStrides([2, 3])).toEqual([3, 1]);
  });

  it('computes contiguous row-major strides for a rank-3 shape', () => {
    // shape [2, 3, 4]: strides = [3*4, 4, 1] = [12, 4, 1].
    expect(Tensor.rowMajorStrides([2, 3, 4])).toEqual([12, 4, 1]);
  });

  it('handles a leading size-1 dimension', () => {
    // shape [1, 3, 4]: strides = [3*4, 4, 1] = [12, 4, 1].
    expect(Tensor.rowMajorStrides([1, 3, 4])).toEqual([12, 4, 1]);
  });

  it('handles a size-0 dimension (stride collapses past the zero)', () => {
    // shape [2, 0, 4]: acc resets to 0 at the zero axis.
    expect(Tensor.rowMajorStrides([2, 0, 4])).toEqual([0, 4, 1]);
  });

  it('strides match flat-index dot product against an explicit walk', () => {
    const shape = [2, 3, 4];
    const strides = Tensor.rowMajorStrides(shape);
    let expectedFlat = 0;
    for (let i = 0; i < shape[0]; i++) {
      for (let j = 0; j < shape[1]; j++) {
        for (let k = 0; k < shape[2]; k++) {
          const flat = i * strides[0] + j * strides[1] + k * strides[2];
          expect(flat).toBe(expectedFlat);
          expectedFlat++;
        }
      }
    }
  });

  it('returns a fresh array each call (no shared mutable state)', () => {
    const a = Tensor.rowMajorStrides([2, 3]);
    const b = Tensor.rowMajorStrides([2, 3]);
    expect(a).not.toBe(b);
    a[0] = 999;
    expect(b[0]).toBe(3);
  });
});
