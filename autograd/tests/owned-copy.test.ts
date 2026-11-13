import { describe, it, expect } from 'vitest';
import { Tensor, slice } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor, DualTensor } from '@danielsimonjr/mathts-autograd';

describe('autograd lifts a Tensor into storage it owns', () => {
  it('a TapedTensor input does not alias a dense Tensor', () => {
    const t = new Tensor([3], new Float64Array([1, 2, 3]));
    const x = TapedTensor.fromTensorAsInput(t, new Tape());
    t.buffer[0] = 99;
    expect(Array.from(x.data)).toEqual([1, 2, 3]);
  });
  it('a DualTensor holds the logical values of a reversed view', () => {
    const v = slice(new Tensor([4], new Float64Array([0, 1, 2, 3])), [{ step: -1 }]);
    const d = DualTensor.fromTensor(v);
    expect(Array.from(d.primal)).toEqual([3, 2, 1, 0]);
    expect(d.tangent.length).toBe(4);
  });
});
