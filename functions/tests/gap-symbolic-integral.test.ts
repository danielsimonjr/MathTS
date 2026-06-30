import { describe, it, expect } from 'vitest';
import { symbolicIntegral, evaluate } from '@danielsimonjr/mathts-functions';

/**
 * Symbolic indefinite integration over the supported subset (polynomials, power rule,
 * linearity, 1/x→ln, linear-substitution for sin/cos/exp/ln/sinh/cosh). Each result is
 * verified by the fundamental check: d/dx ∫f = f (central finite difference, since the
 * CAS `derivative` throws on fractional coefficients). Unsupported integrands return an
 * unevaluated `integral(...)` marker rather than a wrong answer.
 */
const dF = (F: string, x: number, h = 1e-5) =>
  (evaluate(F, { x: x + h }) - evaluate(F, { x: x - h })) / (2 * h);

describe('symbolicIntegral — d/dx ∫f = f over the supported subset', () => {
  const cases = [
    'x^3',
    '2*x + 3',
    'x^2 - 4*x + 7',
    'sin(x)',
    'cos(3*x + 1)',
    'exp(2*x)',
    '1/x',
    '(2*x + 1)^3',
    'x^2 + sin(x)',
    '3*cos(2*x)',
    'sqrt(x)',
    'sinh(x)',
  ];
  for (const f of cases) {
    it(`∫(${f})`, () => {
      const F = symbolicIntegral(f, 'x');
      expect(F.startsWith('integral(')).toBe(false); // supported
      for (const x of [0.7, 1.3, 2.1]) {
        expect(dF(F, x)).toBeCloseTo(evaluate(f, { x }), 4);
      }
    });
  }

  it('∫ln(x) = x·ln(x) − x', () => {
    const F = symbolicIntegral('log(x)');
    for (const x of [0.5, 1.5, 3]) expect(dF(F, x)).toBeCloseTo(Math.log(x), 4);
  });

  it('returns an unevaluated marker for out-of-scope integrands', () => {
    // product of two x-dependent factors (needs integration by parts)
    expect(symbolicIntegral('x * sin(x)')).toBe('integral(x * sin(x), x)');
    // non-linear inner argument
    expect(symbolicIntegral('sin(x^2)')).toBe('integral(sin(x^2), x)');
  });

  it('handles a custom integration variable', () => {
    const F = symbolicIntegral('t^2', 't');
    const dFt = (val: number) =>
      (evaluate(F, { t: val + 1e-5 }) - evaluate(F, { t: val - 1e-5 })) / 2e-5;
    expect(dFt(2)).toBeCloseTo(4, 4);
  });
});
