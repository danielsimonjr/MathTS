/**
 * Default dependencies for the parse factory (`createParse`).
 *
 * The parse factory needs a typed instance, a numeric parser, a config, and the
 * AST node constructors. These defaults build the missing ones for a math scope.
 * The scope the caller passes to `createParse` is also the math scope of the
 * node constructors built here: a symbol resolves against the caller's scope
 * (`createParse(create(all))`), not against a fixed namespace. With no caller
 * scope, the shared default math scope is used. The nodes see the caller's
 * scope through `expressionView`: the names that `math.evaluate` denies
 * (`import`, `createUnit`, `parse`, ...) do not exist for them either.
 *
 * Host-owned runtime functions (`subset`, `matrix`, `size`) come from the
 * caller's scope. The default scope has none of them, so only the default scope
 * gets neutral stubs, as the default parse always had. A stub only lets the
 * parse tree be built; it does not change evaluation results. A caller scope
 * without one of them gets the factory's "missing dependency" error.
 * `isBounded` and `ResultSet` come from the caller's scope when it has them.
 * Otherwise the built-in ones below stand in: they behave like the real ones.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { expressionView, getDefaultMathScope } from './default-math-scope.js';
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

/** Result container that a block of statements returns. It has the shape of the `ResultSet` type. */
class ResultSet {
  entries: unknown[];
  constructor(entries: unknown[]) {
    this.entries = entries;
  }
  /** The type guard `isResultSet` reads this flag from the constructor prototype. */
  get isResultSet(): true {
    return true;
  }
  valueOf(): unknown[] {
    return this.entries;
  }
  toString(): string {
    return '[' + this.entries.map(String).join(', ') + ']';
  }
}

function numeric(value: string, _type: string): number {
  return Number(value);
}

const config = { number: 'number' as const, numberFallback: 'number' as const };

/** A number or BigNumber constant is bounded when it is finite; `toTex` prints the others as infinity. */
function isBounded(value: unknown): boolean {
  return Number.isFinite(Number(value));
}

/**
 * Build the parse dependencies that `missing` names, for the scope the caller
 * supplied (or the default math scope). The caller's values are never replaced:
 * the factory only asks for names the caller left out. Each dependency is built
 * only when it is named, so a missing host function does not block a node
 * constructor that the caller supplied itself.
 */
export const parseDefaults: DefaultDependencies = (supplied, missing) => {
  const isDefaultScope = supplied === undefined;
  /** The scope the dependencies are read from. */
  const source: Record<string, unknown> = supplied ?? getDefaultMathScope();
  /** The scope the nodes resolve names against: the denylist is hidden. */
  const math = isDefaultScope ? source : expressionView(source);
  /** A host function from the scope. Only the default scope falls back to a stub. */
  const host = (name: string, stub: unknown): unknown =>
    source[name] ?? (isDefaultScope ? stub : undefined);

  const typed: unknown = source.typed ?? mathTyped;
  /** The caller's `Node` base class, else the base shared by every default node of this scope. */
  let nodeBase: unknown;
  const getNode = (): unknown => (nodeBase ??= source.Node ?? nodeBaseFor(math));
  /** A caller-supplied `SymbolNode` is shared with `FunctionNode`, so both use one class. */
  let symbolNode: unknown;
  const getSymbolNode = (): unknown =>
    (symbolNode ??= source.SymbolNode ?? createSymbolNode({ math, Node: getNode() }));

  const builders: Record<string, () => unknown> = {
    typed: () => typed,
    numeric: () => numeric,
    config: () => config,
    AccessorNode: () =>
      createAccessorNode({ subset: host('subset', (obj: unknown) => obj), Node: getNode() }),
    ArrayNode: () => createArrayNode({ Node: getNode() }),
    AssignmentNode: () =>
      createAssignmentNode({
        subset: host('subset', (_obj: unknown, _idx: unknown, val: unknown) => val),
        matrix: host('matrix', () => ({})),
        Node: getNode(),
      }),
    BlockNode: () => createBlockNode({ ResultSet: source.ResultSet ?? ResultSet, Node: getNode() }),
    ConditionalNode: () => createConditionalNode({ Node: getNode() }),
    ConstantNode: () =>
      createConstantNode({ Node: getNode(), isBounded: source.isBounded ?? isBounded }),
    FunctionAssignmentNode: () => createFunctionAssignmentNode({ typed, Node: getNode() }),
    FunctionNode: () => createFunctionNode({ math, Node: getNode(), SymbolNode: getSymbolNode() }),
    IndexNode: () => createIndexNode({ Node: getNode(), size: host('size', () => []) }),
    ObjectNode: () => createObjectNode({ Node: getNode() }),
    OperatorNode: () => createOperatorNode({ Node: getNode() }),
    ParenthesisNode: () => createParenthesisNode({ Node: getNode() }),
    RangeNode: () => createRangeNode({ Node: getNode() }),
    RelationalNode: () => createRelationalNode({ Node: getNode() }),
    SymbolNode: getSymbolNode,
  };

  const fill: Record<string, unknown> = {};
  for (const key of missing) {
    const build = builders[key];
    if (build !== undefined) fill[key] = build();
  }
  return fill;
};
