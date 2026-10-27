/**
 * Sprint 2R clone-merge (TapedTensor.max / min) — independent oracles for
 * forward values, strict first-wins ties, unique argmax/argmin scatter, and
 * empty tensors. Expected gradients are written by hand, not via Tensor.max.
 */
import { describe, it, expect } from 'vitest';
import { Tape, TapedTensor } from '../src/tape.js';

function taped(data: Float64Array, shape: number[]): { leaf: TapedTensor; id: number; tape: Tape } {
  const tape = new Tape();
  const { id } = tape.allocate(data.length);
  const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
  return { leaf, id, tape };
}

describe('TapedTensor extrema oracle — forward value', () => {
  it('max() forward is the unique maximum', () => {
    const { leaf } = taped(new Float64Array([1, 5, 3]), [3]);
    expect(leaf.max().primal[0]).toBe(5);
  });

  it('min() forward is the unique minimum', () => {
    const { leaf } = taped(new Float64Array([4, 2, 9]), [3]);
    expect(leaf.min().primal[0]).toBe(2);
  });

  it('max() forward of a tie is that tied value', () => {
    const { leaf } = taped(new Float64Array([3, 3, 1]), [3]);
    expect(leaf.max().primal[0]).toBe(3);
  });

  it('min() forward of a tie is that tied value', () => {
    const { leaf } = taped(new Float64Array([4, 4, 9]), [3]);
    expect(leaf.min().primal[0]).toBe(4);
  });
});

describe('TapedTensor extrema oracle — unique scatter', () => {
  it('max() sends dY only to the unique argmax', () => {
    const { leaf, id, tape } = taped(new Float64Array([1, 5, 3]), [3]);
    tape.backward(leaf.max().id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(Array.from(grad)).toEqual([0, 1, 0]);
  });

  it('min() sends dY only to the unique argmin', () => {
    const { leaf, id, tape } = taped(new Float64Array([4, 2, 9]), [3]);
    tape.backward(leaf.min().id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(Array.from(grad)).toEqual([0, 1, 0]);
  });
});

describe('TapedTensor extrema oracle — first-wins ties', () => {
  it('max() with ties places dY at the first argmax index', () => {
    const { leaf, id, tape } = taped(new Float64Array([3, 3, 1]), [3]);
    const out = leaf.max();
    expect(out.primal[0]).toBe(3);
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(Array.from(grad)).toEqual([1, 0, 0]);
  });

  it('min() with ties places dY at the first argmin index', () => {
    const { leaf, id, tape } = taped(new Float64Array([4, 4, 9]), [3]);
    const out = leaf.min();
    expect(out.primal[0]).toBe(4);
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(Array.from(grad)).toEqual([1, 0, 0]);
  });

  it('max(axis=1) first-wins per row on a 2×2', () => {
    // [[3, 3], [1, 4]] → row maxima 3 (index 0) and 4 (index 1)
    const { leaf, id, tape } = taped(new Float64Array([3, 3, 1, 4]), [2, 2]);
    const out = leaf.max(1);
    expect(Array.from(out.primal)).toEqual([3, 4]);
    tape.backward(out.id, new Float64Array([1, 1]));
    const grad = tape.getInputGrad(id)!;
    expect(Array.from(grad)).toEqual([1, 0, 0, 1]);
  });
});

describe('TapedTensor extrema oracle — empty tensor', () => {
  it('max() of shape [0] is scalar -Infinity with an empty input gradient', () => {
    const { leaf, id, tape } = taped(new Float64Array(0), [0]);
    const out = leaf.max();
    expect(out.shape).toEqual([]);
    expect(out.primal[0]).toBe(-Infinity);
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad.length).toBe(0);
  });

  it('min() of shape [0] is scalar Infinity with an empty input gradient', () => {
    const { leaf, id, tape } = taped(new Float64Array(0), [0]);
    const out = leaf.min();
    expect(out.shape).toEqual([]);
    expect(out.primal[0]).toBe(Infinity);
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad.length).toBe(0);
  });
});
