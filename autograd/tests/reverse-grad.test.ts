import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { reverseGrad } from '../src/reverse-grad';

describe('reverseGrad (reverse-mode AD via tape)', () => {
  it('fn(x) = x · x, scalar cotangent — gradient = 2·x·cotangent (per-element)', () => {
    const x = Tensor.fromNested([2, 3, 4], [3]);
    const fn = (t: Tensor) => t.mul(t);  // value: [4, 9, 16]
    // cotangent = [1, 1, 1] (sum-of-outputs gradient), expected gradient = 2x = [4, 6, 8].
    const cotangent = Tensor.fromNested([1, 1, 1], [3]);
    const { value, gradient } = reverseGrad(fn, x, cotangent);
    expect(value.toNested()).toEqual([4, 9, 16]);
    expect(gradient.shape).toEqual([3]);
    const g = gradient.toNested() as number[];
    expect(g[0]).toBeCloseTo(4, 12);
    expect(g[1]).toBeCloseTo(6, 12);
    expect(g[2]).toBeCloseTo(8, 12);
  });

  it('default cotangent (ones) for scalar value', () => {
    const x = Tensor.fromNested(5, []);  // scalar input
    const fn = (t: Tensor) => t.mul(t);   // scalar output: 25
    // No cotangent — defaults to ones-like(value); for scalar, that's 1.
    // d(x^2)/dx = 2x = 10.
    const { value, gradient } = reverseGrad(fn, x);
    expect(value.toNested()).toBe(25);
    expect(gradient.shape).toEqual([]);
    expect(gradient.toNested()).toBeCloseTo(10, 12);
  });

  it('VJP shape check: rank-2 input → rank-2 output → rank-2 gradient', () => {
    const A = Tensor.fromNested([[1, 2], [3, 4]], [2, 2]);
    const fn = (t: Tensor) => t.scale(2);
    const cotangent = Tensor.fromNested([[1, 0], [0, 1]], [2, 2]);
    const { value, gradient } = reverseGrad(fn, A, cotangent);
    expect(value.toNested()).toEqual([[2, 4], [6, 8]]);
    expect(gradient.shape).toEqual([2, 2]);
    // d(2A)/dA = 2 elementwise; gradient = 2·cotangent = [[2,0],[0,2]].
    expect(gradient.toNested()).toEqual([[2, 0], [0, 2]]);
  });

  it('throws a clear error when fn breaks the AD trace (returns plain Tensor)', () => {
    const x = Tensor.fromNested([1, 2, 3], [3]);
    // fn that returns a fresh Tensor instead of routing through TapedTensor ops:
    const fnBroken = (_t: Tensor) => Tensor.fromNested([1, 2, 3], [3]);
    expect(() => reverseGrad(fnBroken, x)).toThrow(/AD-traceable|TapedTensor/);
  });
});
