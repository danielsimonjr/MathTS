import { describe, it, expect } from 'vitest';
import * as expression from '@danielsimonjr/mathts-expression';
import * as parser from '../src/index.js';

/**
 * Drift guard: `parser` must re-export the parse entry points, the node
 * factories parsing produces, and the operator/keyword metadata (the
 * tokenizer/syntax tables) from `expression`, as the very same objects.
 */
const PINNED = [
  // parse entry points
  'createParse',
  'createParser',
  'createParserClass',
  // node factories
  'createAccessorNode',
  'createArrayNode',
  'createAssignmentNode',
  'createBlockNode',
  'createConditionalNode',
  'createConstantNode',
  'createFunctionAssignmentNode',
  'createFunctionNode',
  'createIndexNode',
  'createNode',
  'createObjectNode',
  'createOperatorNode',
  'createParenthesisNode',
  'createRangeNode',
  'createRelationalNode',
  'createSymbolNode',
  // operator + keyword (syntax) metadata
  'getAssociativity',
  'getOperator',
  'getPrecedence',
  'isAssociativeWith',
  'keywords',
  'properties',
];

describe('@danielsimonjr/mathts-parser facade sync with expression', () => {
  it('re-exports exactly the pinned list', () => {
    expect(Object.keys(parser).sort()).toEqual([...PINNED].sort());
  });

  it('re-exports the same objects as expression (no copies)', () => {
    const e = expression as Record<string, unknown>;
    const p = parser as Record<string, unknown>;
    for (const name of PINNED) {
      expect(e[name]).toBeDefined();
      expect(p[name]).toBe(e[name]);
    }
  });

  it('includes every parse*/create*Parse* entry point expression exports', () => {
    const parseLike = Object.keys(expression).filter((k) =>
      /^create(Parse|Parser|ParserClass)$/.test(k)
    );
    for (const name of parseLike) expect(Object.keys(parser)).toContain(name);
  });
});
