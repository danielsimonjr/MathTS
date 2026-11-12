/**
 * Oracle pins for shared assertSameShape (Sprint 2R clone G7).
 * Independent of implementation: exact error prefix and equal-shape pass.
 */
import { describe, it, expect } from 'vitest';
import { DualTensor } from '../src/dual-tensor.js';
import { Tape, TapedTensor } from '../src/tape.js';

function dual(shape: number[], data: number[]): DualTensor {
  const primal = new Float64Array(data);
  const tangent = new Float64Array(data.length);
  return new DualTensor(shape, primal, tangent);
}

function tapedLeaf(tape: Tape, shape: number[], data: number[]): { leaf: TapedTensor; id: number } {
  const buf = new Float64Array(data);
  const { id } = tape.allocate(buf.length);
  const leaf = new TapedTensor(shape, buf, tape, id);
  return { leaf, id };
}

describe('assertSameShape oracle (DualTensor / TapedTensor)', () => {
  it('equal shapes pass for DualTensor.add', () => {
    const a = dual([2], [1, 2]);
    const b = dual([2], [3, 4]);
    expect(a.add(b).primal).toEqual(new Float64Array([4, 6]));
  });

  it('DualTensor.add broadcasts [2] + [2,1] to [2,2]', () => {
    const a = dual([2], [1, 2]);
    const b = dual([2, 1], [10, 20]);
    const out = a.add(b);
    expect(out.shape).toEqual([2, 2]);
    expect(out.primal[0]).toBe(11);
    expect(out.primal[3]).toBe(22);
  });

  it('DualTensor.add throws when shapes are not broadcastable', () => {
    const a = dual([2, 3], [1, 2, 3, 4, 5, 6]);
    const b = dual([2, 4], Array.from(new Float64Array(8)));
    expect(() => a.add(b)).toThrow(/cannot be broadcast/);
  });

  it('equal shapes pass for TapedTensor.add', () => {
    const tape = new Tape();
    const { leaf: a } = tapedLeaf(tape, [2], [1, 2]);
    const { leaf: b } = tapedLeaf(tape, [2], [3, 4]);
    expect(a.add(b).primal).toEqual(new Float64Array([4, 6]));
  });

  it('TapedTensor.add broadcasts [2] + [2,1] to [2,2]', () => {
    const tape = new Tape();
    const { leaf: a } = tapedLeaf(tape, [2], [1, 2]);
    const { leaf: b } = tapedLeaf(tape, [2, 1], [10, 20]);
    const out = a.add(b);
    expect(out.shape).toEqual([2, 2]);
    expect(out.primal[0]).toBe(11);
    expect(out.primal[3]).toBe(22);
  });

  it('TapedTensor.add throws when shapes are not broadcastable', () => {
    const tape = new Tape();
    const { leaf: a } = tapedLeaf(tape, [2, 3], [1, 2, 3, 4, 5, 6]);
    const { leaf: b } = tapedLeaf(tape, [2, 4], Array.from(new Float64Array(8)));
    expect(() => a.add(b)).toThrow(/cannot be broadcast/);
  });
});
