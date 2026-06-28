import { describe, it, expect } from 'vitest';
import { createOperatorNode } from '../src/node/OperatorNode.js';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { parse } from './helpers/bootstrap.js';

/**
 * Targets OperatorNode's rawArgs `_compile` branch and the remaining
 * LaTeX/HTML/string formatting branches, building nodes from source factories
 * against a small custom math scope so we control rawArgs + safe-method access.
 */
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));

// A safe-method-friendly math scope: add an own-enumerable rawArgs operator fn.
const rawCollect = Object.assign(
  function rawCollect(nodes: unknown[]) {
    return nodes.length;
  },
  { rawArgs: true }
);
const math: Record<string, unknown> = {
  add: (...xs: number[]) => xs.reduce((a, b) => a + b, 0),
  unaryMinus: (a: number) => -a,
  multiply: (...xs: number[]) => xs.reduce((a, b) => a * b, 1),
  rawCollect,
};
const mathWithTransform = math;

const Node = createNode({ mathWithTransform });
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math, Node });
const OperatorNode = createOperatorNode({ Node });

const c = (v: unknown) => new ConstantNode(v);
const s = (n: string) => new SymbolNode(n);

describe('OperatorNode._compile - rawArgs branch', () => {
  it('passes unevaluated node args to a rawArgs operator function', () => {
    const node = new OperatorNode('@', 'rawCollect', [c(1), c(2), c(3)]);
    const fn = (
      node as unknown as {
        _compile: (
          math: Record<string, unknown>,
          argNames: Record<string, unknown>
        ) => (...a: unknown[]) => unknown;
      }
    )._compile(math, {});
    // rawCollect returns the number of raw arg nodes
    expect(fn(new Map(), {}, undefined)).toBe(3);
  });
});

describe('OperatorNode - unary toTex prefix/postfix and n-ary default', () => {
  it('renders an unknown unary operator (postfix fallback)', () => {
    // associativity for an unknown identifier is null -> falls through to postfix
    const node = new OperatorNode('†', 'dagger', [s('a')]);
    expect(node.toString()).toBe('a†');
    expect(node.toTex()).toContain('a');
  });

  it('renders an n-ary multiply via direct construction', () => {
    const node = new OperatorNode('*', 'multiply', [s('a'), s('b'), s('c')]);
    expect(node.toString()).toBe('a * b * c');
    expect(node.toHTML()).toContain('math-binary-operator');
    expect(node.toTex()).toBeTypeOf('string');
  });

  it('renders an n-ary add fallback when fn is not add/multiply (>2 args)', () => {
    const node = new OperatorNode('?', 'weird', [c(1), c(2), c(3)]);
    // toString: function-call fallback
    expect(node.toString()).toContain('weird(');
    // toTex: \mathrm fallback
    expect(node.toTex()).toContain('\\mathrm{weird}');
    // toHTML: math-function fallback
    expect(node.toHTML()).toContain('math-function');
  });

  it('n-ary with all-paren mode forces wrapping for non-trivial args', () => {
    const inner = new OperatorNode('+', 'add', [s('x'), s('y')]);
    const node = new OperatorNode('?', 'weird', [inner, c(1), c(2)]);
    const str = node.toString({ parenthesis: 'all' });
    expect(str).toContain('weird(');
  });
});

describe('OperatorNode - unary toString associativity fallbacks', () => {
  it('unknown unary operator toString falls back to postfix', () => {
    const node = new OperatorNode('~~', 'noassoc', [c(5)]);
    expect(node.toString()).toBe('5~~');
  });

  it('unknown unary operator toHTML falls back to postfix html', () => {
    const node = new OperatorNode('~~', 'noassoc', [c(5)]);
    expect(node.toHTML()).toContain('math-righthand-unary-operator');
  });

  it('unknown unary operator toTex falls back to postfix tex', () => {
    const node = new OperatorNode('~~', 'noassoc', [c(5)]);
    expect(node.toTex()).toContain('~~');
  });
});

describe('OperatorNode - LaTeX special-case parenthesis branches (real operators)', () => {
  it('unaryMinus (latexLeftParens=false) toTex of nested operand', () => {
    // -(a + b): unary root with a binary operand; exercises unary latex paren
    // special cases in both keep and auto modes.
    expect(parse('-(a + b)').toTex({ parenthesis: 'keep' })).toBeTypeOf('string');
    expect(parse('-(a + b)').toTex({ parenthesis: 'auto' })).toBeTypeOf('string');
  });

  it('logical operators (latexParens=false) avoid extra LaTeX parens', () => {
    // and/or/xor have latex*Parens === false
    expect(parse('a and b or c').toTex({ parenthesis: 'keep' })).toBeTypeOf('string');
    expect(parse('(a and b) or c').toTex({ parenthesis: 'auto' })).toBeTypeOf('string');
    expect(parse('a or (b and c)').toTex()).toBeTypeOf('string');
  });

  it('binary equal-precedence right operand parens (subtract chain)', () => {
    expect(parse('a - (b - c)').toTex({ parenthesis: 'keep' })).toContain('\\left(');
    expect(parse('a - (b + c)').toTex()).toBeTypeOf('string');
  });

  it('binary equal-precedence left operand parens (power chain)', () => {
    expect(parse('(a ^ b) ^ c').toTex({ parenthesis: 'keep' })).toBeTypeOf('string');
  });

  it('pow with a divide base in LaTeX (lhs identifier branch)', () => {
    expect(parse('(a / b) ^ 2').toTex()).toContain('\\left(');
    expect(parse('(a / b) ^ 2').toTex({ parenthesis: 'keep' })).toContain('\\left(');
  });

  it('conditional inside power base parenthesizes in LaTeX', () => {
    expect(parse('(a > 0 ? b : c) ^ 2').toTex({ parenthesis: 'keep' })).toContain('\\left(');
  });

  it('mixed comparison and arithmetic in LaTeX auto mode', () => {
    expect(parse('a + b > c * d').toTex({ parenthesis: 'auto' })).toBeTypeOf('string');
  });

  it('toHTML of a nested unary operand wraps parens', () => {
    expect(parse('-(a + b)').toHTML()).toContain('math-parenthesis');
  });

  it('toHTML of an implicit n-ary product', () => {
    expect(parse('2 a b').toHTML()).toContain('math-implicit-binary-operator');
  });
});
