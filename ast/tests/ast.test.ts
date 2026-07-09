import { describe, it, expect } from 'vitest';
import * as ast from '../src/index.js';

/**
 * Re-export of the AST node constructors from
 * `@danielsimonjr/mathts-expression`. Asserts the re-exported symbols are the
 * genuine MathTS factory functions, so the focused entry point can't drift from
 * expression. Node behaviour is covered by expression's own node tests.
 */
interface NodeFactory {
  isFactory: boolean;
}

describe('@danielsimonjr/mathts-ast re-export surface', () => {
  it('exposes all 16 AST node constructor factories', () => {
    const names = [
      'createNode',
      'createAccessorNode',
      'createArrayNode',
      'createAssignmentNode',
      'createBlockNode',
      'createConditionalNode',
      'createConstantNode',
      'createFunctionAssignmentNode',
      'createFunctionNode',
      'createIndexNode',
      'createObjectNode',
      'createOperatorNode',
      'createParenthesisNode',
      'createRangeNode',
      'createRelationalNode',
      'createSymbolNode',
    ];
    expect(names.length).toBe(16);
    for (const name of names) {
      const f = (ast as unknown as Record<string, NodeFactory>)[name];
      expect(typeof f).toBe('function');
      expect(f.isFactory).toBe(true);
    }
  });
});
