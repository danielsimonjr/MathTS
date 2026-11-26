/**
 * The ready-made mathjs node classes (#1571).
 *
 * mathjs exports `Node`, `ConstantNode`, … as classes; the expression package's
 * factories (`createConstantNode` and friends) build them with injected
 * dependencies. This module builds each class once at the package's default
 * config and exports it under the mathjs name, in addition to the factories.
 * Every class shares the one `Node` base for the default math scope, so the
 * `instanceof` chain is single, and the classes a parsed tree carries are the
 * same identities these exports name (a `parse('2')` node IS a `ConstantNode`).
 *
 * The host-owned dependencies (`subset`, `matrix`, `size`) have neutral stubs,
 * as in the parse defaults: they only let the trees be built; they do not
 * change evaluation results. Hosts that compile nodes against their own scope
 * pass their own dependencies through the factories.
 *
 * Each export is explicitly typed as the factory's return type rather than left
 * to inference: the declared type then references the factory's declaration,
 * whose `.d.ts` is exported, instead of the closure-private class types
 * (declaration emit cannot name those).
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { getDefaultMathScope } from '../default-math-scope.js';
import { nodeBaseFor } from './default-node.js';
import { createAccessorNode } from './AccessorNode.js';
import { createArrayNode } from './ArrayNode.js';
import { createAssignmentNode } from './AssignmentNode.js';
import { createBlockNode } from './BlockNode.js';
import { createConditionalNode } from './ConditionalNode.js';
import { createConstantNode } from './ConstantNode.js';
import { createFunctionAssignmentNode } from './FunctionAssignmentNode.js';
import { createFunctionNode } from './FunctionNode.js';
import { createIndexNode } from './IndexNode.js';
import { createObjectNode } from './ObjectNode.js';
import { createOperatorNode } from './OperatorNode.js';
import { createParenthesisNode } from './ParenthesisNode.js';
import { createRangeNode } from './RangeNode.js';
import { createRelationalNode } from './RelationalNode.js';
import { createSymbolNode } from './SymbolNode.js';
import { ResultSet } from '../ResultSet.js';

const math = getDefaultMathScope();
const isBounded = (value: unknown): boolean => Number.isFinite(Number(value));

/** The shared base node class for the default math scope. */
export const Node: ReturnType<typeof nodeBaseFor> = nodeBaseFor(math);

export const ConstantNode: ReturnType<typeof createConstantNode> = createConstantNode({
  Node,
  isBounded,
});
export const SymbolNode: ReturnType<typeof createSymbolNode> = createSymbolNode({ math, Node });
export const OperatorNode: ReturnType<typeof createOperatorNode> = createOperatorNode({ Node });
export const FunctionNode: ReturnType<typeof createFunctionNode> = createFunctionNode({
  math,
  Node,
  SymbolNode,
});
export const ParenthesisNode: ReturnType<typeof createParenthesisNode> = createParenthesisNode({
  Node,
});
export const ArrayNode: ReturnType<typeof createArrayNode> = createArrayNode({ Node });
export const ObjectNode: ReturnType<typeof createObjectNode> = createObjectNode({ Node });
export const RangeNode: ReturnType<typeof createRangeNode> = createRangeNode({ Node });
export const RelationalNode: ReturnType<typeof createRelationalNode> = createRelationalNode({
  Node,
});
export const ConditionalNode: ReturnType<typeof createConditionalNode> = createConditionalNode({
  Node,
});
export const AccessorNode: ReturnType<typeof createAccessorNode> = createAccessorNode({
  subset: (obj: unknown) => obj,
  Node,
});
export const IndexNode: ReturnType<typeof createIndexNode> = createIndexNode({
  Node,
  size: () => [],
});
export const AssignmentNode: ReturnType<typeof createAssignmentNode> = createAssignmentNode({
  subset: (_obj: unknown, _idx: unknown, value: unknown) => value,
  matrix: () => ({}),
  Node,
});
export const FunctionAssignmentNode: ReturnType<typeof createFunctionAssignmentNode> =
  createFunctionAssignmentNode({ typed: mathTyped, Node });
export const BlockNode: ReturnType<typeof createBlockNode> = createBlockNode({ ResultSet, Node });
