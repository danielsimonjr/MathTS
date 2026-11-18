import { describe, it, expect } from 'vitest';
import { simplify, expand, derivative, symbolicIntegral, evaluate } from '../src/index.js';

const XS = [-2.5, -1, 0.5, 1, 3.75];

/** Value of an expression string at x (a Complex result is reduced to its real part). */
function at(expr: string, x: number): number {
  const v = evaluate(expr, { x }) as unknown;
  return typeof v === 'number' ? v : (v as { re: number }).re;
}

function sameValues(actual: string, expected: string): void {
  for (const x of XS) {
    const want = at(expected, x);
    expect(at(actual, x)).toBeCloseTo(want, 9);
  }
}

describe('#986 constant function calls fold in simplify and derivative', () => {
  it('simplify folds sqrt(2) to a number, as mathjs does', () => {
    expect(String(simplify('sqrt(2)'))).toBe('1.4142135623730951');
  });

  it('simplify folds exp(1), log(2), sin(1) next to a variable', () => {
    expect(String(simplify('exp(1)*x'))).toBe('2.718281828459045 * x');
    expect(String(simplify('log(2)*x'))).toBe('0.6931471805599453 * x');
    expect(String(simplify('sin(1)+x'))).toBe('x + 0.8414709848078965');
    sameValues(String(simplify('exp(1)*x')), 'exp(1)*x');
    sameValues(String(simplify('log(2)*x')), 'log(2)*x');
    sameValues(String(simplify('sin(1)+x')), 'sin(1)+x');
  });

  it('simplify still refuses a non-real constant, as mathjs does', () => {
    expect(() => simplify('sqrt(-2)*x')).toThrow(/Complex/);
  });

  it('derivative of sqrt(2)*x is sqrt(2)', () => {
    expect(String(derivative('sqrt(2)*x', 'x'))).toBe('1.4142135623730951');
  });

  it('derivative of 2^x keeps log(2) as a number', () => {
    const d = String(derivative('2^x', 'x'));
    expect(d).toBe('0.6931471805599453 * 2 ^ x');
    sameValues(d, 'log(2)*2^x');
  });

  it('derivative of the symbolicIntegral of 1/(x^2+1) returns the integrand', () => {
    const integral = String(symbolicIntegral('1/(x^2+1)', 'x'));
    const d = String(derivative(integral, 'x'));
    sameValues(d, '1/(x^2+1)');
  });
});

describe('#987 expand and simplify keep constants intact', () => {
  it('expand distributes a constant call over a sum', () => {
    expect(String(expand('sqrt(2)*(x+1)'))).toBe('sqrt(2)*x + sqrt(2)');
    expect(String(expand('exp(1)*(x+1)'))).toBe('exp(1)*x + exp(1)');
    sameValues(String(expand('sqrt(2)*(x+1)')), 'sqrt(2)*(x+1)');
    sameValues(String(expand('exp(1)*(x+1)')), 'exp(1)*(x+1)');
  });

  it('expand collects like terms around a constant call', () => {
    expect(String(expand('log(2)*(x+1)^2'))).toBe('log(2)*x^2 + 2*log(2)*x + log(2)');
    sameValues(String(expand('log(2)*(x+1)^2')), 'log(2)*(x+1)^2');
  });

  it('expand never glues a function name to its argument', () => {
    for (const e of ['sin(x)*(x+1)', 'sin(x)^2', 'sqrt(x)*(x-1)', '(x+1)*(sin(x)+1)']) {
      const out = String(expand(e));
      expect(out).not.toMatch(/sinx|sqrtx/);
      for (const x of [0.5, 1, 3.75]) {
        expect(at(out, x)).toBeCloseTo(at(e, x), 9);
      }
    }
  });

  it('expand does not read an exponent group as a factor', () => {
    const e = '2^(1/2)*(8 + x)';
    const out = String(expand(e));
    for (const x of XS) expect(at(out, x)).toBeCloseTo(at(e, x), 9);
  });

  it('simplify of 2^(1/2)*2^(1/2) is 2 to double precision, not a huge ratio', () => {
    const out = String(simplify('2^(1/2)*2^(1/2)'));
    expect(out).not.toContain('/');
    expect(Number(out)).toBeCloseTo(2, 12);
  });
});
