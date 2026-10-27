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

  it('DualTensor.add throws shape mismatch for [2] vs [2,1]', () => {
    const a = dual([2], [1, 2]);
    const b = dual([2, 1], [1, 2]);
    expect(() => a.add(b)).toThrowError(/^DualTensor\.add: shape mismatch \[2\] vs \[2,1\]/);
  });

  it('equal shapes pass for TapedTensor.add', () => {
    const tape = new Tape();
    const { leaf: a } = tapedLeaf(tape, [2], [1, 2]);
    const { leaf: b } = tapedLeaf(tape, [2], [3, 4]);
    expect(a.add(b).primal).toEqual(new Float64Array([4, 6]));
  });

  it('TapedTensor.add throws shape mismatch for [2] vs [2,1]', () => {
    const tape = new Tape();
    const { leaf: a } = tapedLeaf(tape, [2], [1, 2]);
    const { leaf: b } = tapedLeaf(tape, [2, 1], [1, 2]);
    expect(() => a.add(b)).toThrowError(/^TapedTensor\.add: shape mismatch \[2\] vs \[2,1\]/);
  });
});
