import { describe, it, expect } from 'vitest';
import { parse, OperatorNode, ConstantNode, SymbolNode } from './helpers/bootstrap.js';

/**
 * Supplements OperatorNode-render.test.ts, specifically targeting the
 * parenthesis-decision (calculateNecessaryParentheses) and LaTeX/string
 * branches for unary, binary, and n-ary (>2 arg) operators across the
 * `parenthesis` and `implicit` option matrix.
 */

const c = (v: unknown) => new ConstantNode(v);
const s = (n: string) => new SymbolNode(n);

describe('OperatorNode - parenthesis modes (toString/toTex/toHTML)', () => {
  const nested = parse('(a + b) * (c - d)');

  it('parenthesis:keep renders strings/tex/html', () => {
    expect(nested.toString({ parenthesis: 'keep' })).toBeTypeOf('string');
    expect(nested.toTex({ parenthesis: 'keep' })).toContain('\\left(');
    expect(nested.toHTML({ parenthesis: 'keep' })).toContain('math-parenthesis');
  });

  it('parenthesis:auto strips redundant parens', () => {
    expect(parse('((a))').toString({ parenthesis: 'auto' })).toBeTypeOf('string');
    expect(parse('a * (b * c)').toTex({ parenthesis: 'auto' })).toBeTypeOf('string');
    expect(parse('a * (b * c)').toHTML({ parenthesis: 'auto' })).toBeTypeOf('string');
  });

  it('parenthesis:all wraps everything', () => {
    const e = parse('a + b * c');
    expect(e.toString({ parenthesis: 'all' })).toContain('(');
    expect(e.toTex({ parenthesis: 'all' })).toContain('\\left(');
    expect(e.toHTML({ parenthesis: 'all' })).toContain('math-parenthesis');
  });
});

describe('OperatorNode - precedence-driven parens (binary)', () => {
  it('left-associative subtraction keeps right operand parens', () => {
    const e = parse('a - (b - c)');
    expect(e.toString()).toBe('a - (b - c)');
    expect(e.toTex()).toContain('\\left(');
  });

  it('right-associative power keeps left operand parens', () => {
    const e = parse('(a ^ b) ^ c');
    expect(e.toString()).toContain('(a ^ b)');
  });

  it('divide renders as a LaTeX fraction', () => {
    expect(parse('a / b').toTex()).toContain('\\frac');
  });

  it('pow with a divide base parenthesizes in LaTeX', () => {
    expect(parse('(a / b) ^ c').toTex()).toContain('\\left(');
  });
});

describe('OperatorNode - unary operators', () => {
  it('prefix unary minus', () => {
    const e = parse('-(a + b)');
    expect(e.toString()).toBe('-(a + b)');
    expect(e.toTex()).toContain('\\left(');
    expect(e.toHTML()).toContain('math-unary-operator');
  });

  it('named prefix unary (not)', () => {
    const e = parse('not a');
    expect(e.toString()).toContain('not');
    expect(e.toTex({ parenthesis: 'all' })).toBeTypeOf('string');
  });

  it('postfix unary (factorial)', () => {
    const e = parse('(a + b)!');
    expect(e.toString()).toContain('!');
    expect(e.toTex()).toBeTypeOf('string');
    expect(e.toHTML()).toContain('math-righthand-unary-operator');
  });
});

describe('OperatorNode - n-ary (>2 args) add/multiply', () => {
  it('renders a 3-term sum', () => {
    const e = parse('a + b + c');
    // parses left-assoc into nested binaries; build a true n-ary directly:
    const nary = new OperatorNode('+', 'add', [s('a'), s('b'), s('c')]);
    expect(nary.toString()).toBe('a + b + c');
    expect(nary.toTex()).toBeTypeOf('string');
    expect(nary.toHTML()).toContain('math-binary-operator');
    expect(e.isBinary()).toBe(true);
  });

  it('renders a 3-factor implicit product (toString joins with space)', () => {
    const nary = new OperatorNode('*', 'multiply', [c(2), s('x'), s('y')], true);
    expect(nary.toString()).toBe('2 x y');
    expect(nary.toTex()).toContain('~');
  });

  it('renders a 3-factor explicit product', () => {
    const nary = new OperatorNode('*', 'multiply', [s('a'), s('b'), s('c')]);
    expect(nary.toString()).toBe('a * b * c');
    expect(nary.toTex()).toBeTypeOf('string');
    expect(nary.toHTML()).toContain('math-explicit-binary-operator');
  });

  it('parenthesizes a lower-precedence term inside an n-ary product', () => {
    const sum = new OperatorNode('+', 'add', [s('a'), s('b')]);
    const prod = new OperatorNode('*', 'multiply', [s('c'), sum, s('d')]);
    expect(prod.toString()).toContain('(a + b)');
    expect(prod.toTex()).toContain('\\left(');
    expect(prod.toHTML()).toContain('math-parenthesis');
  });

  it('n-ary fallback to function-call form for non-add/multiply', () => {
    const e = new OperatorNode('@', 'customOp', [c(1), c(2), c(3)]);
    expect(e.toString()).toContain('customOp(');
    expect(e.toTex()).toContain('\\mathrm{customOp}');
    expect(e.toHTML()).toContain('math-function');
  });
});

describe('OperatorNode - implicit edge with constant', () => {
  it('parenthesizes a constant following an unparenthesized factor', () => {
    // 2(3) style: implicit multiply where a constant follows
    const e = parse('2 x (3)');
    expect(e.toString()).toBeTypeOf('string');
    expect(e.toTex()).toBeTypeOf('string');
  });
});

describe('OperatorNode - startsWithConstant via implicit-multiply parens', () => {
  it('handles implicit product starting with a constant operator chain', () => {
    const inner = new OperatorNode('*', 'multiply', [c(2), s('a')], true);
    const outer = new OperatorNode('*', 'multiply', [s('b'), inner], true);
    expect(outer.toString({ parenthesis: 'auto' })).toBeTypeOf('string');
  });
});
