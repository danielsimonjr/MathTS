/**
 * @danielsimonjr/mathts-parser
 *
 * Standalone expression parser for MathTS. This package re-exports the parser
 * surface from {@link @danielsimonjr/mathts-expression} — the `parse` function
 * factory and the `Parser` class factory, along with the AST node constructors
 * that parsing produces and the operator/keyword metadata the parser relies on —
 * so it can be installed and consumed on its own (mirroring the other MathTS
 * packages: expression, matrix, parallel, functions, …).
 *
 * The implementation lives in `@danielsimonjr/mathts-expression`; this package is
 * a focused entry point, not a copy.
 *
 * @example
 * ```ts
 * import { createParse, createParserClass } from '@danielsimonjr/mathts-parser';
 * // wire the factory into your MathTS instance via create()/typed-function,
 * // exactly as you would when consuming it from @danielsimonjr/mathts-expression.
 * ```
 *
 * @packageDocumentation
 */

export {
  // Parser entry points
  createParse,
  createParserClass,
  createParser,

  // AST node constructors produced by the parser
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

  // Operator + keyword metadata the parser depends on
  keywords,
  properties,
  getPrecedence,
  getAssociativity,
  isAssociativeWith,
  getOperator,
} from '@danielsimonjr/mathts-expression';

// Re-export the type surface (AST node types, parser/operator types, etc.)
export type * from '@danielsimonjr/mathts-expression';
