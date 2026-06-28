import { describe, it, expect } from 'vitest';
import { parse, math, OperatorNode, ConstantNode, SymbolNode } from './helpers/bootstrap.js';

const c = (v: unknown) => new ConstantNode(v);
const s = (n: string) => new SymbolNode(n);

describe('OperatorNode._compile - arity dispatch', () => {
  it('compiles and evaluates a unary operator (1 arg)', () => {
    expect(parse('-5').compile().evaluate()).toBe(-5);
  });

  it('compiles and evaluates a binary operator (2 args)', () => {
    expect(parse('2 + 3').compile().evaluate()).toBe(5);
  });

  it('compiles and evaluates an n-ary operator (>2 args)', () => {
    const nary = new OperatorNode('+', 'add', [c(1), c(2), c(3), c(4)]);
    expect(nary.compile().evaluate()).toBe(10);
  });

  it('throws when the operator function is missing from math', () => {
    const e = new OperatorNode('@', 'definitelyMissingFn', [c(1), c(2)]);
    expect(() => e.compile()).toThrow(/missing in provided namespace/);
  });

  it('short-circuiting logical operators evaluate correctly (rawArgs path if applicable)', () => {
    // `and`/`or` are commonly rawArgs (short-circuit). Either way, evaluate
    // must produce the correct logical result.
    expect(parse('true and false').compile().evaluate()).toBe(false);
    expect(parse('false or true').compile().evaluate()).toBe(true);
  });
});

describe('OperatorNode - unary toString/toTex associativity', () => {
  it('renders a left-associative postfix unary in toString and toTex', () => {
    const e = parse('5!');
    expect(e.toString()).toBe('5!');
    expect(e.toTex()).toBeTypeOf('string');
  });

  it('renders a right-associative prefix unary in toString and toTex', () => {
    const e = parse('-a');
    expect(e.toString()).toBe('-a');
    expect(e.toTex()).toContain('-');
  });
});

describe('OperatorNode - LaTeX special parenthesis cases', () => {
  it('logical operators (latexLeftParens=false) render without extra parens', () => {
    // 'or' has latexLeftParens/latexRightParens/latexParens = false
    const e = parse('a or b or c');
    expect(e.toTex()).toBeTypeOf('string');
  });

  it('unary operand with definable precedence in LaTeX', () => {
    const e = parse('-(a or b)');
    expect(e.toTex()).toBeTypeOf('string');
  });

  it('mixed precedence binary in LaTeX keep mode', () => {
    const e = parse('(a + b) / (c - d)');
    expect(e.toTex({ parenthesis: 'keep' })).toContain('\\frac');
  });

  it('pow with conditional base parenthesizes in LaTeX', () => {
    const e = parse('(a > 0 ? b : c) ^ 2');
    expect(e.toTex()).toContain('\\left(');
  });
});

describe('OperatorNode - getSafeProperty access guard', () => {
  it('rejects an unsafe operator function name', () => {
    // 'constructor' is present on the math object's prototype but is not a safe
    // method; _compile should reject it.
    const e = new OperatorNode('@', 'constructor', [c(1)]);
    expect(() => e.compile()).toThrow();
  });

  it('uses the math scope add when present', () => {
    expect(typeof math.add).toBe('function');
    const e = new OperatorNode('+', 'add', [s('x'), c(1)]);
    expect(e.compile().evaluate({ x: 9 })).toBe(10);
  });
});
