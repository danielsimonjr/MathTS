import { describe, it, expect } from 'vitest';
import { gemmF64 } from '../src/types/dense/gemm-f64.js';

describe('gemmF64', () => {
  it('2×2 identity product', () => {
    const I = new Float64Array([1, 0, 0, 1]);
    const A = new Float64Array([2, 3, 4, 5]);
    const C = gemmF64(A, I, 2, 2, 2);
    expect([...C]).toEqual([...A]);
  });

  it('0×∞ yields NaN', () => {
    const a = new Float64Array([0, 1]);
    const b = new Float64Array([Infinity, 2]);
    const c = gemmF64(a, b, 1, 2, 1);
    expect(c[0]).toBeNaN();
  });
});
