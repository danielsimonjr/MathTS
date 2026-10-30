import { describe, it, expect } from 'vitest';
import { evaluate, parse } from '@danielsimonjr/mathts-functions';
import { compile } from '../../src/compiler/compile.js';
import {
  MAX_COMPILE_DEPTH,
  MAX_EXPRESSION_LENGTH,
  MAX_PARSE_NESTING,
  MAX_PARSE_RECURSION,
} from '../../src/limits.js';
import type { MathNode } from '../../src/node/Node.js';

/**
 * Nesting cap measurement (Node 22, 2026-10-30): `('('.repeat(n)+'1'+')'.repeat(n))`
 * parses through n=249; n=250 throws RangeError without a cap. MAX_PARSE_NESTING=125
 * throws SyntaxError before stack overflow (124 parses, 125 does not).
 */
function parenthesisChain(depth: number): MathNode {
  let node = {
    type: 'ConstantNode',
    isConstantNode: true,
    value: 1,
  } as unknown as MathNode;
  for (let i = 0; i < depth; i++) {
    node = {
      type: 'ParenthesisNode',
      isParenthesisNode: true,
      content: node,
    } as unknown as MathNode;
  }
  return node;
}

describe('expression security limits', () => {
  it('documents MAX_EXPRESSION_LENGTH', () => {
    expect(MAX_EXPRESSION_LENGTH).toBe(1_000_000);
  });

  it('rejects expressions longer than MAX_EXPRESSION_LENGTH before parse', () => {
    const over = '1'.repeat(MAX_EXPRESSION_LENGTH + 1);
    expect(() => parse(over)).toThrow(SyntaxError);
    expect(() => parse(over)).toThrow(
      new RegExp(`expression exceeds ${MAX_EXPRESSION_LENGTH} characters`)
    );
  });

  it('still parses and evaluates a short expression under the length cap', () => {
    const node = parse('1 + 2');
    const compiled = compile(node as MathNode, { add: (a: number, b: number) => a + b });
    expect(compiled.evaluate()).toBe(3);
  });

  it('parses nesting MAX_PARSE_NESTING - 1 and rejects one deeper with SyntaxError', () => {
    const okDepth = MAX_PARSE_NESTING - 1;
    const exprOk = '('.repeat(okDepth) + '1' + ')'.repeat(okDepth);
    expect(parse(exprOk)).toBeDefined();

    const exprDeep = '('.repeat(MAX_PARSE_NESTING) + '1' + ')'.repeat(MAX_PARSE_NESTING);
    expect(() => parse(exprDeep)).toThrow(SyntaxError);
    expect(() => parse(exprDeep)).toThrow(/nesting limit/);
    expect(() => parse(exprDeep)).not.toThrow(RangeError);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('compile accepts depth MAX_COMPILE_DEPTH - 1 and rejects one deeper', () => {
    expect(() => compile(parenthesisChain(MAX_COMPILE_DEPTH - 1), {})).not.toThrow();
    expect(() => compile(parenthesisChain(MAX_COMPILE_DEPTH), {})).toThrow(
      new RegExp(`expression exceeds compile depth ${MAX_COMPILE_DEPTH}`)
    );
    expect(() => compile(parenthesisChain(MAX_COMPILE_DEPTH), {})).not.toThrow(RangeError);
  });

  it('keeps the recursion cap above what MAX_PARSE_NESTING parenthesis levels need', () => {
    const okDepth = MAX_PARSE_NESTING - 1;
    // a parenthesis level re-enters assignment and unary once each: 2 per level
    expect(MAX_PARSE_RECURSION).toBeGreaterThanOrEqual(2 * okDepth);
    expect(() => parse('('.repeat(okDepth) + '1' + ')'.repeat(okDepth))).not.toThrow();
  });

  it.each([
    ['unary minus', '-'.repeat(20_000) + '1'],
    ['not', 'not '.repeat(10_000) + '1'],
    ['power', '1' + '^1'.repeat(20_000)],
    ['conditional', '1?'.repeat(10_000) + '1' + ':1'.repeat(10_000)],
    ['assignment', 'a='.repeat(10_000) + '1'],
  ])('rejects a %s chain with SyntaxError, not a stack overflow', (_name, text) => {
    expect(() => parse(text)).toThrow(SyntaxError);
    expect(() => parse(text)).toThrow(/nesting limit/);
  });

  it('still parses a unary chain and a power chain just under the recursion cap', () => {
    expect(() => parse('-'.repeat(100) + '1')).not.toThrow();
    expect(() => parse('1' + '^1'.repeat(100))).not.toThrow();
  });

  it.each([
    ['sum', '1' + '+1'.repeat(MAX_COMPILE_DEPTH * 4)],
    ['factorial', '1' + '!'.repeat(MAX_COMPILE_DEPTH * 4)],
    ['accessor', 'a' + '.b'.repeat(MAX_COMPILE_DEPTH * 4)],
  ])('evaluate rejects a left-deep %s with the compile-depth error, quickly', (_name, text) => {
    // Before the validator carried a depth, it absorbed the RangeError and re-walked the subtree,
    // so the work doubled at every overflowing level and this call did not return.
    const started = Date.now();
    expect(() => evaluate(text, { a: {} })).toThrow(
      new RegExp(`expression exceeds compile depth ${MAX_COMPILE_DEPTH}`)
    );
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('evaluate still accepts a long sum under the compile-depth cap', () => {
    expect(evaluate('1' + '+1'.repeat(MAX_COMPILE_DEPTH / 2))).toBe(MAX_COMPILE_DEPTH / 2 + 1);
  });
});
