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

  // Extension 1: partial-fraction integration of rational functions.
  describe('partial-fraction integration (d/dx ∫f = f)', () => {
    const cases: Array<[string, (x: number) => number]> = [
      ['1/(x^2 - 1)', (x) => 1 / (x * x - 1)],
      ['(x + 3)/(x^2 - x - 2)', (x) => (x + 3) / (x * x - x - 2)],
      ['(3*x + 5)/((x - 1)*(x + 2))', (x) => (3 * x + 5) / ((x - 1) * (x + 2))],
      ['1/(x^2 - 4)', (x) => 1 / (x * x - 4)],
      ['x^3/(x^2 - 1)', (x) => (x * x * x) / (x * x - 1)], // improper → poly + logs
    ];
    for (const [f, fn] of cases) {
      it(`∫(${f})`, () => {
        const F = symbolicIntegral(f, 'x');
        expect(F.startsWith('integral(')).toBe(false);
        for (const x of [0.3, 2.7, 3.4]) expect(dF(F, x)).toBeCloseTo(fn(x), 4);
      });
    }
  });

  // Extension 2: tabular integration by parts for polynomial·{exp,sin,cos}.
  describe('integration by parts (d/dx ∫f = f)', () => {
    const cases: Array<[string, (x: number) => number]> = [
      ['x * exp(x)', (x) => x * Math.exp(x)],
      ['x * sin(x)', (x) => x * Math.sin(x)],
      ['x^2 * exp(x)', (x) => x * x * Math.exp(x)],
      ['x * cos(2*x)', (x) => x * Math.cos(2 * x)],
      ['x^2 * sin(3*x)', (x) => x * x * Math.sin(3 * x)],
      ['x^3 * exp(x)', (x) => x * x * x * Math.exp(x)],
    ];
    for (const [f, fn] of cases) {
      it(`∫(${f})`, () => {
        const F = symbolicIntegral(f, 'x');
        expect(F.startsWith('integral(')).toBe(false);
        for (const x of [0.4, 1.1, 1.9]) expect(dF(F, x)).toBeCloseTo(fn(x), 4);
      });
    }
  });

  // Extension 3: full rational-function integration (Risch Layer 1) — denominators
  // with irreducible-quadratic / repeated factors that `apart` cannot split now
  // integrate to rational part + log + arctan. Verified by d/dx ∫f = f.
  describe('rational-function integration — irreducible-quadratic / repeated (d/dx ∫f = f)', () => {
    const cases: Array<[string, (x: number) => number]> = [
      ['1/(x^2 + 1)', (x) => 1 / (x * x + 1)],
      ['(3*x + 2)/(x^2 + 1)', (x) => (3 * x + 2) / (x * x + 1)],
      ['1/((x - 1)^2*(x + 2))', (x) => 1 / ((x - 1) * (x - 1) * (x + 2))],
      ['1/(x^2 + x + 1)', (x) => 1 / (x * x + x + 1)],
    ];
    for (const [f, fn] of cases) {
      it(`∫(${f})`, () => {
        const F = symbolicIntegral(f, 'x');
        expect(F.startsWith('integral(')).toBe(false);
        for (const x of [0.3, 2.7, 3.4]) expect(dF(F, x)).toBeCloseTo(fn(x), 4);
      });
    }
  });

  it('returns an unevaluated marker for out-of-scope integrands', () => {
    // non-linear inner argument (needs a general u-substitution / Risch)
    expect(symbolicIntegral('sin(x^2)')).toBe('integral(sin(x^2), x)');
    // rational with a degree-≥3 irreducible denominator (Risch Layer 2 territory)
    expect(symbolicIntegral('1/(x^3 - 2)')).toBe('integral(1/(x^3 - 2), x)');
  });

  it('handles a custom integration variable', () => {
    const F = symbolicIntegral('t^2', 't');
    const dFt = (val: number) =>
      (evaluate(F, { t: val + 1e-5 }) - evaluate(F, { t: val - 1e-5 })) / 2e-5;
    expect(dFt(2)).toBeCloseTo(4, 4);
  });
});
