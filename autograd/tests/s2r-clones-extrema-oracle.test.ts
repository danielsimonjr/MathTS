/**
 * Sprint 2R clone-merge (TapedTensor.max / min) — tie-breaking oracle: strict
 * first-wins scatters gradient to the smallest flat index among ties.
 */
import { describe, it, expect } from 'vitest';
import { Tape, TapedTensor } from '../src/tape.js';

describe('TapedTensor extrema tie oracle — first-wins gradient', () => {
  it('max() with ties places dY at the first argmax index', () => {
    const data = new Float64Array([3, 3, 1]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.max();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(1, 12);
    expect(grad[1]).toBeCloseTo(0, 12);
    expect(grad[2]).toBeCloseTo(0, 12);
  });

  it('min() with ties places dY at the first argmin index', () => {
    const data = new Float64Array([4, 4, 9]);
    const shape = [3];
    const tape = new Tape();
    const { id } = tape.allocate(data.length);
    const leaf = new TapedTensor(shape, new Float64Array(data), tape, id);
    const out = leaf.min();
    tape.backward(out.id, new Float64Array([1]));
    const grad = tape.getInputGrad(id)!;
    expect(grad[0]).toBeCloseTo(1, 12);
    expect(grad[1]).toBeCloseTo(0, 12);
    expect(grad[2]).toBeCloseTo(0, 12);
  });
});
