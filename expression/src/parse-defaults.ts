/**
 * Default dependencies for the parse factory (`createParse`).
 *
 * The parse factory needs a typed instance, a numeric parser, a config, and the
 * AST node constructors. These defaults build the missing ones for a math scope.
 * The node constructors are bound to that scope: a symbol resolves against the
 * caller's `math`, not against a fixed namespace. When the caller gives no scope,
 * the shared default math scope is used.
 *
 * Host-owned runtime functions (`subset`, `matrix`, `size`) come from the scope
 * when it has them. Otherwise a neutral stub stands in, as the default parse always
 * did. Those stubs only build parse trees; they do not change evaluation results
 * for the default scope.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { getDefaultMathScope } from './default-math-scope.js';
import { nodeBaseFor } from './node/default-node.js';
import { createAccessorNode } from './node/AccessorNode.js';
import { createArrayNode } from './node/ArrayNode.js';
import { createAssignmentNode } from './node/AssignmentNode.js';
import { createBlockNode } from './node/BlockNode.js';
import { createConditionalNode } from './node/ConditionalNode.js';
import { createConstantNode } from './node/ConstantNode.js';
import { createFunctionAssignmentNode } from './node/FunctionAssignmentNode.js';
import { createFunctionNode } from './node/FunctionNode.js';
import { createIndexNode } from './node/IndexNode.js';
import { createObjectNode } from './node/ObjectNode.js';
import { createOperatorNode } from './node/OperatorNode.js';
import { createParenthesisNode } from './node/ParenthesisNode.js';
import { createRangeNode } from './node/RangeNode.js';
import { createRelationalNode } from './node/RelationalNode.js';
import { createSymbolNode } from './node/SymbolNode.js';
import type { DefaultDependencies } from './utils/factory.js';

/** Result container that a block of statements returns. */
class ResultSet {
  entries: unknown[];
  constructor(entries: unknown[]) {
    this.entries = entries;
  }
}

function numeric(value: string, _type: string): number {
  return Number(value);
}

const config = { number: 'number' as const, numberFallback: 'number' as const };

function isBounded(_v: unknown): boolean {
  return false;
}

/** Register the `Node` type once. A second registration is a no-op. */
function registerNodeType(): void {
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
    // Already registered by an earlier call.
  }
}

/**
 * Build the parse dependencies that `missing` names, for the scope the caller
 * supplied (or the default math scope). The caller's values are never replaced:
 * the factory only asks for names the caller left out.
 */
export const parseDefaults: DefaultDependencies = (supplied, missing) => {
  const math: Record<string, unknown> = supplied ?? getDefaultMathScope();
  registerNodeType();

  const Node: unknown = supplied?.Node ?? nodeBaseFor(math);
  const SymbolNode = createSymbolNode({ math, Node });
  const owned: Record<string, unknown> = {
    typed: mathTyped,
    numeric,
    config,
    AccessorNode: createAccessorNode({
      subset: math.subset ?? ((obj: unknown) => obj),
      Node,
    }),
    ArrayNode: createArrayNode({ Node }),
    AssignmentNode: createAssignmentNode({
      subset: math.subset ?? ((_obj: unknown, _idx: unknown, val: unknown) => val),
      matrix: math.matrix ?? (() => ({})),
      Node,
    }),
    BlockNode: createBlockNode({ ResultSet, Node }),
    ConditionalNode: createConditionalNode({ Node }),
    ConstantNode: createConstantNode({ Node, isBounded }),
    FunctionAssignmentNode: createFunctionAssignmentNode({
      typed: mathTyped,
      Node,
    }),
    FunctionNode: createFunctionNode({
      math,
      Node,
      SymbolNode,
    }),
    IndexNode: createIndexNode({ Node, size: math.size ?? (() => []) }),
    ObjectNode: createObjectNode({ Node }),
    OperatorNode: createOperatorNode({ Node }),
    ParenthesisNode: createParenthesisNode({ Node }),
    RangeNode: createRangeNode({ Node }),
    RelationalNode: createRelationalNode({ Node }),
    SymbolNode,
  };

  const fill: Record<string, unknown> = {};
  for (const key of missing) {
    if (owned[key] !== undefined) fill[key] = owned[key];
  }
  return fill;
};
