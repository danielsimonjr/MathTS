/**
 * Dogfood G36 — tensor factories, views, dtype, matmul alias, in-place, slice, cross/dot.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';
import { slice } from '../src/operations/slice';

describe('#751 Tensor.zeros / ones / full / arange', () => {
  it('exact repro: static factories exist and zeros match shape', () => {
    expect(typeof Tensor.zeros).toBe('function');
    expect(typeof Tensor.ones).toBe('function');
    expect(typeof Tensor.full).toBe('function');
    expect(typeof Tensor.arange).toBe('function');
    expect(typeof Tensor.empty).toBe('function');

    const b = Tensor.zeros(1, 4);
    expect([...b.shape]).toEqual([1, 4]);
    expect([...b.data]).toEqual([0, 0, 0, 0]);

    expect([...Tensor.ones(3).data]).toEqual([1, 1, 1]);
    expect(Tensor.full([2, 2], 7).data[3]).toBe(7);
    expect([...Tensor.arange(0, 5).data]).toEqual([0, 1, 2, 3, 4]);
    expect([...Tensor.arange(5).data]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('#752 reshape view and -1 inference', () => {
  it('exact repro: contiguous reshape shares buffer; -1 infers extent', () => {
    const t = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const r = t.reshape([3, 2]);
    t.data[0] = 777;
    expect(r.data[0]).toBe(777);
    expect(r.data.buffer).toBe(t.data.buffer);

    const flat = t.reshape([-1, 2]);
    expect([...flat.shape]).toEqual([3, 2]);
    expect([...flat.data]).toEqual([777, 2, 3, 4, 5, 6]);
  });

  it('non-contiguous strided slice reshape copies', () => {
    const t = new Tensor([6], new Float64Array([1, 2, 3, 4, 5, 6]));
    const s = t.slice([{ start: 0, stop: 6, step: 2 }]);
    expect(s.isContiguous()).toBe(false);
    const r = s.reshape([3]);
    expect([...r.data]).toEqual([1, 3, 5]);
    expect(r.data.buffer).not.toBe(t.data.buffer);
    t.data[0] = 99;
    expect(r.data[0]).toBe(1);
  });
});

describe('#753 matmul alias and batched matmul', () => {
  it('exact repro: batched matmul matches issue oracle', () => {
    const A = new Tensor(
      [2, 2, 2],
      Float64Array.from({ length: 8 }, (_, i) => i + 1)
    );
    const B = new Tensor(
      [2, 2, 2],
      Float64Array.from({ length: 8 }, (_, i) => i + 1)
    );

    const Y = A.matmul(B);
    expect([...Y.shape]).toEqual([2, 2, 2]);
    expect([...Y.data]).toEqual([7, 10, 15, 22, 67, 78, 91, 106]);

    expect(typeof Tensor.prototype.div).toBe('function');
    expect(A.matmul(B).data).toEqual(Y.data);
    expect(A.matMul(B).data).toEqual(Y.data);
  });
});

describe('#760 dtype tag', () => {
  it('exact repro: dtype getter is float64', () => {
    const t = new Tensor([2], new Float64Array([1, 2]));
    expect('dtype' in t).toBe(true);
    expect(t.dtype).toBe('float64');
  });
});

describe('#761 in-place ops', () => {
  it('exact repro: add_, mul_, fill_ exist and mutate in place', () => {
    const data = new Float64Array([1, 2]);
    const t = new Tensor([2], data);
    expect(typeof t.add_).toBe('function');
    expect(typeof t.mul_).toBe('function');
    expect(typeof t.fill_).toBe('function');

    t.add_(1);
    expect([...data]).toEqual([2, 3]);
    expect(t.add_(Tensor.arange(1, 3))).toBe(t);
    expect([...data]).toEqual([3, 5]);

    t.fill_(9);
    expect([...data]).toEqual([9, 9]);
    expect(t.mul_(2)).toBe(t);
    expect([...data]).toEqual([18, 18]);
  });
});

describe('#762 slice negative step and Tensor.slice method', () => {
  it('exact repro: reverse slice along an axis', () => {
    const m = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    const reversed = m.slice([{ step: -1 }, null]);
    expect([...reversed.shape]).toEqual([2, 3]);
    expect([...reversed.contiguous().data]).toEqual([4, 5, 6, 1, 2, 3]);

    const viaFn = slice(m, [{ step: -1 }, null]);
    expect([...viaFn.contiguous().data]).toEqual([...reversed.contiguous().data]);
  });

  it('negative step on a subrange', () => {
    const v = new Tensor([4], new Float64Array([0, 1, 2, 3]));
    const s = slice(v, [{ start: 3, stop: -1, step: -1 }]);
    expect([...s.contiguous().data]).toEqual([3, 2, 1, 0]);
  });
});

describe('#831 cross and dot', () => {
  it('exact repro: 3-vector cross matches right-hand rule', () => {
    const a = new Tensor([3], new Float64Array([1, 0, 0]));
    expect(typeof a.cross).toBe('function');
    expect(typeof a.dot).toBe('function');
    const b = new Tensor([3], new Float64Array([0, 1, 0]));
    expect([...a.cross(b).data]).toEqual([0, 0, 1]);
    expect(a.dot(b)).toBe(0);
    expect(Tensor.arange(1, 4).dot(Tensor.arange(1, 4))).toBe(14);
  });
});
