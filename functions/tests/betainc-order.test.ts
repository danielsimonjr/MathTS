import { describe, it, expect } from 'vitest';
import { betainc } from '../src/index.js';

describe('betainc argument order is (a, b, x) — regularized I_x(a,b)', () => {
  it('betainc(2,3,0.5) = 0.6875 (mpmath)', () => {
    expect(betainc(2, 3, 0.5)).toBeCloseTo(0.6875, 12);
  });
  it('betainc(2,3,0.7) = 0.9163 (mpmath)', () => {
    expect(betainc(2, 3, 0.7)).toBeCloseTo(0.9163, 12);
  });
  it('I_x(1,1) = x (uniform)', () => {
    expect(betainc(1, 1, 0.3)).toBeCloseTo(0.3, 12);
  });
});
