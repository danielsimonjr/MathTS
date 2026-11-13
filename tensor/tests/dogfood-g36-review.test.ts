/**
 * Adversarial probes for G36: NumPy arange length, reshape inference,
 * slice bounds, in-place views, and cross/dot length checks.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

describe('G36 review probes', () => {
  it('arange length matches NumPy ceil((stop-start)/step), including float steps', () => {
    expect([...Tensor.arange(0, 1, 0.1).data]).toHaveLength(10);
    expect(Tensor.arange(0, 1, 0.1).data[9]).toBeCloseTo(0.9, 12);
    expect([...Tensor.arange(0.1, 0.4, 0.1).data]).toHaveLength(4);
    expect([...Tensor.arange(0, 5, 1.5).data]).toEqual([0, 1.5, 3, 4.5]);
    expect([...Tensor.arange(1, 0, -0.1).data]).toHaveLength(10);
    expect([...Tensor.arange(5, 1, -1).data]).toEqual([5, 4, 3, 2]);
    expect([...Tensor.arange(1, 5, -1).data]).toEqual([]);
    expect(() => Tensor.arange(0, 1, 0)).toThrow(RangeError);
    const biased = new Tensor([2], new Float64Array([1, 2]));
    expect(biased.add_(new Tensor([1], new Float64Array([3])), -1)).toBe(biased);
    expect([...biased.data]).toEqual([-2, -1]);
  });

  it('reshape accepts one -1, rejects two -1s and a non-divisible size', () => {
    const t = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    expect([...t.reshape([-1]).shape]).toEqual([6]);
    expect(() => t.reshape([-1, -1])).toThrow(/only one dimension can be -1/);
    expect(() => t.reshape([-1, 4])).toThrow(/cannot infer -1/);
    expect(() => t.reshape([4, 2])).toThrow(/size mismatch/);
  });

  it('a contiguous reshape is a view; a negative-step reshape is a copy', () => {
    const t = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const view = t.reshape([6]);
    view.data[1] = 50;
    expect(t.data[1]).toBe(50);

    const rev = t.slice([{ step: -1 }, null]);
    const copied = rev.reshape([6]);
    copied.data[0] = 123;
    expect(t.data[3]).toBe(4);
    expect(copied.data.buffer).not.toBe(t.data.buffer);
  });

  it('slice clips out-of-range bounds and an explicit negative stop', () => {
    const v = Tensor.arange(5);
    expect([...v.slice([{ start: 10, stop: 20 }]).shape]).toEqual([0]);
    expect([...v.slice([{ start: -100, stop: 2 }]).contiguous().data]).toEqual([0, 1]);
    expect([...v.slice([{ start: 10, step: -1 }]).contiguous().data]).toEqual([4, 3, 2, 1, 0]);
    const w = Tensor.arange(4);
    expect([...w.slice([{ start: 3, stop: -1, step: -1 }]).shape]).toEqual([0]);
    expect([...w.slice([{ start: 3, step: -1 }]).contiguous().data]).toEqual([3, 2, 1, 0]);
  });

  it('add_, mul_, and fill_ write through a view and broadcast or reject', () => {
    const base = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const row = base.slice([{ start: 0, stop: 1 }, null]);
    expect(row.fill_(7)).toBe(row);
    expect([...base.data]).toEqual([7, 7, 7, 4, 5, 6]);

    const col = base.slice([null, { start: 2, stop: 3 }]);
    expect(col.add_(1)).toBe(col);
    expect([...base.data]).toEqual([7, 7, 8, 4, 5, 7]);

    const scaled = base.slice([{ step: -1 }, null]);
    expect(scaled.mul_(2)).toBe(scaled);
    expect([...base.data]).toEqual([14, 14, 16, 8, 10, 14]);

    const grid = Tensor.zeros(2, 3);
    grid.add_(new Tensor([3], new Float64Array([1, 2, 3])));
    expect([...grid.data]).toEqual([1, 2, 3, 1, 2, 3]);
    expect(() => grid.add_(new Tensor([2, 2], new Float64Array(4)))).toThrow(/cannot be broadcast/);
  });

  it('cross and dot reject the wrong vector length', () => {
    const a = new Tensor([3], new Float64Array([1, 0, 0]));
    const short = new Tensor([2], new Float64Array([1, 0]));
    expect(() => a.cross(short)).toThrow(/length 3/);
    expect(() => short.cross(a)).toThrow(/length 3/);
    expect(() => a.dot(short)).toThrow(/length mismatch/);
    expect(a.dtype).toBe('float64');
    expect([...new Tensor([2], new Float32Array([1, 2])).data]).toEqual([1, 2]);
  });

  it('matmul and matMul are one function and agree on a batch of rank-2 products', () => {
    const A = new Tensor([2, 2], new Float64Array([1, 2, 3, 4]));
    const B = new Tensor([2, 2], new Float64Array([5, 6, 7, 8]));
    const batchedA = new Tensor([2, 2, 2], new Float64Array([1, 2, 3, 4, 1, 2, 3, 4]));
    const batchedB = new Tensor([2, 2, 2], new Float64Array([5, 6, 7, 8, 5, 6, 7, 8]));
    const one = A.matmul(B);
    const many = batchedA.matmul(batchedB);
    expect([...one.data]).toEqual([19, 22, 43, 50]);
    expect([...many.data.slice(0, 4)]).toEqual([...one.data]);
    expect([...many.data.slice(4)]).toEqual([...one.data]);
    expect(A.matMul(B).data).toEqual(one.data);
  });
});
