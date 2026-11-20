import { describe, it, expect } from 'vitest';
import { parse, symbolicEqual } from '../src/index.js';
import { isExactPolynomialIdentity } from '../src/cas/exact-identity.js';
import type { MathNode } from '../src/utils/node.js';

// #1178 (and #1014 item 3): symbolicEqual decided only by `simplify(e1 - e2)` being the constant 0.
// An irrational constant beside a fraction folds to a decimal, so an exact zero left a rounding
// residue, and `simplify` does not expand `(x+1)^2`. symbolicEqual now also compares the two sides as
// exact polynomials over their variables and opaque function calls. This diverges from mathjs 15.2.0
// on purpose: mathjs gives false for the first four pairs and for `(x+y)*(x-y)` against `x^2-y^2`
// below; the other answers match mathjs.

describe('#1178 symbolicEqual is true for an exact identity', () => {
  it('an irrational constant that cancels beside a fraction', () => {
    expect(symbolicEqual('1/3+sqrt(2)-sqrt(2)', '1/3')).toBe(true);
  });
  it('a sum of a fraction and an irrational constant, in two forms', () => {
    expect(symbolicEqual('sqrt(2)/3+1/3', '(sqrt(2)+1)/3')).toBe(true);
  });
  it('a distributed irrational constant', () => {
    expect(symbolicEqual('(x+1/3)*sqrt(3)', 'sqrt(3)*x+sqrt(3)/3')).toBe(true);
  });
  it('a power of a sum and its expansion (#1014 item 3)', () => {
    expect(symbolicEqual('(x+1)^2', 'x^2+2*x+1')).toBe(true);
  });
  it('decimal literals add exactly', () => {
    expect(symbolicEqual('0.1+0.2', '0.3')).toBe(true);
  });
  it('the Node, Node form goes the same way', () => {
    expect(symbolicEqual(parse('(x+1)^2'), parse('x^2+2*x+1'))).toBe(true);
  });
  it('a product of sums in two variables', () => {
    expect(symbolicEqual('(x+y)*(x-y)', 'x^2-y^2')).toBe(true);
  });
});

describe('#1178 symbolicEqual keeps its other answers', () => {
  it('sqrt(2) and its double stay equal (the simplify path)', () => {
    expect(symbolicEqual('sqrt(2)', '1.4142135623730951')).toBe(true);
  });
  it('is false for different polynomials', () => {
    expect(symbolicEqual('x+1', 'x+2')).toBe(false);
    expect(symbolicEqual('x+1+1e-13', 'x+1')).toBe(false);
    expect(symbolicEqual('x*y', 'x+y')).toBe(false);
    expect(symbolicEqual('x^2', 'x^3')).toBe(false);
    expect(symbolicEqual('x+x', '3*x')).toBe(false);
  });
  it('is false for two calls of random()', () => {
    expect(symbolicEqual('random()-random()', '0')).toBe(false);
  });
  it('keeps the options of the caller: no exact test with a context', () => {
    expect(symbolicEqual('x*y', 'y*x', { context: { multiply: { commutative: false } } })).toBe(
      false
    );
  });
});

describe('#1178 isExactPolynomialIdentity decides only what it proves', () => {
  const node = (text: string): MathNode => parse(text) as unknown as MathNode;
  const same = (a: string, b: string): boolean => isExactPolynomialIdentity(node(a), node(b));

  it('is true for a proven identity', () => {
    expect(same('(x+1)^2', 'x^2+2*x+1')).toBe(true);
    expect(same('(a+b)^3', 'a^3+3*a^2*b+3*a*b^2+b^3')).toBe(true);
    expect(same('x/4+x/4', 'x/2')).toBe(true);
    expect(same('2^(-2)*x', 'x/4')).toBe(true);
    expect(same('sin(x)*sin(x)', 'sin(x)^2')).toBe(true);
    expect(same('1e-7*x', 'x/10000000')).toBe(true);
  });

  it('is false for a pair that is not an identity', () => {
    expect(same('x+1', 'x+2')).toBe(false);
    expect(same('sin(x)', 'cos(x)')).toBe(false);
    expect(same('x/y', 'y/x')).toBe(false);
  });

  it('is false for a call that is not deterministic', () => {
    expect(same('random()-random()', '0')).toBe(false);
    expect(same('randomInt(5)-randomInt(5)', '0')).toBe(false);
    expect(same('x*(random()-random())', '0')).toBe(false);
  });

  it('is false for a constant without a finite value', () => {
    expect(same('log(0)-log(0)', '0')).toBe(false);
    expect(same('1/0', '1/0')).toBe(false);
    expect(same('Infinity-Infinity', '0')).toBe(false);
    expect(same('NaN-NaN', '0')).toBe(false);
  });

  it('is false when a matrix is an operand, as the product does not commute', () => {
    expect(same('[[x,1],[0,1]]*[[1,x],[0,1]]', '[[1,x],[0,1]]*[[x,1],[0,1]]')).toBe(false);
    expect(same('[1,2]-[1,2]', '0')).toBe(false);
  });

  it('is false for a string, a boolean or a null constant', () => {
    expect(same('"a"+"b"', '"ab"')).toBe(false);
    expect(same('true-true', '0')).toBe(false);
    expect(same('null-null', '0')).toBe(false);
  });

  it('is false for a degree or a term count above the limit', () => {
    expect(same('(x+1)^1001', '(x+1)^1001')).toBe(false);
    // Under the degree limit, but a million pairs of terms: the work budget refuses it.
    expect(same('(x+1)^1000', '(x+1)^1000')).toBe(false);
    expect(same('(a+b+c+d+x)^60', '(a+b+c+d+x)^60')).toBe(false);
  });

  it('does not throw on an input that no polynomial reads', () => {
    expect(same('x=1', 'x=1')).toBe(false);
    expect(same('f(x)=x', 'f(x)=x')).toBe(false);
  });

  it('keeps the variable x apart from a call that is named like it', () => {
    expect(same('x', 'x()')).toBe(false);
  });
});
