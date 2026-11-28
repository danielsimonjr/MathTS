/**
 * Per-instance AST node constructors bound to the compat parse/evaluate scope (#1786).
 */
import {
  createAccessorNode,
  createArrayNode,
  createAssignmentNode,
  createBlockNode,
  createConditionalNode,
  createConstantNode,
  createFunctionAssignmentNode,
  createFunctionNode,
  createIndexNode,
  createNode,
  createObjectNode,
  createOperatorNode,
  createParenthesisNode,
  createRangeNode,
  createRelationalNode,
  createSymbolNode,
  ResultSet,
} from '@danielsimonjr/mathts-expression';
import type { MathNode } from '@danielsimonjr/mathts-expression';
import { compatExpressionView } from './compat-expression-view.js';

export type CompatExpressionNodeConstructors = Record<string, new (...args: unknown[]) => MathNode>;

type BuildNodesHost = Record<string, unknown>;

function isBounded(value: unknown): boolean {
  return Number.isFinite(Number(value));
}

/** Build node classes that resolve symbols against `scope` (mathjs `createParse(create(all))`). */
export function buildCompatExpressionNodeConstructors(
  scope: Record<string, unknown>,
  instance?: Record<string, unknown>
): CompatExpressionNodeConstructors {
  const base = compatExpressionView(scope);
  const math =
    instance === undefined
      ? base
      : new Proxy(base, {
          get(_target, key, receiver) {
            if (typeof key === 'string') {
              const live = instance[key];
              if (typeof live === 'function') return live;
            }
            return Reflect.get(base, key, receiver);
          },
          has(_target, key) {
            if (typeof key === 'string' && typeof instance[key] === 'function') return true;
            return Reflect.has(base, key);
          },
        });
  const host = (instance ?? scope) as BuildNodesHost;
  const Node = createNode({ mathWithTransform: math });
  const SymbolNode = createSymbolNode({
    math,
    Node,
    Unit: host.Unit,
  });
  const hostFn = (name: string, stub: unknown): unknown => host[name] ?? stub;
  const hostSubset = hostFn('subset', (_obj: unknown, _idx: unknown, val: unknown) => val);
  const subsetForAssign = (...args: unknown[]): unknown => {
    if (args.length >= 3 && Array.isArray(args[2])) {
      args = args.slice();
      const value = args[2];
      args[2] =
        typeof structuredClone === 'function'
          ? structuredClone(value)
          : (value as unknown[]).slice();
    }
    return (hostSubset as (...a: unknown[]) => unknown)(...args);
  };
  return {
    Node: Node as new (...args: unknown[]) => MathNode,
    SymbolNode: SymbolNode as new (...args: unknown[]) => MathNode,
    AccessorNode: createAccessorNode({
      subset: hostFn('subset', (obj: unknown) => obj),
      Node,
    }) as new (...args: unknown[]) => MathNode,
    ArrayNode: createArrayNode({ Node }) as new (...args: unknown[]) => MathNode,
    AssignmentNode: createAssignmentNode({
      subset: subsetForAssign,
      matrix: hostFn('matrix', () => ({})),
      Node,
    }) as new (...args: unknown[]) => MathNode,
    BlockNode: createBlockNode({ ResultSet: host.ResultSet ?? ResultSet, Node }) as new (
      ...args: unknown[]
    ) => MathNode,
    ConditionalNode: createConditionalNode({ Node }) as new (...args: unknown[]) => MathNode,
    ConstantNode: createConstantNode({
      Node,
      isBounded: (host.isBounded as ((v: unknown) => boolean) | undefined) ?? isBounded,
    }) as new (...args: unknown[]) => MathNode,
    FunctionAssignmentNode: createFunctionAssignmentNode({
      typed: host.typed,
      Node,
    }) as new (...args: unknown[]) => MathNode,
    FunctionNode: createFunctionNode({ math, Node, SymbolNode }) as new (
      ...args: unknown[]
    ) => MathNode,
    IndexNode: createIndexNode({ Node, size: hostFn('size', () => []) }) as new (
      ...args: unknown[]
    ) => MathNode,
    ObjectNode: createObjectNode({ Node }) as new (...args: unknown[]) => MathNode,
    OperatorNode: createOperatorNode({ Node }) as new (...args: unknown[]) => MathNode,
    ParenthesisNode: createParenthesisNode({ Node }) as new (...args: unknown[]) => MathNode,
    RangeNode: createRangeNode({ Node }) as new (...args: unknown[]) => MathNode,
    RelationalNode: createRelationalNode({ Node }) as new (...args: unknown[]) => MathNode,
  };
}
