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
    expect(() => flip(t, null as unknown as number)).toThrow(/flip: axes must be/);
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
});

describe('dogfood G14 — #748 constructor Float64Array contract', () => {
  it('rejects Float32Array at runtime', () => {
    expect(
      () => new Tensor([2, 2], new Float32Array([1, 2, 3, 4]) as unknown as Float64Array)
    ).toThrow(/data must be a Float64Array/);
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
    expect(t.add(1).data).toBeInstanceOf(Float64Array);
  });
});
