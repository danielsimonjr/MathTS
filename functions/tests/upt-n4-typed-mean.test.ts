import { describe, it, expect } from 'vitest';
import { mean, sum, std } from '../src/index.js';

describe('N4 typed reductions are sync numbers', () => {
  it('mean of a length-3 Float32Array is 2', () => {
    const out = mean(Float32Array.of(1, 2, 3));
    expect(out).toBe(2);
    expect(out).not.toBeInstanceOf(Promise);
  });

  it('mean of a length-3 Float64Array is 2 and not a Promise', () => {
    const out = mean(Float64Array.of(1, 2, 3));
    expect(out).toBe(2);
    expect(out).not.toBeInstanceOf(Promise);
  });

  it('mean of a plain array is unchanged', () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it('sum of Float32Array matches the plain array', () => {
    expect(sum(Float32Array.of(1, 2, 3))).toBe(sum([1, 2, 3]));
  });

  it('std of Float64Array matches the plain array', () => {
    const a = [1, 2, 3, 4];
    expect(std(Float64Array.of(...a))).toBe(std(a));
  });
});
