/**
 * #902 — slice with a negative step follows the NumPy defaults.
 *
 * Checks the logical elements of a slice (read through `contiguous()`).
 * Each expected list is what NumPy returns for the same input.
 */
import { describe, it, expect } from 'vitest';
import { Tensor, slice } from '@danielsimonjr/mathts-tensor';

const five = () => new Tensor([5], new Float64Array([0, 1, 2, 3, 4]));

describe('#902 negative-step slice (logical elements)', () => {
  it('step -1 reverses a vector (t[::-1])', () => {
    const r = slice(five(), [{ step: -1 }]);
    expect([...r.contiguous().data]).toEqual([4, 3, 2, 1, 0]);
  });

  it('explicit start and stop past the ends reverse the vector', () => {
    const r = slice(five(), [{ start: 4, stop: -6, step: -1 }]);
    expect([...r.contiguous().data]).toEqual([4, 3, 2, 1, 0]);
  });

  it('start-only negative step (t[3::-1])', () => {
    const r = slice(five(), [{ start: 3, step: -1 }]);
    expect([...r.contiguous().data]).toEqual([3, 2, 1, 0]);
  });

  it('negative step of 2 (t[::-2])', () => {
    const r = slice(five(), [{ step: -2 }]);
    expect([...r.contiguous().data]).toEqual([4, 2, 0]);
  });

  it('positive step and start offset keep their logical elements', () => {
    expect([...slice(five(), [{ step: 2 }]).contiguous().data]).toEqual([0, 2, 4]);
    expect([...slice(five(), [{ start: 2 }]).contiguous().data]).toEqual([2, 3, 4]);
  });

  it('reverses one axis of a matrix (x[:, ::-1])', () => {
    const m = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const r = slice(m, [null, { step: -1 }]);
    expect([...r.shape]).toEqual([2, 3]);
    expect([...r.contiguous().data]).toEqual([3, 2, 1, 6, 5, 4]);
  });
});
