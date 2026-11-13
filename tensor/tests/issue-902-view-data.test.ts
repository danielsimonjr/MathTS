/**
 * #902 — `.data` returns the logical values of a tensor; `buffer` is the raw storage.
 *
 * A reversed view of [0..4] has the logical values [4,3,2,1,0]. Every op reads
 * those values, never the parent buffer.
 */
import { describe, it, expect } from 'vitest';
import { Tensor, slice, idx } from '@danielsimonjr/mathts-tensor';

const five = () => new Tensor([5], new Float64Array([0, 1, 2, 3, 4]));
const rev = () => slice(five(), [{ step: -1 }]);
const mat = () => new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
// [[3,2,1],[6,5,4]]
const matView = () => slice(mat(), [null, { step: -1 }]);
const vals = (t: Tensor) => [...t.data];

describe('#902 .data of a view', () => {
  it('returns the logical values for the issue repro', () => {
    expect(vals(rev())).toEqual([4, 3, 2, 1, 0]);
    expect(vals(slice(five(), [{ start: 4, stop: -6, step: -1 }]))).toEqual([4, 3, 2, 1, 0]);
    expect(vals(slice(five(), [{ step: 2 }]))).toEqual([0, 2, 4]);
    expect(vals(slice(five(), [{ start: 2 }]))).toEqual([2, 3, 4]);
  });

  it('keeps the raw storage in buffer', () => {
    const v = rev();
    expect([...v.buffer]).toEqual([0, 1, 2, 3, 4]);
    expect(v.offset).toBe(4);
    expect(v.strides).toEqual([-1]);
  });

  it('returns the same Float64Array as buffer for a dense tensor', () => {
    const raw = new Float64Array([1, 2, 3]);
    const t = new Tensor([3], raw);
    expect(t.data).toBe(raw);
    expect(t.buffer).toBe(raw);
  });

  it('returns a dense copy for a view', () => {
    const v = rev();
    expect(v.data).not.toBe(v.buffer);
    v.data[0] = 99;
    expect([...v.buffer]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('#902 ops on a view as the left-hand operand', () => {
  it('element-wise ops with a number', () => {
    expect(vals(rev().add(1))).toEqual([5, 4, 3, 2, 1]);
    expect(vals(rev().sub(1))).toEqual([3, 2, 1, 0, -1]);
    expect(vals(rev().mul(2))).toEqual([8, 6, 4, 2, 0]);
    expect(vals(rev().div(2))).toEqual([2, 1.5, 1, 0.5, 0]);
    expect(vals(rev().scale(3))).toEqual([12, 9, 6, 3, 0]);
    expect(vals(rev().neg())).toEqual([-4, -3, -2, -1, -0]);
    expect(vals(rev().map((x) => x * 10))).toEqual([40, 30, 20, 10, 0]);
  });

  it('element-wise ops with a tensor', () => {
    const ones = new Tensor([5], new Float64Array(5).fill(1));
    expect(vals(rev().add(ones))).toEqual([5, 4, 3, 2, 1]);
    expect(vals(rev().sub(ones))).toEqual([3, 2, 1, 0, -1]);
    expect(vals(rev().mul(ones))).toEqual([4, 3, 2, 1, 0]);
    expect(vals(rev().div(ones))).toEqual([4, 3, 2, 1, 0]);
    const m = new Tensor([2, 3], new Float64Array([1, 1, 1, 1, 1, 1]));
    expect(vals(matView().add(m))).toEqual([4, 3, 2, 7, 6, 5]);
    expect(vals(matView().add(new Tensor([3], new Float64Array([10, 20, 30]))))).toEqual([
      13, 22, 31, 16, 25, 34,
    ]);
  });

  it('normInf, toNested, toDenseMatrix, clone', () => {
    expect(rev().normInf()).toBe(4);
    expect(matView().toNested()).toEqual([
      [3, 2, 1],
      [6, 5, 4],
    ]);
    expect([...matView().toDenseMatrix().toFloat64Array()]).toEqual([3, 2, 1, 6, 5, 4]);
    expect(vals(matView().clone())).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it('transpose and reductions', () => {
    expect(vals(matView().transpose())).toEqual([3, 6, 2, 5, 1, 4]);
    expect(vals(matView().sum(0))).toEqual([9, 7, 5]);
    expect(vals(matView().reshape([3, 2]))).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it('dot, matmul, tensordot, einsum', () => {
    const w = new Tensor([5], new Float64Array([1, 0, 0, 0, 0]));
    expect(rev().dot(w)).toBe(4);
    const x = new Tensor([1, 2], new Float64Array([1, 0]));
    expect(vals(x.matmul(matView()))).toEqual([3, 2, 1]);
    const spec = { contractions: [], free: [{ operand: 0, axis: 0 }] };
    const view3 = slice(new Tensor([3], new Float64Array([1, 2, 3])), [{ step: -1 }]);
    expect(vals(Tensor.einsum(spec, view3))).toEqual([3, 2, 1]);
  });

  it('in-place ops write through to the parent buffer', () => {
    const base = five();
    const v = slice(base, [{ step: -1 }]);
    v.add_(10);
    expect([...base.buffer]).toEqual([10, 11, 12, 13, 14]);
    v.mul_(new Tensor([5], new Float64Array([1, 1, 1, 1, 2])));
    expect([...base.buffer]).toEqual([20, 11, 12, 13, 14]);
  });

  it('replaceIndex keeps the logical values of a labeled view', () => {
    const i = idx(5, 'i');
    const j = idx(5, 'j');
    const t = new Tensor([5], new Float64Array([0, 1, 2, 3, 4]), [i]);
    const v = slice(t, [{ step: -1 }]);
    const r = v.replaceIndex(i, j);
    expect(vals(r)).toEqual([4, 3, 2, 1, 0]);
  });
});

describe('#902 slice keeps the label of an axis kept at full extent', () => {
  it('contract works on a labeled slice', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const A = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]), [i, j]);
    const v = new Tensor([3], new Float64Array([1, 1, 1]), [j]);
    const s = slice(A, [null, null]);
    expect(s.axisLabels![1]).toBe(j);
    expect(vals(s.contract(v))).toEqual([6, 15]);
  });
});
