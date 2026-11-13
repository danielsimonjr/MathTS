/**
 * #941 — Tensor accepts Float32Array input by copy to float64 (non-breaking).
 *
 * Replays the issue input through the package name (built dist).
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';

describe('#941 Tensor accepts Float32Array input', () => {
  it('stores the Float32Array values widened to float64', () => {
    const src = new Float32Array([1.1, 2, 3, 4]);
    const t = new Tensor([2, 2], src);
    expect(t.data).toBeInstanceOf(Float64Array);
    expect(t.dtype).toBe('float64');
    expect(t.shape).toEqual([2, 2]);
    expect(t.data[0]).toBe(Math.fround(1.1));
    expect(t.data[0]).not.toBe(1.1);
    expect([...t.data]).toEqual([...src]);
  });

  it('does not alias the source Float32Array', () => {
    const src = new Float32Array([1, 2, 3, 4]);
    const t = new Tensor([2, 2], src);
    expect(t.data.buffer).not.toBe(src.buffer);
    src[0] = 99;
    expect(t.data[0]).toBe(1);
    t.data[1] = -5;
    expect(src[1]).toBe(2);
  });

  it('keeps the shape check for Float32Array input', () => {
    expect(() => new Tensor([3], new Float32Array([1, 2]))).toThrow(/does not match shape/);
  });
});
