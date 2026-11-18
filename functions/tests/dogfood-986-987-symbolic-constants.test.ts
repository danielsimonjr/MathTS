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

  it('expand collects one constant call written with different spacing', () => {
    const input = 'sqrt(2)*(x+1)+sqrt( 2)*x';
    const out = String(expand(input));
    expect(out).toBe('2*sqrt(2)*x + sqrt(2)');
    sameValues(out, input);
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

  it('expand keeps a variable whose name looks like a placeholder', () => {
    const scope = { x: 1.3, __k0__: 0.7, __k_0__: 0.9 };
    for (const e of ['__k0__*sqrt(2)*(x+1)', '__k_0__*__k0__*sqrt(2)*(x+1)']) {
      const out = String(expand(e));
      expect(out).toContain('__k0__');
      expect(evaluate(out, scope)).toBeCloseTo(evaluate(e, scope) as number, 9);
    }
    expect(String(expand('__k0__*sqrt(2)*(x+1)'))).toBe('sqrt(2)*__k0__*x + sqrt(2)*__k0__');
  });

  it('expand distributes pi and e as constants', () => {
    expect(String(expand('(pi+x)^2'))).toBe('pi^2 + 2*pi*x + x^2');
    expect(String(expand('e^2*(x+1)'))).toBe('e^2*x + e^2');
    sameValues(String(expand('(pi+x)^2')), '(pi+x)^2');
    sameValues(String(expand('e^2*(x+1)')), 'e^2*(x+1)');
  });

  it('expand with no variable leaves a call argument and an exponent group whole', () => {
    for (const e of ['sin(1+2)^2', '2^(1+2)*(3+4)']) {
      expect(evaluate(String(expand(e)))).toBeCloseTo(evaluate(e) as number, 9);
    }
  });

  it('simplify of 2^(1/2)*2^(1/2) is 2 to double precision, not a huge ratio', () => {
    const out = String(simplify('2^(1/2)*2^(1/2)'));
    expect(out).not.toContain('/');
    expect(Number(out)).toBeCloseTo(2, 12);
  });

  it('simplify keeps an exact fraction when a number is above fractionsLimit, as mathjs does', () => {
    expect(String(simplify('1/3 + 100', {}, { fractionsLimit: 50 }))).toBe('301 / 3');
    expect(String(simplify('x/3*200', {}, { fractionsLimit: 50 }))).toBe('x * 200 / 3');
    expect(String(simplify('1/3*100000', {}, { fractionsLimit: 1000 }))).toBe('1e+5 / 3');
  });

  it('simplify folds a matrix of fractions times an irrational constant to decimals', () => {
    expect(String(simplify('[1/3,2]*sqrt(2)'))).toBe('[0.4714045207910317, 2.8284271247461903]');
    expect(String(simplify('[1/3,2]*3'))).toBe('[1, 6]');
  });

  it('expand keeps the whitespace that separates two tokens of a constant call', () => {
    const scope = { x: 1.3 };
    const input = 'sqrt(2 e -3)*(x+1)';
    const out = String(expand(input));
    expect(out).toBe('sqrt(2 e -3)*x + sqrt(2 e -3)');
    expect(evaluate(out, scope)).toBeCloseTo(evaluate(input, scope) as number, 9);
    // `2 e -3` is 2*e - 3 and `2e-3` is 0.002: two constants, not one.
    const two = 'sqrt(2 e -3)*x + sqrt(2e-3)*x';
    expect(String(expand(two))).toBe('sqrt(2 e -3)*x + sqrt(2e-3)*x');
    expect(String(expand('log(2, 10)*(x+1) + log( 2,10 )'))).toBe('log(2,10)*x + 2*log(2,10)');
  });

  it('expand leaves a call that holds a string as written', () => {
    const input = 'sqrt("4  ")*(x+1)';
    expect(String(expand(input))).toBe(input);
  });

  it('expand throws the degree error only for a polynomial in the variables', () => {
    for (const e of [
      '(pi+x)^1001',
      'pi*(x+1)^1001',
      'sqrt(2)*(x+1)^1001',
      '(pi*x)^600*(pi*x)^600',
    ]) {
      expect(String(expand(e))).toBe(e);
    }
    expect(() => expand('(x+1)^1001')).toThrow(/degree above 1000/);
  });
});
