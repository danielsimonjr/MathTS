import { describe, it, expect } from 'vitest';
import { parse } from '@danielsimonjr/mathts-functions';
import { compile } from '../../src/compiler/compile.js';
import { MAX_COMPILE_DEPTH, MAX_EXPRESSION_LENGTH, MAX_PARSE_NESTING } from '../../src/limits.js';
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
});
