import { describe, it, expect } from 'vitest';
import { hyp0f1, hyp1f1, hyp2f1, pFq } from '../src/index.js';

describe('hypergeometric functions', () => {
  it('hyp2f1(1,2,3,0.5) = 1.5451774445 (mpmath)', () => {
    expect(hyp2f1(1, 2, 3, 0.5)).toBeCloseTo(1.5451774445, 8);
  });
  it('hyp1f1(1,2,0.5) = 1.2974425414 (mpmath)', () => {
    expect(hyp1f1(1, 2, 0.5)).toBeCloseTo(1.2974425414, 8);
  });
  it('hyp0f1(2,0.5) = 1.2717234563 (mpmath)', () => {
    expect(hyp0f1(2, 0.5)).toBeCloseTo(1.2717234563, 8);
  });
  it('pFq([1,2],[3],0.5) equals hyp2f1(1,2,3,0.5)', () => {
    expect(pFq([1, 2], [3], 0.5)).toBeCloseTo(1.5451774445, 8);
  });
  it('hyp2f1 throws outside |z|<1', () => {
    expect(() => hyp2f1(1, 2, 3, 1.5)).toThrow();
  });
});
