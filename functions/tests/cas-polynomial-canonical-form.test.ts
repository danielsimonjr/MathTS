import { describe, it, expect } from 'vitest';
import {
  expand,
  casExpand,
  factor,
  cancel,
  together,
  apart,
  groebnerBasis,
  collect,
  minimalPolynomial,
  casSimplify,
  simplify,
  evaluate,
  integrate,
  toRadicals,
  PolynomialDegreeError,
} from '../src/index.js';
import { integratePolynomial } from '../src/cas/rational-integrate.js';
import { coefficientTexts, renderPolynomial } from '../src/cas/render-polynomial.js';
import { polyFromExpression, polyToString } from '../src/typed/polynomial-ideal.js';
import {
  toAlgebraString,
  fromAlgebraExpr,
  fromTerms,
} from '../src/typed/factorization/multi-poly.js';

describe('#887 one canonical polynomial form', () => {
  describe('renderPolynomial', () => {
    it('orders terms by descending exponent vector and drops unit coefficients', () => {
      const text = renderPolynomial(
        [
          { exps: [0, 0], coeff: '1' },
          { exps: [0, 2], coeff: '1' },
          { exps: [1, 1], coeff: '2' },
          { exps: [2, 0], coeff: '-1' },
          { exps: [1, 0], coeff: '-3' },
        ],
        ['x', 'y']
      );
      expect(text).toBe('-x^2 + 2*x*y - 3*x + y^2 + 1');
    });

    it('writes the zero polynomial as 0 and keeps a constant of -1 or 1 as a number', () => {
      expect(renderPolynomial([], ['x'])).toBe('0');
      expect(renderPolynomial([{ exps: [0], coeff: '1' }], ['x'])).toBe('1');
      expect(renderPolynomial([{ exps: [0], coeff: '-1' }], ['x'])).toBe('-1');
      expect(renderPolynomial([{ exps: [1], coeff: '-1' }], ['x'])).toBe('-x');
    });

    it('never writes a term with a zero coefficient, so there is no -0*x', () => {
      for (const zero of ['0', '-0', '0.0', '-0.0', '0/5']) {
        expect(
          renderPolynomial(
            [
              { exps: [2], coeff: '1' },
              { exps: [1], coeff: zero },
              { exps: [0], coeff: '3' },
            ],
            ['x']
          )
        ).toBe('x^2 + 3');
      }
      expect(renderPolynomial([{ exps: [1], coeff: '-0' }], ['x'])).toBe('0');
      expect(renderPolynomial([{ exps: [1], coeff: '0.05' }], ['x'])).toBe('0.05*x');
    });

    it('refuses two terms with the same exponent vector instead of printing both', () => {
      expect(() =>
        renderPolynomial(
          [
            { exps: [1], coeff: '2' },
            { exps: [1], coeff: '3' },
          ],
          ['x']
        )
      ).toThrow(TypeError);
      expect(() =>
        renderPolynomial(
          [
            { exps: [1, 0], coeff: '2' },
            { exps: [1], coeff: '3' },
          ],
          ['x', 'y']
        )
      ).toThrow(/same exponent vector/);
    });

    it('does not depend on the order of the input', () => {
      const terms = [
        { exps: [0], coeff: '4' },
        { exps: [3], coeff: '2' },
        { exps: [1], coeff: '-1' },
      ];
      expect(renderPolynomial(terms, ['x'])).toBe('2*x^3 - x + 4');
      expect(renderPolynomial([...terms].reverse(), ['x'])).toBe('2*x^3 - x + 4');
    });
  });

  describe('coefficientTexts writes a coefficient without a rounded digit', () => {
    it('writes an integer, also one that rounding noise moved', () => {
      expect(coefficientTexts([2, -3, 0, 1e6])).toEqual(['2', '-3', '0', '1000000']);
      expect(coefficientTexts([3.0000000000000004, -2.9999999999999996])).toEqual(['3', '-3']);
      expect(coefficientTexts([-0])).toEqual(['0']);
    });

    it('writes a fraction with an infinite decimal as a fraction, and then all fractions alike', () => {
      expect(coefficientTexts([1 / 3])).toEqual(['1/3']);
      expect(coefficientTexts([2 / 3, -1 / 6, 1])).toEqual(['2/3', '-1/6', '1']);
      expect(coefficientTexts([1 / 3, 0.5])).toEqual(['1/3', '1/2']);
    });

    it('keeps the decimals when every fraction has a finite decimal', () => {
      expect(coefficientTexts([0.5, 0.25, 2])).toEqual(['0.5', '0.25', '2']);
      expect(coefficientTexts([0.1 + 0.2])).toEqual(['0.3']);
    });

    it('keeps a small coefficient: only an exact zero is zero', () => {
      expect(coefficientTexts([1e-13, 1e-20])).toEqual(['1e-13', '1e-20']);
    });

    it('writes any other value with 12 digits', () => {
      expect(coefficientTexts([Math.PI])).toEqual(['3.14159265359']);
    });
  });

  describe('every polynomial printer gives the same text for the same polynomial', () => {
    it('polyToString prints a lex-descending Poly and an ascending Poly alike', () => {
      const descending = polyFromExpression('x^2 + 2*x + 1', ['x']);
      const ascending = [...descending].reverse();
      expect(polyToString(descending, ['x'])).toBe('x^2 + 2*x + 1');
      expect(polyToString(ascending, ['x'])).toBe('x^2 + 2*x + 1');
    });

    it('toAlgebraString (bigint) agrees with polyToString (number)', () => {
      for (const text of ['x^2 + 2*x*y + y^2', '-x^3 + 5*y - 7', 'x*y - 1']) {
        const vars = ['x', 'y'];
        const multi = fromAlgebraExpr(text, vars);
        expect(multi).not.toBeNull();
        expect(toAlgebraString(multi!)).toBe(polyToString(polyFromExpression(text, vars), vars));
      }
    });

    it('toAlgebraString keeps a coefficient above 2^53 exact', () => {
      // 2^53 + 1 is the smallest integer that a double cannot hold.
      const multi = fromTerms(
        ['x'],
        [
          [[1], 9007199254740993n],
          [[0], 1n],
        ]
      );
      expect(toAlgebraString(multi)).toBe('9007199254740993*x + 1');
    });
  });

  describe('expand and its siblings', () => {
    it('expand: descending degree, no unit coefficient (SymPy oracle strings)', () => {
      expect(expand('(x+1)^2')).toBe('x^2 + 2*x + 1');
      expect(expand('(x+1)^3')).toBe('x^3 + 3*x^2 + 3*x + 1');
      expect(expand('(x-1)^2')).toBe('x^2 - 2*x + 1');
      expect(expand('-(x+1)^2')).toBe('-x^2 - 2*x - 1');
      expect(expand('x*(x-2)')).toBe('x^2 - 2*x');
      expect(expand('(x+1)*(x^2-x+1)')).toBe('x^3 + 1');
      expect(expand('x')).toBe('x');
      expect(expand('(x+y)^2')).toBe('x^2 + 2*x*y + y^2');
      expect(expand('(x+y)*(x-y)')).toBe('x^2 - y^2');
      expect(expand('(x+y+1)^2')).toBe('x^2 + 2*x*y + 2*x + y^2 + 2*y + 1');
      expect(expand('(a+b)^3')).toBe('a^3 + 3*a^2*b + 3*a*b^2 + b^3');
      expect(expand('a*(b+c)')).toBe('a*b + a*c');
    });

    it('expand keeps an exact rational coefficient: x/3 + 1/2 is 1/3*x + 1/2', () => {
      expect(expand('x/3+1/2')).toBe('1/3*x + 1/2');
      expect(expand('2/3*x^2-1/6')).toBe('2/3*x^2 - 1/6');
      expect(expand('(x+1)/3')).toBe('1/3*x + 1/3');
      // a coefficient with a finite decimal keeps the decimal
      expect(expand('0.5*x+0.25')).toBe('0.5*x + 0.25');
      expect(expand('x/2')).toBe('0.5*x');
    });

    it('expand keeps a small coefficient instead of dropping it', () => {
      expect(expand('x + 1e-13*x^2')).toBe('1e-13*x^2 + x');
      expect(expand('1e-11*x + 1')).toBe('1e-11*x + 1');
      expect(expand('x/1e-11')).toBe('100000000000*x');
    });

    it('expand never prints a term with a zero coefficient', () => {
      expect(expand('x^2 - x^2 + 1')).toBe('1');
      expect(expand('(x+1)^2 - x^2 - 2*x')).toBe('1');
      expect(expand('0*x + 3')).toBe('3');
      expect(expand('x*0')).toBe('0');
      for (const input of ['(x+1)^2 - (x-1)^2', '2*x*(x-1) - 2*x^2 + 3*x']) {
        expect(expand(input)).not.toMatch(/-0\*|0\*/);
      }
    });

    it('expand refuses a polynomial above the degree limit, and does not hang on a huge power', () => {
      const started = Date.now();
      expect(typeof PolynomialDegreeError).toBe('function');
      expect(() => expand('(x+1)^1001')).toThrow(PolynomialDegreeError);
      expect(() => expand('(x+1)^1000000000')).toThrow(/degree above 1000/);
      expect(() => expand('(x+y)^1000000000')).toThrow(RangeError);
      // x^0 is the constant 1
      expect(expand('(x^0)^1000000000*x')).toBe('x');
      expect(expand('(2*x^0)^3*x')).toBe('8*x');
      expect(Date.now() - started).toBeLessThan(2000);
    });

    it('expand never writes a 1* or -1* in front of a variable', () => {
      for (const input of ['(x+1)^4', '(x+y)^3', '(x-y)^3', '(x+y+z)^2', '(2*x-1)*(x+1)']) {
        expect(expand(input)).not.toMatch(/(^|[ (+-])-?1\*[a-z]/);
      }
    });

    it('expand leaves a non-polynomial alone', () => {
      expect(expand('(x+1)*sin(x)')).toBe('(x+1)*sin(x)');
    });

    it('casExpand is the same function as expand', () => {
      for (const input of ['(x+1)^2', '(x+y)*(x-y)', '1-x^2']) {
        expect(casExpand(input)).toBe(expand(input));
      }
    });

    it('cancel, together and apart print the polynomial part canonically', () => {
      expect(cancel('(x^3-1)/(x-1)')).toBe('x^2 + x + 1');
      expect(together('1/x+1/(x+1)')).toBe('(2*x + 1)/((x)*((x+1)))');
      expect(apart('x^3/(x+1)')).toBe('x^2 - x + 1 - 1/(x + 1)');
    });

    it('factor prints the cofactor of a multivariate polynomial canonically', () => {
      expect(factor('x^2*y+x*y^2')).toBe('x*y*(x + y)');
      expect(factor('x^2+2*x*y+y^2')).toBe('(x + y)^2');
      expect(factor('x^3+x^2*y+x*y^2+y^3')).toBe('(x^2 + y^2)*(x + y)');
    });

    it('groebnerBasis prints each basis polynomial canonically', () => {
      expect(groebnerBasis(['x^2-y', 'x*y-1'], ['x', 'y'])).toEqual(['x - y^2', 'y^3 - 1']);
    });
  });

  describe('the other printers of a polynomial use the same form', () => {
    it('collect joins a negative term with a minus sign', () => {
      expect(collect('x^2-3*x+1', 'x')).toBe('x^2 - 3*x + 1');
      expect(collect('1+x-x^2', 'x')).toBe('-x^2 + x + 1');
    });

    it('minimalPolynomial prints the primitive polynomial in descending order', () => {
      expect(minimalPolynomial('sqrt(2)', 'x')).toBe('x^2 - 2');
      expect(minimalPolynomial('sqrt(3)-1', 'x')).toBe('x^2 + 2*x - 2');
      expect(minimalPolynomial('1/3', 'x')).toBe('3*x - 1');
      expect(minimalPolynomial('5', 'x')).toBe('x - 5');
      expect(minimalPolynomial('-3', 'x')).toBe('x + 3');
    });

    it('casSimplify and the factory simplify reach the polynomial through expand', () => {
      // tryPolynomialCanonicalForm calls expand and factor; casSimplify, simplify (algebra) and
      // the factory simplify (algebra/simplify.ts) all call tryPolynomialCanonicalForm.
      expect(casSimplify('3+2*x+x^2')).toBe('x^2 + 2*x + 3');
      expect(casSimplify('x^2+x^2+3')).toBe('2*x^2 + 3');
      expect(String(simplify('3 + x^2 + 2*x'))).toBe('x ^ 2 + 2 * x + 3');
    });

    it('integrate writes the power rule through the same renderer: no 1* in front of a variable', () => {
      expect(integrate('3*x^2', 'x')).toBe('x^3');
      expect(integrate('1*x^2', 'x')).toBe('1/3*x^3');
      expect(integrate('2*x', 'x')).toBe('x^2');
      expect(integrate('5*x^3', 'x')).toBe('1.25*x^4');
      expect(integrate('x', 'x')).toBe('x^2/2');
    });

    it('toRadicals gives no root of a function that is not a polynomial', () => {
      // the sampled fit read sin(x) as a polynomial and returned invented roots
      expect(toRadicals('sin(x)')).toEqual([]);
      expect(toRadicals('x^5 - sin(x)')).toEqual([]);
    });

    it('integratePolynomial lists the terms by descending degree', () => {
      // 1 + 2*x + 3*x^2 integrates to x + x^2 + x^3
      expect(integratePolynomial([1n, 2n, 3n], 'x')).toBe('x^3 + x^2 + x');
      expect(integratePolynomial([0n, 1n], 'x')).toBe('x^2/2');
    });
  });

  describe('the text is stable', () => {
    it('expand output parses back to the same polynomial and prints the same', () => {
      for (const input of ['(x+1)^2', '-(x+1)^2', '(x+y+1)^2', '1-x^2', '(2*x-3)^3']) {
        const once = expand(input);
        const vars = [...new Set(once.match(/[a-z]+/g) ?? [])].sort();
        expect(polyToString(polyFromExpression(once, vars), vars)).toBe(once);
        expect(expand(once)).toBe(once);
      }
    });

    it('expand output and the input have the same value', () => {
      for (const input of ['(x+1)^2', '-(x+1)^2', '(2*x-3)^3', '(x+y+1)^2']) {
        const expanded = expand(input);
        const scope = { x: 1.7, y: -0.4 };
        expect(evaluate(expanded, scope)).toBeCloseTo(evaluate(input, scope), 9);
      }
    });
  });
});
