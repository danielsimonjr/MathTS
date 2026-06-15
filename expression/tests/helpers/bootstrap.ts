/**
 * Shared bootstrap for expression coverage tests.
 *
 * IMPORTANT: coverage is measured against `expression/src/**`. The `functions`
 * package imports the *built* `@danielsimonjr/mathts-expression` bundle, so its
 * node classes / parse would NOT attribute coverage to the source files. We
 * therefore build all node constructors AND `parse` from `../src/...` here, and
 * borrow only the math *functions/constants* (add, sin, subset, size, …) from
 * the functions factory scope so that `_compile`/`_toTex` find real operations.
 */
import { factoryScope } from '../../../functions/src/factories/scope.js';
import * as activatedFactories from '../../../functions/src/factories/index.js';
import * as typedFns from '../../../functions/src/typed/index.js';

import { createNode } from '../../src/node/Node.js';
import { createConstantNode } from '../../src/node/ConstantNode.js';
import { createSymbolNode } from '../../src/node/SymbolNode.js';
import { createOperatorNode } from '../../src/node/OperatorNode.js';
import { createFunctionNode } from '../../src/node/FunctionNode.js';
import { createParenthesisNode } from '../../src/node/ParenthesisNode.js';
import { createAccessorNode } from '../../src/node/AccessorNode.js';
import { createIndexNode } from '../../src/node/IndexNode.js';
import { createArrayNode } from '../../src/node/ArrayNode.js';
import { createObjectNode } from '../../src/node/ObjectNode.js';
import { createAssignmentNode } from '../../src/node/AssignmentNode.js';
import { createFunctionAssignmentNode } from '../../src/node/FunctionAssignmentNode.js';
import { createConditionalNode } from '../../src/node/ConditionalNode.js';
import { createRangeNode } from '../../src/node/RangeNode.js';
import { createRelationalNode } from '../../src/node/RelationalNode.js';
import { createBlockNode } from '../../src/node/BlockNode.js';
import { createParse } from '../../src/parse.js';
import { createEvaluate } from '../../src/evaluator/evaluate.js';

const fScope = factoryScope as Record<string, any>;

// ---------------------------------------------------------------------------
// Build the math scope: functions + typed functions + constants. This is what
// the source nodes capture as their `math` namespace for compile / toTex.
// ---------------------------------------------------------------------------
const math: Record<string, any> = {
  ...fScope,
  ...(activatedFactories as Record<string, any>),
  ...(typedFns as Record<string, any>),
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  Infinity: Infinity,
  NaN: NaN,
  null: null,
  true: true,
  false: false,
};
// mathWithTransform used by base Node and SymbolNode
const mathWithTransform = math;
math.mathWithTransform = mathWithTransform;

const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const subset = fScope.subset;
const size = fScope.size;
const matrix = fScope.matrix;
const baseTyped = fScope.typed;

// The functions package's own parse already registered the string->Node
// conversion on the shared typed instance. Our source `createParse` tries to
// register it again, which throws "already a conversion". Wrap typed so that
// the duplicate registration is tolerated; everything else delegates through.
const typed: any = function (...args: any[]) {
  return baseTyped(...args);
};
// Delegate all other typed methods/properties to the real instance via the
// prototype chain (avoids copying getter-only own props).
Object.setPrototypeOf(typed, baseTyped);
typed.addConversion = (...args: any[]) => {
  try {
    return baseTyped.addConversion(...args);
  } catch (e) {
    if (e instanceof Error && /already a conversion/.test(e.message)) return undefined;
    throw e;
  }
};

// ---------------------------------------------------------------------------
// Build source node classes.
// ---------------------------------------------------------------------------
const Node = createNode({ mathWithTransform });
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math, Node });
const OperatorNode = createOperatorNode({ Node });
const FunctionNode = createFunctionNode({ math, Node, SymbolNode });
const ParenthesisNode = createParenthesisNode({ Node });
const ArrayNode = createArrayNode({ Node });
const ObjectNode = createObjectNode({ Node });
const RangeNode = createRangeNode({ Node });
const RelationalNode = createRelationalNode({ Node });
const ConditionalNode = createConditionalNode({ Node });
const AccessorNode = createAccessorNode({ subset, Node });
const IndexNode = createIndexNode({ Node, size });
const AssignmentNode = createAssignmentNode({ subset, matrix, Node });
const FunctionAssignmentNode = createFunctionAssignmentNode({ typed, Node });
const ResultSet = fScope.ResultSet ?? class ResultSet {};
const BlockNode = createBlockNode({ ResultSet, Node });

// ---------------------------------------------------------------------------
// Build source parse against the source node classes.
// ---------------------------------------------------------------------------
const parse = createParse({
  typed,
  numeric: fScope.numeric,
  config: fScope.config,
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
});

// Make parse-derived names resolvable in the math scope too (used by FunctionNode etc.)
math.parse = parse;

// Source evaluate (createEvaluate from src/evaluator) bound to source parse + math.
const evaluate = createEvaluate(parse, math);

export {
  parse,
  evaluate,
  math,
  Node,
  ConstantNode,
  SymbolNode,
  OperatorNode,
  FunctionNode,
  ParenthesisNode,
  AccessorNode,
  IndexNode,
  ArrayNode,
  ObjectNode,
  AssignmentNode,
  FunctionAssignmentNode,
  ConditionalNode,
  RangeNode,
  RelationalNode,
  BlockNode,
};
