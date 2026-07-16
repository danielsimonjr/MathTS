import { describe, it, expect } from 'vitest';
import { minimizeScalar } from '../src/index.js';

describe('minimizeScalar (Brent)', () => {
  it('(x-2)^2 -> x=2, f=0', () => {
    const r = minimizeScalar((x) => (x - 2) ** 2, { bracket: [-5, 5] });
    expect(r.x).toBeCloseTo(2, 6);
    expect(r.fval).toBeCloseTo(0, 8);
  });
  it('x^4 - 3x^3 + 2 on [0,3] -> x=2.25', () => {
    const r = minimizeScalar((x) => x ** 4 - 3 * x ** 3 + 2, { bracket: [0, 3] });
    expect(r.x).toBeCloseTo(2.25, 5);
  });
  it('sin(x) on [0, 2pi] -> x=3pi/2, f=-1', () => {
    const r = minimizeScalar(Math.sin, { bracket: [0, 2 * Math.PI] });
    expect(r.x).toBeCloseTo((3 * Math.PI) / 2, 5);
    expect(r.fval).toBeCloseTo(-1, 8);
  });
});
