/**
 * Minimal `createParse` wiring shared by parse unit tests and security fuzz tests.
 * Mirrors the bootstrap in `expression/tests/parse.test.ts` (factory node chain + mathTyped).
 */
import { createParse } from '../../src/parse.js';
import { createNode } from '../../src/node/Node.js';
import { createAccessorNode } from '../../src/node/AccessorNode.js';
import { createArrayNode } from '../../src/node/ArrayNode.js';
import { createAssignmentNode } from '../../src/node/AssignmentNode.js';
import { createBlockNode } from '../../src/node/BlockNode.js';
import { createConditionalNode } from '../../src/node/ConditionalNode.js';
import { createConstantNode } from '../../src/node/ConstantNode.js';
import { createFunctionAssignmentNode } from '../../src/node/FunctionAssignmentNode.js';
import { createFunctionNode } from '../../src/node/FunctionNode.js';
import { createIndexNode } from '../../src/node/IndexNode.js';
import { createObjectNode } from '../../src/node/ObjectNode.js';
import { createOperatorNode } from '../../src/node/OperatorNode.js';
import { createParenthesisNode } from '../../src/node/ParenthesisNode.js';
import { createRangeNode } from '../../src/node/RangeNode.js';
import { createRelationalNode } from '../../src/node/RelationalNode.js';
import { createSymbolNode } from '../../src/node/SymbolNode.js';
import { mathTyped } from '@danielsimonjr/mathts-core';

try {
  (
    mathTyped as unknown as {
      addType: (t: { name: string; test: (x: unknown) => boolean }, b: boolean) => void;
    }
  ).addType(
    {
      name: 'Node',
      test: (x: unknown): boolean =>
        typeof x === 'object' && x !== null && (x as { isNode?: unknown }).isNode === true,
    },
    false
  );
} catch {
  // Already registered in a previous test run (module-level singleton) — ignore
}

const config = { number: 'number' as const, numberFallback: 'number' as const };

function numeric(value: string, _type: string): number {
  return Number(value);
}

function isBounded(_v: unknown): boolean {
  return false;
}

class ResultSet {
  entries: unknown[];
  constructor(entries: unknown[]) {
    this.entries = entries;
  }
}

const mathScope: Record<string, unknown> = {};

const _Node = createNode({ mathWithTransform: mathScope });
const _ArrayNode = createArrayNode({ Node: _Node });
const _ObjectNode = createObjectNode({ Node: _Node });
const _OperatorNode = createOperatorNode({ Node: _Node });
const _ParenthesisNode = createParenthesisNode({ Node: _Node });
const _RangeNode = createRangeNode({ Node: _Node });
const _RelationalNode = createRelationalNode({ Node: _Node });
const _ConditionalNode = createConditionalNode({ Node: _Node });
const _BlockNode = createBlockNode({ ResultSet, Node: _Node });
const _ConstantNode = createConstantNode({ Node: _Node, isBounded });
const _FunctionAssignmentNode = createFunctionAssignmentNode({
  typed: mathTyped,
  Node: _Node,
});
const _SymbolNode = createSymbolNode({ math: mathScope, Node: _Node });
const _IndexNode = createIndexNode({ Node: _Node, size: () => [] });
const _AccessorNode = createAccessorNode({
  subset: (_obj: unknown, _idx: unknown) => _obj,
  Node: _Node,
});
const _AssignmentNode = createAssignmentNode({
  subset: (_obj: unknown, _idx: unknown, _val: unknown) => _val,
  matrix: () => ({}),
  Node: _Node,
});
const _FunctionNode = createFunctionNode({
  math: mathScope,
  Node: _Node,
  SymbolNode: _SymbolNode,
});

Object.assign(mathScope, {
  typed: mathTyped,
  config,
  numeric,
  ConstantNode: _ConstantNode,
  SymbolNode: _SymbolNode,
  OperatorNode: _OperatorNode,
  FunctionNode: _FunctionNode,
  AssignmentNode: _AssignmentNode,
  FunctionAssignmentNode: _FunctionAssignmentNode,
  BlockNode: _BlockNode,
  ArrayNode: _ArrayNode,
  ObjectNode: _ObjectNode,
  IndexNode: _IndexNode,
  AccessorNode: _AccessorNode,
  ParenthesisNode: _ParenthesisNode,
  RangeNode: _RangeNode,
  RelationalNode: _RelationalNode,
  ConditionalNode: _ConditionalNode,
});

/** Fully wired parse from `expression/src/parse.ts`. */
export const parse = createParse({
  typed: mathTyped,
  numeric,
  config,
  AccessorNode: _AccessorNode,
  ArrayNode: _ArrayNode,
  AssignmentNode: _AssignmentNode,
  BlockNode: _BlockNode,
  ConditionalNode: _ConditionalNode,
  ConstantNode: _ConstantNode,
  FunctionAssignmentNode: _FunctionAssignmentNode,
  FunctionNode: _FunctionNode,
  IndexNode: _IndexNode,
  ObjectNode: _ObjectNode,
  OperatorNode: _OperatorNode,
  ParenthesisNode: _ParenthesisNode,
  RangeNode: _RangeNode,
  RelationalNode: _RelationalNode,
  SymbolNode: _SymbolNode,
});
