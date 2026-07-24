import { describe, it, expect } from 'vitest';
import { integrateRationalFunction } from '../src/cas/rational-integrate.js';
import { evaluate } from '../src/index.js';
const f = (e: string, x: number) => evaluate(e, { x }) as number;
// central difference of the produced antiderivative
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

describe('rational-integrate: per-factor integration (differentiation-verified)', () => {
  const cases: Array<[string, string]> = [
    ['1/(x^2+1)', '1/(x^2+1)'],
    ['(3*x+2)/(x^2+1)', '(3*x+2)/(x^2+1)'],
    ['1/((x-1)^2*(x+2))', '1/((x-1)^2*(x+2))'],
    ['x^3/(x^2+1)', 'x^3/(x^2+1)'],
    ['1/(x^2+x+1)', '1/(x^2+x+1)'],
    ['x/(x^2+1)^2', 'x/(x^2+1)^2'],
  ];
  for (const [inp, integrand] of cases) {
    it(`d/dx integ(${inp}) == ${inp}`, () => {
      const F = integrateRationalFunction(inp, 'x');
      expect(F).not.toBeNull();
      for (const x of [0.4, 1.7, -0.9, 2.3]) expect(dF(F!, x)).toBeCloseTo(f(integrand, x), 5);
    });
  }
  it('declines a degree-3 irreducible denominator', () => {
    expect(integrateRationalFunction('1/(x^3-2)', 'x')).toBeNull();
  });

  // Layer 2 (quadratic surds): a degree-2 factor irreducible over ℚ with a
  // POSITIVE discriminant (real irrational roots, e.g. x^2-2) integrates to a
  // pair of real logs with quadratic-surd coefficients — no longer declined.
  // (Full pos-disc coverage lives in rational-integrate-posdisc.test.ts.)
  const positiveDiscCases = ['1/(x^2-2)', '1/(x^2-3)', 'x/(x^2-5)', '1/(x^2+x-1)', '1/(2*x^2-3)'];
  for (const inp of positiveDiscCases) {
    it(`positive-discriminant quadratic: d/dx integ(${inp}) == ${inp}`, () => {
      const F = integrateRationalFunction(inp, 'x');
      expect(F).not.toBeNull();
      for (const x of [0.3, 0.9, 3.1, -0.7]) expect(dF(F!, x)).toBeCloseTo(f(inp, x), 5);
    });
  }

  // Boundary: a REPEATED positive-discriminant quadratic is Layer 3 — still declined.
  it('declines a repeated positive-discriminant quadratic denominator', () => {
    expect(integrateRationalFunction('1/(x^2-2)^2', 'x')).toBeNull();
  });

  // Regression: denominators with integer content > 1 must be scaled correctly
  // (the primitive-factor product drops the leading constant). Before the fix
  // these integrated to `content ×` the correct answer.
  const contentCases = ['1/(2*x^2+2)', '3/(4*x^2+8*x+8)', '5/(2*x^2+3)', '1/(6*x^2-6)'];
  for (const inp of contentCases) {
    it(`content>1 denominator: d/dx integ(${inp}) == ${inp}`, () => {
      const F = integrateRationalFunction(inp, 'x');
      expect(F).not.toBeNull();
      for (const x of [0.4, 1.7, -0.9, 2.3]) expect(dF(F!, x)).toBeCloseTo(f(inp, x), 5);
    });
  }
});
