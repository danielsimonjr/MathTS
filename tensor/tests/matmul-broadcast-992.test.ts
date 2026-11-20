/**
 * #992: `Tensor.matmul` follows the NumPy `matmul` rules.
 *
 * Before the fix both operands needed the same rank of 2 or more and equal batch axes, so
 * `ones(4,3,5) @ ones(5,2)`, a rank-1 operand and a size-1 batch axis threw. Now a rank-1 left
 * operand gets a leading axis and a rank-1 right operand gets a trailing axis (each is removed from
 * the result), and the batch axes are right-aligned and broadcast with `Tensor.broadcastShape`.
 *
 * `ones` cannot see a wrong batch index or a swapped axis, so the value tests use distinct
 * entries and compare each batch slice with the rank-2 product of the two slices that the NumPy
 * rule selects.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

/** A tensor whose entry i (row-major) is `i + 1`. */
function seq(...shape: number[]): Tensor {
  const size = shape.reduce((p, d) => p * d, 1);
  return new Tensor(
    shape,
    Float64Array.from({ length: size }, (_, i) => i + 1)
  );
}

/** The rank-2 slab `index` of a tensor of shape [...batch, r, c], as a rank-2 tensor. */
function slab(t: Tensor, index: number): Tensor {
  const r = t.shape[t.shape.length - 2]!;
  const c = t.shape[t.shape.length - 1]!;
  const d = t.data;
  return new Tensor([r, c], d.slice(index * r * c, (index + 1) * r * c));
}

/**
 * The expected batched product by the NumPy rule: for each output batch coordinate, take the
 * slab of each operand at its right-aligned coordinate (a size-1 axis reads index 0) and use
 * the rank-2 `matmul`, which this fix does not change.
 */
function expected(a: Tensor, b: Tensor): { shape: number[]; data: number[] } {
  const batchA = a.shape.slice(0, -2);
  const batchB = b.shape.slice(0, -2);
  const rank = Math.max(batchA.length, batchB.length);
  const batch: number[] = [];
  for (let i = 0; i < rank; i++) {
    const da = batchA[batchA.length - rank + i] ?? 1;
    const db = batchB[batchB.length - rank + i] ?? 1;
    batch.push(Math.max(da, db));
  }
  const flatIndex = (coords: number[], own: number[]): number => {
    let idx = 0;
    for (let i = 0; i < own.length; i++) {
      const axis = rank - own.length + i;
      const c = own[i] === 1 ? 0 : coords[axis]!;
      idx = idx * own[i]! + c;
    }
    return idx;
  };
  const total = batch.reduce((p, d) => p * d, 1);
  const out: number[] = [];
  let shape: number[] = [];
  const coords = new Array<number>(rank).fill(0);
  for (let n = 0; n < total; n++) {
    const prod = slab(a, flatIndex(coords, batchA)).matmul(slab(b, flatIndex(coords, batchB)));
    shape = [...prod.shape];
    out.push(...prod.data);
    for (let k = rank - 1; k >= 0; k--) {
      if (++coords[k]! < batch[k]!) break;
      coords[k] = 0;
    }
  }
  return { shape: [...batch, ...shape], data: out };
}

describe('#992 Tensor.matmul batch broadcast', () => {
  it('ones(4,3,5) @ ones(5,2) has shape [4,3,2] and every entry 5', () => {
    const y = Tensor.ones(4, 3, 5).matmul(Tensor.ones(5, 2));
    expect(y.shape).toEqual([4, 3, 2]);
    expect([...y.data]).toEqual(new Array(24).fill(5));
  });
  it('ones(1,2,2) @ ones(3,2,2) has shape [3,2,2] (a size-1 batch axis)', () => {
    const y = Tensor.ones(1, 2, 2).matmul(Tensor.ones(3, 2, 2));
    expect(y.shape).toEqual([3, 2, 2]);
    expect([...y.data]).toEqual(new Array(12).fill(2));
  });
  for (const [sa, sb] of [
    [
      [2, 1, 2, 3],
      [3, 3, 2],
    ],
    [
      [1, 2, 2],
      [3, 2, 2],
    ],
    [
      [3, 2, 2],
      [1, 2, 2],
    ],
    [
      [4, 3, 5],
      [5, 2],
    ],
    [
      [2, 3],
      [4, 3, 2],
    ],
  ] as number[][][]) {
    it(`distinct values: [${sa}] @ [${sb}] equals the slab-by-slab rank-2 products`, () => {
      const a = seq(...sa);
      const b = seq(...sb);
      const y = a.matmul(b);
      const e = expected(a, b);
      expect([...y.shape]).toEqual(e.shape);
      expect([...y.data]).toEqual(e.data);
      expect([...a.matMul(b).data]).toEqual([...y.data]);
    });
  }
  it('a transposed right operand gives the right values', () => {
    const a = seq(2, 3, 4);
    const bt = seq(5, 4).transpose(); // shape [4, 5], a view
    const y = a.matmul(bt);
    const e = expected(a, new Tensor([4, 5], bt.data));
    expect([...y.shape]).toEqual(e.shape);
    expect([...y.data]).toEqual(e.data);
  });
});

describe('#992 Tensor.matmul with a rank-1 operand', () => {
  it('ones(4,3,5) @ ones(5) has shape [4,3] and every entry 5', () => {
    const y = Tensor.ones(4, 3, 5).matmul(Tensor.ones(5));
    expect(y.shape).toEqual([4, 3]);
    expect([...y.data]).toEqual(new Array(12).fill(5));
  });
  it('ones(3) @ ones(3) is a rank-0 tensor of value 3', () => {
    const y = Tensor.ones(3).matmul(Tensor.ones(3));
    expect(y.shape).toEqual([]);
    expect([...y.data]).toEqual([3]);
  });
  it('ones(2) @ ones(2,4) has shape [4]', () => {
    const y = Tensor.ones(2).matmul(Tensor.ones(2, 4));
    expect(y.shape).toEqual([4]);
    expect([...y.data]).toEqual([2, 2, 2, 2]);
  });
  it('distinct values: [3] @ [2,3,4] has shape [2,4] and matches the slab products', () => {
    const a = seq(3);
    const b = seq(2, 3, 4);
    const y = a.matmul(b);
    expect([...y.shape]).toEqual([2, 4]);
    const row = new Tensor([1, 3], a.data);
    const want = [...row.matmul(slab(b, 0)).data, ...row.matmul(slab(b, 1)).data];
    expect([...y.data]).toEqual(want);
  });
  it('distinct values: [2,3] @ [3] is [14, 32]', () => {
    const y = seq(2, 3).matmul(seq(3));
    expect([...y.shape]).toEqual([2]);
    expect([...y.data]).toEqual([14, 32]);
  });
  it('distinct values: [1,2,3] @ [1,2,3] is 14', () => {
    expect([...seq(3).matmul(seq(3)).data]).toEqual([14]);
  });
});

describe('#992 Tensor.matmul errors', () => {
  it('an inner dimension mismatch throws', () => {
    expect(() => Tensor.ones(2, 3).matmul(Tensor.ones(4, 2))).toThrow(/inner dimension mismatch/);
    expect(() => Tensor.ones(3).matmul(Tensor.ones(4))).toThrow(/inner dimension mismatch/);
    expect(() => Tensor.ones(2, 3).matmul(Tensor.ones(4))).toThrow(/inner dimension mismatch/);
  });
  it('batch shapes [2,3] and [4,3] throw the broadcastShape error', () => {
    expect(() => Tensor.ones(2, 3, 2, 2).matmul(Tensor.ones(4, 3, 2, 2))).toThrow(
      /cannot be broadcast/
    );
  });
  it('a rank-0 operand throws', () => {
    const scalar = new Tensor([], new Float64Array([2]));
    expect(() => scalar.matmul(Tensor.ones(2, 2))).toThrow(/rank/);
    expect(() => Tensor.ones(2, 2).matmul(scalar)).toThrow(/rank/);
  });
  it('a zero-size batch axis gives an empty result of the broadcast shape', () => {
    const y = Tensor.ones(0, 2, 3).matmul(Tensor.ones(3, 4));
    expect([...y.shape]).toEqual([0, 2, 4]);
    expect(y.data.length).toBe(0);
  });
});

describe('the rank-2 product is unchanged', () => {
  it('[[1,2],[3,4]] @ [[5,6],[7,8]]', () => {
    const y = seq(2, 2).matmul(new Tensor([2, 2], new Float64Array([5, 6, 7, 8])));
    expect([...y.data]).toEqual([19, 22, 43, 50]);
  });
});
