/**
 * @danielsimonjr/mathts-ast
 *
 * Standalone AST node constructors for MathTS expressions. Re-exports the
 * abstract-syntax-tree node factories from
 * {@link @danielsimonjr/mathts-expression} as a focused package, for tooling
 * that builds, walks, transforms, or pretty-prints MathTS expression trees
 * without needing the evaluator. The implementation lives in expression; this is
 * an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  createNode,
  createAccessorNode,
  createArrayNode,
  createAssignmentNode,
  createBlockNode,
  createConditionalNode,
  createConstantNode,
  createFunctionAssignmentNode,
  createFunctionNode,
  createIndexNode,
  createObjectNode,
  createOperatorNode,
  createParenthesisNode,
  createRangeNode,
  createRelationalNode,
  createSymbolNode,
} from '@danielsimonjr/mathts-expression';

// Re-export the type surface (AST node types, etc.)
export type * from '@danielsimonjr/mathts-expression';
