/**
 * #904 — a plain Tensor op given a TapedTensor or DualTensor throws a TypeError
 * that names the autograd op. It never returns a tensor with the tape dropped.
 * A taped or dual tensor made from a strided view carries the view's logical values.
 */
import { describe, it, expect } from 'vitest';
import { Tensor, slice } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor, DualTensor } from '@danielsimonjr/mathts-autograd';

const W = new Tensor([2, 4], new Float64Array([1, 0, 2, 0, 0, 1, 0, 2]));
const X = Tensor.fromNested([
  [1, 2],
  [3, 4],
]);
const taped = (t: Tensor) => TapedTensor.fromTensorAsInput(t, new Tape());

describe('#904 plain Tensor op with a TapedTensor operand', () => {
  it('matmul throws a TypeError that names TapedTensor.matmul', () => {
    expect(() => X.matmul(taped(W) as unknown as Tensor)).toThrow(TypeError);
    expect(() => X.matmul(taped(W) as unknown as Tensor)).toThrow(/TapedTensor\.matmul/);
    expect(() => X.matMul(taped(W) as unknown as Tensor)).toThrow(/TapedTensor\.matmul/);
  });

  it('add, sub, mul, contract and tensordot name their autograd op', () => {
    const t = taped(W) as unknown as Tensor;
    const a = new Tensor([2, 4], new Float64Array(8));
    expect(() => a.add(t)).toThrow(/TapedTensor\.add/);
    expect(() => a.sub(t)).toThrow(/TapedTensor\.sub/);
    expect(() => a.mul(t)).toThrow(/TapedTensor\.mul/);
    expect(() => a.add_(t)).toThrow(/TapedTensor\.add/);
    expect(() => a.tensordot(t, [[1, 0]])).toThrow(/TapedTensor\.tensordot/);
  });

  it('an op without an autograd version says so', () => {
    const t = taped(W) as unknown as Tensor;
    const a = new Tensor([2, 4], new Float64Array(8));
    expect(() => a.div(t)).toThrow(/TapedTensor has no div op/);
  });

  it('a DualTensor operand throws too', () => {
    const d = DualTensor.fromTensor(W) as unknown as Tensor;
    expect(() => X.matmul(d)).toThrow(TypeError);
    expect(() => new Tensor([2, 4], new Float64Array(8)).add(d)).toThrow(/DualTensor\.add/);
  });

  it('an unknown object operand throws a TypeError', () => {
    expect(() => X.add({ shape: [2, 2] } as unknown as Tensor)).toThrow(/must be a Tensor/);
  });
});

describe('#904 autograd inputs made from a strided view', () => {
  const view = () =>
    slice(new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6])), [null, { step: -1 }]);

  it('TapedTensor.fromTensorAsInput copies the logical values', () => {
    expect([...taped(view()).data]).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it('DualTensor.fromTensor copies the logical values', () => {
    expect([...DualTensor.fromTensor(view()).data]).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it('a plain Tensor times a view-made TapedTensor weight takes the TapedTensor path', () => {
    const tape = new Tape();
    const w = TapedTensor.fromTensorAsInput(view(), tape);
    const x = TapedTensor.fromTensorAsInput(new Tensor([1, 2], new Float64Array([1, 0])), tape);
    expect([...x.matmul(w).data]).toEqual([3, 2, 1]);
  });
});
