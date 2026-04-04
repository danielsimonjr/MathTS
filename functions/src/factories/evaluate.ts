/**
 * Expression evaluator wired to the activated factory scope.
 *
 * Bootstraps the mathjs parse system (node constructors + createParse)
 * and connects it to the full activated math scope, producing a top-level
 * `evaluate(expr, scope?)` function.
 *
 * @packageDocumentation
 */

import {
  createEvaluate,
  compileExpression as _compileExpression,
  createParse,
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
} from '@mathts/expression';

import { createResultSet } from '../type/resultset/ResultSet.js';
import { factoryScope } from './scope.js';
import * as activatedFactories from './index.js';
import * as typedFns from '../typed/index.js';

// ---------------------------------------------------------------------------
// Step 1: Build the full math scope
// ---------------------------------------------------------------------------

const mathScope: Record<string, any> = {
  // Core scope (typed, config, Complex, BigNumber, etc.)
  ...factoryScope,

  // Activated factory functions (abs, addScalar, equalScalar, etc.)
  ...(activatedFactories as Record<string, any>),

  // Typed functions (add, subtract, multiply, divide, pow, sin, cos, etc.)
  ...(typedFns as Record<string, any>),

  // Math constants
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  Infinity: Infinity,
  NaN: NaN,
  null: null,
  true: true,
  false: false,
};

// ---------------------------------------------------------------------------
// Step 2: Bootstrap node constructors
// Order matters: Node must come first (all others depend on it)
// ---------------------------------------------------------------------------

// ResultSet class (needed by BlockNode)
const ResultSet = createResultSet({});

// Base Node class — needs mathWithTransform (full math scope used as proxy)
const Node = createNode({ mathWithTransform: mathScope });

// Simple nodes that only need Node
const ArrayNode = createArrayNode({ Node });
const ObjectNode = createObjectNode({ Node });
const OperatorNode = createOperatorNode({ Node });
const ParenthesisNode = createParenthesisNode({ Node });
const RangeNode = createRangeNode({ Node });
const RelationalNode = createRelationalNode({ Node });
const ConditionalNode = createConditionalNode({ Node });
const BlockNode = createBlockNode({ ResultSet, Node });

// ConstantNode needs Node + isBounded
const ConstantNode = createConstantNode({
  Node,
  isBounded: (activatedFactories as any).isBounded,
});

// FunctionAssignmentNode needs typed + Node
const FunctionAssignmentNode = createFunctionAssignmentNode({
  typed: (factoryScope as any).typed,
  Node,
});

// AccessorNode needs subset + Node
const AccessorNode = createAccessorNode({
  subset: (activatedFactories as any).subset,
  Node,
});

// AssignmentNode needs subset + matrix + Node
const AssignmentNode = createAssignmentNode({
  subset: (activatedFactories as any).subset,
  matrix: (factoryScope as any).matrix,
  Node,
});

// IndexNode needs Node + size
const IndexNode = createIndexNode({
  Node,
  size: (activatedFactories as any).size,
});

// SymbolNode needs math + Node (Unit is optional — omitted)
const SymbolNode = createSymbolNode({
  math: mathScope,
  Node,
});

// FunctionNode needs math + Node + SymbolNode
const FunctionNode = createFunctionNode({
  math: mathScope,
  Node,
  SymbolNode,
});

// ---------------------------------------------------------------------------
// Step 3: Create the parse function
// ---------------------------------------------------------------------------

const parseScope: Record<string, any> = {
  typed: (factoryScope as any).typed,
  numeric: (activatedFactories as any).numeric,
  config: (factoryScope as any).config,
  AccessorNode,
  ArrayNode,
  AssignmentNode,
  BlockNode,
  ConditionalNode,
  ConstantNode,
  FunctionAssignmentNode,
  FunctionNode,
  IndexNode,
  ObjectNode,
  OperatorNode,
  ParenthesisNode,
  RangeNode,
  RelationalNode,
  SymbolNode,
};

/**
 * Parse a math expression string into an AST node.
 * Can be used for inspection or pre-compilation.
 */
export const parse = createParse(parseScope);

// ---------------------------------------------------------------------------
// Step 4: Create the evaluate function
// ---------------------------------------------------------------------------

/**
 * Evaluate a math expression string against the full activated math scope.
 *
 * @param expr - Expression string (e.g., '2 + 3', 'sin(pi/2)', 'x^2')
 * @param scope - Optional variable bindings (e.g., { x: 3 })
 * @returns The result of evaluating the expression
 *
 * @example
 * ```ts
 * evaluate('2 + 3');            // 5
 * evaluate('sin(pi / 2)');      // 1
 * evaluate('x^2 + 1', { x: 3 }) // 10
 * ```
 */
export const evaluate = createEvaluate(parse, mathScope);

/**
 * Compile a math expression into a reusable CompiledExpression.
 *
 * More efficient than `evaluate` when the same expression is evaluated
 * many times with different variable bindings.
 *
 * @param expr - Expression string to compile
 * @returns CompiledExpression with an evaluate(scope?) method
 *
 * @example
 * ```ts
 * const compiled = compileExpr('x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * ```
 */
export function compileExpr(expr: string) {
  return _compileExpression(parse, mathScope, expr);
}
