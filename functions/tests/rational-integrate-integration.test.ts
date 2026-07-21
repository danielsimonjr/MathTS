import { describe, it, expect } from 'vitest';
import { symbolicIntegral, evaluate } from '../src/index.js';
const f = (e: string, x: number) => evaluate(e, { x }) as number;
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

describe('symbolicIntegral: rational functions now integrated', () => {
  it('1/(x^2+1) is no longer a marker and differentiates back', () => {
    const F = symbolicIntegral('1/(x^2+1)', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [0.4, 1.7, -0.9]) expect(dF(F, x)).toBeCloseTo(f('1/(x^2+1)', x), 5);
  });
  it('deg-3 irreducible denominator still returns the marker', () => {
    expect(symbolicIntegral('1/(x^3-2)', 'x')).toContain('integral(');
  });
});
