/**
 * Dogfood relay G14 — Tensor construction and axis ops (#795, #750, #749, #748).
 */
import { describe, it, expect } from 'vitest';
import { Tensor, flip, stack } from '../src/index';

describe('dogfood G14 — #795 fromNested shape inference', () => {
  it('Tensor.fromNested([[1,2],[3,4]]) infers shape [2,2] (NumPy array semantics)', () => {
    const t = Tensor.fromNested([
      [1, 2],
      [3, 4],
    ]);
    expect([...t.shape]).toEqual([2, 2]);
    expect([...t.data]).toEqual([1, 2, 3, 4]);
  });

  it('explicit shape still works', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect([...t.data]).toEqual([1, 2, 3, 4]);
  });

  it('jagged nested array throws TypeError', () => {
    expect(() =>
      Tensor.fromNested([
        [1, 2],
        [3, 4, 5],
      ])
    ).toThrow(TypeError);
  });

  it('infers a scalar, a vector, an empty vector, and a deep rectangular nest', () => {
    const scalar = Tensor.fromNested(7);
    expect([...scalar.shape]).toEqual([]);
    expect([...scalar.data]).toEqual([7]);

    const vector = Tensor.fromNested([1, 2, 3]);
    expect([...vector.shape]).toEqual([3]);
    expect([...vector.data]).toEqual([1, 2, 3]);

    const empty = Tensor.fromNested([]);
    expect([...empty.shape]).toEqual([0]);
    expect(empty.data.length).toBe(0);

    const rowEmpty = Tensor.fromNested([[]]);
    expect([...rowEmpty.shape]).toEqual([1, 0]);

    const deep = Tensor.fromNested([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);
    expect([...deep.shape]).toEqual([2, 2, 2]);
    expect([...deep.data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('rejects a deep jagged nest and a non-number leaf', () => {
    expect(() => Tensor.fromNested([[[1, 2]], [[3]]])).toThrow(TypeError);
    expect(() => Tensor.fromNested([[1, 'x' as unknown as number]])).toThrow(/fromNested/);
  });

  it('an explicit shape that does not match the nest throws and does not return data', () => {
    expect(() =>
      Tensor.fromNested(
        [
          [1, 2],
          [3, 4],
        ],
        [2, 3]
      )
    ).toThrow(/fromNested/);
  });
});

describe('dogfood G14 — #750 flip single axis', () => {
  it('flip(t, 0) matches flip(t, [0])', () => {
    const t = new Tensor([3], new Float64Array([1, 2, 3]));
    const f0 = flip(t, 0);
    const fArr = flip(t, [0]);
    expect([...f0.data]).toEqual([3, 2, 1]);
    expect([...fArr.data]).toEqual([...f0.data]);
  });

  it('non-iterable axes throw a flip-prefixed TypeError', () => {
    const t = new Tensor([3], new Float64Array([1, 2, 3]));
    expect(() => flip(t, null as unknown as number)).toThrow(
      /flip: axes must be an array of integers/
    );
  });

  it('accepts a negative axis and rejects non-integers and out-of-range axes', () => {
    const m = new Tensor([2, 3], new Float64Array([1, 2, 3, 4, 5, 6]));
    expect([...flip(m, -1).data]).toEqual([3, 2, 1, 6, 5, 4]);
    expect([...flip(m, 1).data]).toEqual([...flip(m, -1).data]);
    expect([...flip(m, [0, -1]).data]).toEqual([6, 5, 4, 3, 2, 1]);

    expect(() => flip(m, 1.5)).toThrow(/flip: axes must be an array of integers/);
    expect(() => flip(m, [0, 1.5])).toThrow(/flip: axes must be an array of integers/);
    expect(() => flip(m, ['0'] as unknown as number[])).toThrow(
      /flip: axes must be an array of integers/
    );
    expect(() => flip(m, 2)).toThrow(/flip: axis 2 is out of range/);
    expect(() => flip(m, -3)).toThrow(/flip: axis -3 is out of range/);

    const scalar = new Tensor([], new Float64Array([9]));
    expect([...flip(scalar, []).data]).toEqual([9]);
    expect(() => flip(scalar, 0)).toThrow(/out of range/);
  });
});

describe('dogfood G14 — #749 stack default axis', () => {
  it('stack([a,b]) defaults to axis 0 like np.stack', () => {
    const a = new Tensor([2], new Float64Array([1, 2]));
    const b = new Tensor([2], new Float64Array([3, 4]));
    const s = stack([a, b]);
    expect([...s.shape]).toEqual([2, 2]);
    expect([...s.data]).toEqual([1, 2, 3, 4]);
    expect([...stack([a, b], 0).data]).toEqual([...s.data]);
  });

  it('non-integer axis throws TypeError', () => {
    const a = new Tensor([2], new Float64Array([1, 2]));
    const b = new Tensor([2], new Float64Array([3, 4]));
    expect(() => stack([a, b], Number.NaN)).toThrow(/stack: axis must be an integer/);
  });

  it('axis -1 matches NumPy and mismatched shapes throw instead of returning zeros', () => {
    const a = new Tensor([2], new Float64Array([1, 2]));
    const b = new Tensor([2], new Float64Array([3, 4]));
    const stacked = stack([a, b], -1);
    expect([...stacked.shape]).toEqual([2, 2]);
    expect([...stacked.data]).toEqual([1, 3, 2, 4]);

    const wide = new Tensor([3], new Float64Array([1, 2, 3]));
    expect(() => stack([a, wide])).toThrow(/shape mismatch/);
    const row = new Tensor([1, 2], new Float64Array([1, 2]));
    expect(() => stack([a, row])).toThrow(/rank/);
    expect(() => stack([], 0)).toThrow(/non-empty/);
  });
});

describe('dogfood G14 — #748 constructor Float64Array contract', () => {
  it('accepts Float32Array by copy to float64 (#941)', () => {
    const src = new Float32Array([1, 2, 3, 4]);
    const t = new Tensor([2, 2], src);
    expect(t.data).toBeInstanceOf(Float64Array);
    expect([...t.data]).toEqual([1, 2, 3, 4]);
    expect(t.data.buffer).not.toBe(src.buffer);
  });

  it('rejects Int32Array at runtime', () => {
    expect(() => new Tensor([2], new Int32Array([1, 2]) as unknown as Float64Array)).toThrow(
      /data must be a Float64Array/
    );
  });

  it('rejects plain number[] at runtime', () => {
    expect(() => new Tensor([2, 2], [1, 2, 3, 4] as unknown as Float64Array)).toThrow(
      /data must be a Float64Array/
    );
  });

  it('rejects array-like objects with length', () => {
    const arrayLike = { length: 2, 0: 1, 1: 2 };
    expect(() => new Tensor([2], arrayLike as unknown as Float64Array)).toThrow(
      /data must be a Float64Array/
    );
  });

  it('keeps Float64Array storage by reference (no copy)', () => {
    const buf = new Float64Array([1, 2, 3, 4]);
    const t = new Tensor([2, 2], buf);
    expect(t.data).toBe(buf);
    expect(t.data.constructor).toBe(Float64Array);
    expect(t.add(1).data).toBeInstanceOf(Float64Array);
  });

  it('aliases a Float64Array subarray and rejects other typed arrays', () => {
    const buf = new Float64Array([9, 1, 2, 3, 4, 8]);
    const view = buf.subarray(1, 5);
    const t = new Tensor([2, 2], view);
    expect(t.data).toBe(view);
    view[0] = 11;
    expect(t.data[0]).toBe(11);

    expect(() => new Tensor([2], new Uint8Array([1, 2]) as unknown as Float64Array)).toThrow(
      TypeError
    );
    expect(() => new Tensor([2], new BigInt64Array([1n, 2n]) as unknown as Float64Array)).toThrow(
      /data must be a Float64Array/
    );
  });
});
