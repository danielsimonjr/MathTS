import { describe, it, expect } from 'vitest';
import { quad, nintegrate } from '../src/index.js';

describe('adaptive Gauss-Kronrod quad', () => {
  it('smooth: ∫_0^1 4/(1+x^2) = pi', () => {
    expect(quad((x) => 4 / (1 + x * x), 0, 1).value).toBeCloseTo(Math.PI, 10);
  });
  it('∫_0^pi sin = 2', () => {
    expect(quad(Math.sin, 0, Math.PI).value).toBeCloseTo(2, 10);
  });
  it('endpoint-singular: ∫_0^1 x^-0.5 = 2 (was 1.7e-6 off)', () => {
    expect(quad((x) => (x <= 0 ? 0 : 1 / Math.sqrt(x)), 0, 1).value).toBeCloseTo(2, 6);
  });
  it('peaked: ∫_-1^1 1/(1+25x^2) = 0.4*atan(5)', () => {
    expect(quad((x) => 1 / (1 + 25 * x * x), -1, 1).value).toBeCloseTo(0.4 * Math.atan(5), 9);
  });
  it('nintegrate now hits the singular integral accurately', () => {
    expect(nintegrate((x: number) => (x <= 0 ? 0 : 1 / Math.sqrt(x)), 0, 1)).toBeCloseTo(2, 6);
  });
});
