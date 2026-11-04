import { describe, it, expect } from 'vitest';
import * as expression from '@danielsimonjr/mathts-expression';
import * as ast from '../src/index.js';

/**
 * Drift guard: `ast` must re-export EVERY node factory that `expression`
 * exports (`createNode` + every `create*Node`), and nothing else. Adding a node
 * type to expression without surfacing it here fails this test.
 */
const PINNED = [
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
];

describe('@danielsimonjr/mathts-ast facade sync with expression', () => {
  it('re-exports exactly the pinned node-factory list', () => {
    expect(Object.keys(ast).sort()).toEqual(PINNED);
  });

  it('covers every create*Node factory that expression exports', () => {
    const fromExpression = Object.keys(expression)
      .filter((k) => /^create\w*Node$/.test(k))
      .sort();
    expect(Object.keys(ast).sort()).toEqual(fromExpression);
  });

  it('re-exports the same function objects (no copies)', () => {
    const e = expression as Record<string, unknown>;
    const a = ast as Record<string, unknown>;
    for (const name of PINNED) expect(a[name]).toBe(e[name]);
  });
});
