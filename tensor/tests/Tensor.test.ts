import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

describe('Tensor — construction + elementwise', () => {
  it('fromNested / toNested round-trips a rank-2 tensor', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(t.shape).toEqual([2, 2]);
    expect(t.toNested()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('fromNested / toNested round-trips a rank-0 scalar', () => {
    const t = Tensor.fromNested(7, []);
    expect(t.shape).toEqual([]);
    expect(t.toNested()).toBe(7);
  });

  it('add / sub / mul are elementwise', () => {
    const a = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    const b = Tensor.fromNested(
      [
        [5, 6],
        [7, 8],
      ],
      [2, 2]
    );
    expect(a.add(b).toNested()).toEqual([
      [6, 8],
      [10, 12],
    ]);
    expect(b.sub(a).toNested()).toEqual([
      [4, 4],
      [4, 4],
    ]);
    expect(a.mul(b).toNested()).toEqual([
      [5, 12],
      [21, 32],
    ]);
  });

  it('scale multiplies every component', () => {
    const a = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(a.scale(10).toNested()).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it('identity(3) is the 3x3 identity', () => {
    expect(Tensor.identity(3).toNested()).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('normInf is the max absolute component', () => {
    expect(
      Tensor.fromNested(
        [
          [-1, 2],
          [3, -9],
        ],
        [2, 2]
      ).normInf()
    ).toBe(9);
  });

  it('add throws on incompatible shapes (non-broadcastable)', () => {
    const a = Tensor.fromNested([1, 2], [2]);
    const b = Tensor.fromNested([1, 2, 3], [3]);
    expect(() => a.add(b)).toThrow(/cannot be broadcast/);
  });

  it('constructor throws when data length does not match the shape', () => {
    expect(() => new Tensor([2, 2], new Float64Array(3))).toThrow(/data length/);
  });
});
