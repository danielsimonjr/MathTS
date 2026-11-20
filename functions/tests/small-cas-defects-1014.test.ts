import { describe, it, expect } from 'vitest';
import { evaluate, factor, symbolicPartialDerivative } from '../src/index.js';

// #1014 items 1 and 2 (items 3, 4 and 5 are pinned in symbolic-equal-exact-1178.test.ts,
// real-roots.test.ts and expression/tests/operator-tex-command-space-1014.test.ts).

function valueAt(text: string, x: number): number {
  return Number(evaluate(text, { x }));
}

describe('#1014 item 1: factor of a polynomial with rational coefficients', () => {
  const cases: Array<[string, string]> = [
    ['x^2/2-1/2', '(x - 1)*(x + 1)/2'],
    ['2*x/3-2/3', '2*(x - 1)/3'],
    ['x^2-1/4', '(2*x - 1)*(2*x + 1)/4'],
    ['2*x^2/3-2/3', '2*(x - 1)*(x + 1)/3'],
  ];

  for (const [input, expected] of cases) {
    it(`factor('${input}') is ${expected}`, () => {
      const result = factor(input);
      expect(result).toBe(expected);
      for (const x of [0.3, 1.7]) {
        expect(valueAt(result, x)).toBeCloseTo(valueAt(input, x), 12);
      }
    });
  }

  it('returns an irreducible polynomial with rational coefficients as it is', () => {
    expect(factor('x^2/2+1/2')).toBe('x^2/2+1/2');
  });

  it('keeps the factorization of an integer polynomial', () => {
    expect(factor('x^2-1')).toBe('(x - 1)*(x + 1)');
    expect(factor('4*x^2-1')).toBe('(2*x - 1)*(2*x + 1)');
    expect(factor('2*x^2-2')).toBe('2*(x - 1)*(x + 1)');
  });
});

describe('#1014 item 1 (second cause): factor does not split a number literal', () => {
  it('returns the input when a term has a power of a number', () => {
    expect(factor('2^3*x+4')).toBe('2^3*x+4');
  });
  it('returns the input when a term has a decimal coefficient', () => {
    expect(factor('4*x+2.5*y')).toBe('4*x+2.5*y');
  });
  it('keeps the content of integer coefficients that divide a symbol', () => {
    expect(factor('2*x+4*y/3')).toBe('2*(x + 2*y/3)');
  });
  it('writes a negative term of the content form with a minus sign', () => {
    expect(factor('2*x - 2')).toBe('2*(x - 1)');
    expect(factor('3*x - 3*y')).toBe('3*(x - y)');
  });
});

describe('#1014 item 2: symbolicPartialDerivative of a product with another symbol', () => {
  it('differentiates x^2*y with respect to x', () => {
    expect(symbolicPartialDerivative('x^2*y', 'x')).toBe('2 * y * x');
  });
  it('keeps the text of the terms that the term reader reads', () => {
    expect(symbolicPartialDerivative('3*x^2', 'x')).toBe('6*x^1');
    expect(symbolicPartialDerivative('x^3 + 2*x', 'x')).toBe('3*x^2 + 2');
  });
});
