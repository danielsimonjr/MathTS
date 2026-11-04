import { describe, it, expect } from 'vitest';
import { Tensor, idx } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor, assertSameTape } from '../src/tape.js';

function leaf(tape: Tape, data: number[], shape: number[] = [data.length]): TapedTensor {
  return TapedTensor.fromTensorAsInput(new Tensor(shape, Float64Array.from(data)), tape);
}

describe('assertSameTape', () => {
  it('throws a clear error when binary ops mix tapes', () => {
    const t1 = new Tape();
    const t2 = new Tape();
    const a = leaf(t1, [1, 2]);
    const b = leaf(t2, [3, 4]);
    expect(() => a.add(b)).toThrow(/different Tapes/);
    expect(() => a.sub(b)).toThrow(/different Tapes/);
    expect(() => a.mul(b)).toThrow(/different Tapes/);
    expect(() => a.divide(b)).toThrow(/different Tapes/);
    expect(() => a.pow(b)).toThrow(/different Tapes/);
    expect(() => a.atan2(b)).toThrow(/different Tapes/);
    const m1 = leaf(t1, [1, 2, 3, 4], [2, 2]);
    const m2 = leaf(t2, [1, 2, 3, 4], [2, 2]);
    expect(() => m1.matmul(m2)).toThrow(/different Tapes/);
    expect(() => m1.tensordot(m2, [[1, 0]])).toThrow(/different Tapes/);
    const i = idx(2);
    const c1 = TapedTensor.fromTensorAsInput(new Tensor([2], Float64Array.of(1, 2), [i]), t1);
    const c2 = TapedTensor.fromTensorAsInput(new Tensor([2], Float64Array.of(1, 2), [i]), t2);
    expect(() => c1.contract(c2)).toThrow(/different Tapes/);
  });
  it('is a no-op for operands on the same tape', () => {
    const t = new Tape();
    expect(() => assertSameTape(leaf(t, [1]), leaf(t, [2]))).not.toThrow();
    expect(Array.from(leaf(t, [1, 2]).add(leaf(t, [3, 4])).primal)).toEqual([4, 6]);
  });
});

describe('Tape.backward range and reset', () => {
  it('only replays nodes up to the output op', () => {
    const tape = new Tape();
    const x = leaf(tape, [2, 3]);
    const y = x.mul(x); // op 0
    const z = y.scale(10); // op 1, recorded after y
    // backward from y must not run z's closure
    tape.backward(y.id, Float64Array.of(1, 1));
    expect(Array.from(tape.getInputGrad(x.id)!)).toEqual([4, 6]);
    expect(Array.from(tape.getInputGrad(z.id)!)).toEqual([0, 0]);
    expect(Array.from(tape.getInputGrad(y.id)!)).toEqual([1, 1]);
  });
  it('full backward from the last op is unchanged', () => {
    const tape = new Tape();
    const x = leaf(tape, [2, 3]);
    const z = x.mul(x).scale(10);
    tape.backward(z.id, Float64Array.of(1, 1));
    expect(Array.from(tape.getInputGrad(x.id)!)).toEqual([40, 60]);
  });
  it('reset clears nodes, closures and slots, and the tape is reusable', () => {
    const tape = new Tape();
    const x = leaf(tape, [2, 3]);
    const y = x.mul(x);
    tape.reset();
    expect(tape.getInputGrad(x.id)).toBeUndefined();
    expect(tape.getInputGrad(y.id)).toBeUndefined();
    expect(() => tape.backward(y.id, Float64Array.of(1, 1))).toThrow(/unknown outputId/);
    const x2 = leaf(tape, [5]);
    const y2 = x2.mul(x2);
    tape.backward(y2.id, Float64Array.of(1));
    expect(Array.from(tape.getInputGrad(x2.id)!)).toEqual([10]);
  });
});
