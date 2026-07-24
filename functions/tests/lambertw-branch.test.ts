import { describe, it, expect } from 'vitest';
import { lambertW } from '../src/index.js';

describe('lambertW branches', () => {
  it('principal branch unchanged: lambertW(1) ≈ 0.5671432904', () => {
    expect(lambertW(1)).toBeCloseTo(0.5671432904097838, 10);
  });
  it('principal branch via explicit branch=0', () => {
    expect(lambertW(1, 0)).toBeCloseTo(0.5671432904097838, 10);
  });
  it('lower branch: lambertW(-0.3, -1) ≈ -1.7813370234', () => {
    expect(lambertW(-0.3, -1)).toBeCloseTo(-1.781337023421628, 8);
  });
  it('lower branch: lambertW(-0.1, -1) ≈ -3.5771520640', () => {
    expect(lambertW(-0.1, -1)).toBeCloseTo(-3.577152063957297, 8);
  });
  it('W(x)·e^{W(x)} = x on the lower branch', () => {
    const w = lambertW(-0.2, -1);
    expect(w * Math.exp(w)).toBeCloseTo(-0.2, 10);
  });
  it('lower branch NaN outside [-1/e, 0)', () => {
    expect(Number.isNaN(lambertW(0.5, -1))).toBe(true);
  });
  it('rejects an invalid branch', () => {
    expect(() => lambertW(-0.2, 2)).toThrow(/branch/i);
  });
});
