import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { Tensor, Index } from '../src/index.js';

function seq(shape: number[]): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  return new Tensor(
    shape,
    Float64Array.from({ length: n }, (_, i) => i + 1)
  );
}

describe('Tensor <-> DenseMatrix bridge', () => {
  it('round-trips without sharing storage', () => {
    const m = new DenseMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    const t = Tensor.fromDenseMatrix(m);
    expect(Array.from(t.shape)).toEqual([2, 3]);
    expect(Array.from(t.data)).toEqual([1, 2, 3, 4, 5, 6]);
    t.data[0] = 99;
    expect(m.get(0, 0)).toBe(1);
    const back = t.toDenseMatrix();
    expect(back.rows).toBe(2);
    expect(back.cols).toBe(3);
    expect(back.get(1, 2)).toBe(6);
    expect(back.get(0, 0)).toBe(99);
    t.data[0] = 7;
    expect(back.get(0, 0)).toBe(99);
  });
  it('handles empty matrices', () => {
    const t = Tensor.fromDenseMatrix(new DenseMatrix(0, 3));
    expect(Array.from(t.shape)).toEqual([0, 3]);
  });
});

describe('Tensor.transpose', () => {
  function oracle(t: Tensor, perm: number[]): number[] {
    const outShape = perm.map((a) => t.shape[a]);
    const inStr = Tensor.rowMajorStrides(t.shape);
    const out: number[] = [];
    const total = t.data.length;
    const outStr = Tensor.rowMajorStrides(outShape);
    for (let n = 0; n < total; n++) {
      let rem = n;
      let src = 0;
      for (let k = 0; k < outShape.length; k++) {
        const c = Math.floor(rem / outStr[k]);
        rem -= c * outStr[k];
        src += c * inStr[perm[k]];
      }
      out.push(t.data[src]);
    }
    return out;
  }
  it('matches an index-arithmetic oracle for every permutation of a 3-D tensor', () => {
    const t = seq([2, 3, 4]);
    const perms = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const p of perms) {
      const r = t.transpose(p);
      expect(Array.from(r.shape)).toEqual(p.map((a) => t.shape[a]));
      expect(Array.from(r.data)).toEqual(oracle(t, p));
    }
  });
  it('matches the nested-array oracle for the default reversal', () => {
    const t = seq([2, 3, 4]);
    const nested = t.toNested() as number[][][];
    const r = t.transpose().toNested() as number[][][];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 4; k++) expect(r[k][j][i]).toBe(nested[i][j][k]);
  });
  it('handles rank 0 and rank 1', () => {
    expect(Array.from(new Tensor([], Float64Array.of(7)).transpose().data)).toEqual([7]);
    expect(Array.from(seq([3]).transpose().data)).toEqual([1, 2, 3]);
  });
  it('rejects non-permutations', () => {
    const t = seq([2, 3, 4]);
    expect(() => t.transpose([0, 0, 1])).toThrow(/not a permutation/);
    expect(() => t.transpose([0, 1, 3])).toThrow(/out of range/);
    expect(() => t.transpose([0, 1, -1])).toThrow(/out of range/);
    expect(() => t.transpose([0, 1, 1.5])).toThrow(/out of range/);
    expect(() => t.transpose([0, 1])).toThrow(/perm length/);
  });
});

describe('Tensor reductions axis validation', () => {
  it('rejects duplicate axes', () => {
    const t = seq([2, 3]);
    expect(() => t.mean([0, 0])).toThrow(/duplicate/);
    expect(() => t.sum([1, 1])).toThrow(/duplicate/);
  });
  it('rejects out-of-range axes', () => {
    expect(() => seq([2, 3]).sum([2])).toThrow(/out of range/);
    expect(() => seq([2, 3]).sum([-1])).toThrow(/out of range/);
  });
  it('reduces multi-axis 3-D tensors correctly (with and without keepDims)', () => {
    const t = seq([2, 3, 4]);
    const nested = t.toNested() as number[][][];
    const s02 = t.sum([0, 2]);
    expect(Array.from(s02.shape)).toEqual([3]);
    for (let j = 0; j < 3; j++) {
      let acc = 0;
      for (let i = 0; i < 2; i++) for (let k = 0; k < 4; k++) acc += nested[i][j][k];
      expect(s02.data[j]).toBe(acc);
    }
    const s1 = t.sum([1], { keepDims: true });
    expect(Array.from(s1.shape)).toEqual([2, 1, 4]);
    expect(s1.data[0]).toBe(1 + 5 + 9);
    expect(s1.data[5]).toBe(14 + 18 + 22);
  });
});

describe('Tensor.einsum validation and correctness', () => {
  it('rejects out-of-range operand / axis references with clear messages', () => {
    const a = seq([2, 3]);
    expect(() => Tensor.einsum({ contractions: [], free: [{ operand: 1, axis: 0 }] }, a)).toThrow(
      /operand 1/
    );
    expect(() =>
      Tensor.einsum(
        {
          contractions: [],
          free: [
            { operand: 0, axis: 0 },
            { operand: 0, axis: 5 },
          ],
        },
        a
      )
    ).toThrow(/axis 5 of operand 0/);
    expect(() =>
      Tensor.einsum(
        {
          contractions: [
            {
              pair: [
                [0, 1],
                [3, 0],
              ],
            },
          ],
          free: [{ operand: 0, axis: 0 }],
        },
        a
      )
    ).toThrow(/operand 3/);
  });
  it('matMul via einsum, trace and batch-free outer product agree with oracles', () => {
    const a = seq([2, 3]);
    const b = seq([3, 4]);
    const c = Tensor.einsum(
      {
        contractions: [
          {
            pair: [
              [0, 1],
              [1, 0],
            ],
          },
        ],
        free: [
          { operand: 0, axis: 0 },
          { operand: 1, axis: 1 },
        ],
      },
      a,
      b
    );
    const ref = a.matMul(b);
    expect(Array.from(c.data)).toEqual(Array.from(ref.data));
    const sq = seq([3, 3]);
    const tr = Tensor.einsum(
      {
        contractions: [
          {
            pair: [
              [0, 0],
              [0, 1],
            ],
          },
        ],
        free: [],
      },
      sq
    );
    expect(tr.data[0]).toBe(1 + 5 + 9);
  });
});

describe('Tensor elementwise API', () => {
  const i = new Index(2);
  const j = new Index(3);
  const lab = (): Tensor => new Tensor([2, 3], Float64Array.from([1, 2, 3, 4, 5, 6]), [i, j]);

  it('div: scalar, same-shape and broadcast', () => {
    const t = seq([2, 3]);
    expect(Array.from(t.div(2).data)).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
    expect(Array.from(t.div(t).data)).toEqual([1, 1, 1, 1, 1, 1]);
    const row = new Tensor([3], Float64Array.of(1, 2, 4));
    expect(Array.from(t.div(row).data)).toEqual([1, 1, 0.75, 4, 2.5, 1.5]);
    expect(t.div(0).data[0]).toBe(Infinity);
  });
  it('neg, map, clone', () => {
    const t = seq([2, 2]);
    expect(Array.from(t.neg().data)).toEqual([-1, -2, -3, -4]);
    expect(Array.from(t.map((x, k) => x * 10 + k).data)).toEqual([10, 21, 32, 43]);
    const c = t.clone();
    expect(c).not.toBe(t);
    expect(c.data).not.toBe(t.data);
    expect(Array.from(c.data)).toEqual(Array.from(t.data));
    expect(Array.from(c.shape)).toEqual([2, 2]);
    c.data[0] = 100;
    expect(t.data[0]).toBe(1);
  });
  it('preserves axisLabels on scalar, same-shape, scale, neg, map, clone', () => {
    const t = lab();
    for (const r of [
      t.add(1),
      t.sub(1),
      t.mul(2),
      t.scale(2),
      t.div(2),
      t.neg(),
      t.map((x) => x),
      t.clone(),
      t.add(lab()),
      t.sub(lab()),
      t.mul(lab()),
      t.div(lab()),
    ]) {
      expect(r.axisLabels).toBeDefined();
      expect(r.axisLabels).toHaveLength(2);
      expect(r.axisLabels![0].matches(i)).toBe(true);
      expect(r.axisLabels![1].matches(j)).toBe(true);
    }
  });
  it('same-shape add/sub/mul values', () => {
    const a = seq([2, 2]);
    const b = new Tensor([2, 2], Float64Array.of(4, 3, 2, 1));
    expect(Array.from(a.add(b).data)).toEqual([5, 5, 5, 5]);
    expect(Array.from(a.sub(b).data)).toEqual([-3, -1, 1, 3]);
    expect(Array.from(a.mul(b).data)).toEqual([4, 6, 6, 4]);
  });
});
