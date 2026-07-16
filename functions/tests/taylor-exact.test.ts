import { describe, it, expect } from 'vitest';
import { taylor, seriesCoefficient } from '../src/index.js';

const evalPoly = (poly: string, x: number): number =>
  Function('x', `return ${poly.replace(/\^/g, '**')};`)(x);

describe('taylor — exact coefficients (Cauchy integral)', () => {
  it('sin(x) order 7 matches x - x^3/6 + x^5/120 - x^7/5040', () => {
    const p = taylor('sin(x)', 'x', 0, 7);
    for (const x of [-0.5, 0.2, 0.9]) {
      const ref = x - x ** 3 / 6 + x ** 5 / 120 - x ** 7 / 5040;
      expect(evalPoly(p, x)).toBeCloseTo(ref, 9);
    }
  });
  it('exp(x) order 4 (coefficient of x^4 is 1/24, not 0.0366)', () => {
    const p = taylor('exp(x)', 'x', 0, 4);
    const ref = 1 + 0.3 + 0.3 ** 2 / 2 + 0.3 ** 3 / 6 + 0.3 ** 4 / 24;
    expect(evalPoly(p, 0.3)).toBeCloseTo(ref, 9);
  });
  it('cos(x) order 6 exact at x=1', () => {
    const p = taylor('cos(x)', 'x', 0, 6);
    const ref = 1 - 1 / 2 + 1 / 24 - 1 / 720;
    expect(evalPoly(p, 1)).toBeCloseTo(ref, 8);
  });
  it('seriesCoefficient: sin x^5 coeff = 1/120', () => {
    expect(seriesCoefficient('sin(x)', 'x', 0, 5)).toBeCloseTo(1 / 120, 9);
  });
  it('seriesCoefficient: sin x^7 coeff = -1/5040', () => {
    expect(seriesCoefficient('sin(x)', 'x', 0, 7)).toBeCloseTo(-1 / 5040, 9);
  });
});
