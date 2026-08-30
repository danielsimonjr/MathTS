import { describe, it, expect } from 'vitest';
import { integrateRationalFunction } from '../src/cas/rational-integrate.js';
import { evaluate } from '../src/index.js';

const f = (e: string, x: number) => evaluate(e, { x }) as number;
// central difference of the produced antiderivative
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

// Sample points chosen to avoid the real roots of the pos-disc denominators
// (√2≈1.41, √3≈1.73, √5≈2.24, and the shifted / non-monic roots) so the
// integrand and antiderivative are finite and smooth at every probe.
const PROBES = [0.3, 0.9, 3.1, -0.7];

describe('rational-integrate: positive-discriminant quadratic (Layer 2, differentiation-verified)', () => {
  const cases: Array<[string, string]> = [
    ['1/(x^2-2)', '1/(x^2-2)'],
    ['1/(x^2-3)', '1/(x^2-3)'],
    ['(2*x+1)/(x^2-5)', '(2*x+1)/(x^2-5)'],
    ['1/(x^2+x-1)', '1/(x^2+x-1)'],
    ['1/(2*x^2-3)', '1/(2*x^2-3)'],
    ['x/((x-1)*(x^2-2))', 'x/((x-1)*(x^2-2))'],
  ];
  for (const [inp, integrand] of cases) {
    it(`d/dx integ(${inp}) == ${inp}`, () => {
      const F = integrateRationalFunction(inp, 'x');
      expect(F).not.toBeNull();
      for (const x of PROBES) expect(dF(F!, x)).toBeCloseTo(f(integrand, x), 5);
    });
  }

  it('Layer 3: repeated positive-discriminant quadratic differentiates back', () => {
    const F = integrateRationalFunction('1/(x^2-2)^2', 'x');
    expect(F).not.toBeNull();
    for (const x of PROBES) expect(dF(F!, x)).toBeCloseTo(f('1/(x^2-2)^2', x), 4);
  });

  it('Layer 3: degree-3 irreducible denominator differentiates back', () => {
    const F = integrateRationalFunction('1/(x^3-2)', 'x');
    expect(F).not.toBeNull();
    for (const x of [0.3, 0.9, 3.1, -0.7]) expect(dF(F!, x)).toBeCloseTo(f('1/(x^3-2)', x), 4);
  });
});
