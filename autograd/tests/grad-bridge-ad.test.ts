import { describe, it, expect } from 'vitest';
import { grad, valueAndGrad, derivative, jacobian } from '../src/index.js';

/**
 * GC15 — JAX-style grad/valueAndGrad/derivative/jacobian bridge over the tape.
 * The function is written in TapedTensor ops (the AD-aware surface) but inputs
 * and gradients are plain numbers / Float64Arrays. Verified against closed forms
 * and central finite differences.
 */
const fd = (f: (x: number) => number, x: number, eps = 1e-6) => (f(x + eps) - f(x - eps)) / (2 * eps);

describe('GC15: derivative (scalar ℝ→ℝ)', () => {
  it('d/dx sin(x) = cos(x)', () => {
    for (const x of [0.3, 1, 2, -1.5]) {
      expect(derivative((t) => t.sin(), x)).toBeCloseTo(Math.cos(x), 8);
    }
  });

  it('d/dx [sin(x)·x] = cos(x)·x + sin(x)', () => {
    for (const x of [0.5, 2, -1]) {
      const got = derivative((t) => t.sin().mul(t), x);
      expect(got).toBeCloseTo(Math.cos(x) * x + Math.sin(x), 8);
      expect(got).toBeCloseTo(fd((v) => Math.sin(v) * v, x), 5);
    }
  });
});

describe('GC15: grad / valueAndGrad (ℝⁿ→ℝ)', () => {
  it('grad of sum(x²) = 2x', () => {
    const g = grad((t) => t.square().sum());
    expect(Array.from(g([1, 2, 3]))).toEqual([2, 4, 6]);
  });

  it('valueAndGrad returns both the value and the gradient', () => {
    const { value, grad: gr } = valueAndGrad((t) => t.square().sum(), [1, 2, 3]);
    expect(value).toBe(14);
    expect(Array.from(gr)).toEqual([2, 4, 6]);
  });

  it('grad of sum(sin(x)) = cos(x) elementwise', () => {
    const x = [0.2, 0.9, 1.7];
    const g = Array.from(grad((t) => t.sin().sum())(x));
    for (let i = 0; i < x.length; i++) expect(g[i]).toBeCloseTo(Math.cos(x[i]), 8);
  });

  it('throws a clear error when fn is not scalar-valued', () => {
    expect(() => valueAndGrad((t) => t.sin(), [1, 2, 3])).toThrow(/scalar/);
  });
});

describe('GC15: jacobian (ℝⁿ→ℝᵐ)', () => {
  it('jacobian() runs one reverse pass per output row', () => {
    // Scalar output → 1×n Jacobian equals the gradient.
    const J = jacobian((t) => t.square().sum(), [1, 2, 3]);
    expect(J).toEqual([[2, 4, 6]]);
  });
});
