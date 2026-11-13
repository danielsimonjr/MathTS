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
} from '../src/index.js';
import { integratePolynomial } from '../src/cas/rational-integrate.js';
import { renderPolynomial } from '../src/cas/render-polynomial.js';
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
