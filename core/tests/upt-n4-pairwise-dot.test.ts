import { describe, it, expect } from 'vitest';
import { pairwiseDot } from '../src/index.js';

describe('N4 pairwiseDot stays sync on Float32Array', () => {
  it('dot of [1,2,3] with itself is 14', () => {
    const x = Float32Array.of(1, 2, 3);
    const out = pairwiseDot(x, x);
    expect(out).toBe(14);
    expect(out).not.toBeInstanceOf(Promise);
  });
});
