/**
 * Default wired `parse` / `evaluate` for thin packages and one-liner use.
 *
 * Wiring is **lazy**: importing this module does not call `createParse`, so
 * co-importing `@danielsimonjr/mathts-functions` does not double-register parse
 * conversions. The instance is built on the first `parse` / `evaluate` / one-arg
 * `compileExpression` call.
 *
 * Uses a minimal arithmetic math scope (not the full functions barrel).
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { createParse } from './parse.js';
import { createNode } from './node/Node.js';
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
import { createEvaluate, compileExpressionWithDeps } from './evaluator/evaluate.js';
import type { CompiledExpression } from './compiler/compile.js';
import type { EvaluateOptions } from './evaluator/evaluate.js';
import type { MathNode } from './node/Node.js';
import type { Scope } from './compiler/compile.js';

/** Minimal math scope for arithmetic expressions (no matrix/functions barrel). */
export const defaultMathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  pow: (a: number, b: number) => Math.pow(a, b),
  mod: (a: number, b: number) => a % b,
  unaryMinus: (a: number) => -a,
  unaryPlus: (a: number) => +a,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  pi: Math.PI,
  e: Math.E,
  Infinity: Infinity,
  NaN: NaN,
  true: true,
  false: false,
};

let wired = false;
let boundParse: (expr: string) => MathNode;
let boundMathScope: Record<string, unknown>;
let boundEvaluate: (
  expr: string,
  scope?: Record<string, unknown> | Scope,
  options?: EvaluateOptions
) => unknown;

function ensureDefaultInstance(): void {
  if (wired) return;
  wired = true;

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
    // Already registered when multiple entry points load this module.
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

  boundMathScope = { ...defaultMathScope };

  const _Node = createNode({ mathWithTransform: boundMathScope });
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
  const _SymbolNode = createSymbolNode({ math: boundMathScope, Node: _Node });
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
    math: boundMathScope,
    Node: _Node,
    SymbolNode: _SymbolNode,
  });

  Object.assign(boundMathScope, {
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

  boundParse = createParse({
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

  boundEvaluate = createEvaluate(boundParse, boundMathScope);
}

/** Ready-to-call parse (no factory bootstrap). */
export function parse(expr: string): MathNode {
  ensureDefaultInstance();
  return boundParse(expr);
}

/** Ready-to-call evaluate against the default math scope. */
export function evaluate(
  expr: string,
  scope?: Record<string, unknown> | Scope,
  options?: EvaluateOptions
): unknown {
  ensureDefaultInstance();
  return boundEvaluate(expr, scope, options);
}

function isEvaluateOptions(x: unknown): x is EvaluateOptions {
  return (
    typeof x === 'object' &&
    x !== null &&
    !('has' in x) &&
    ('unsafe' in x || Object.keys(x).length === 0)
  );
}

/**
 * Compile an expression string with the default parse + math scope,
 * or forward to the factory form when given explicit dependencies.
 */
export function compileExpression(expr: string, options?: EvaluateOptions): CompiledExpression;
export function compileExpression(
  parseFn: (expr: string) => MathNode,
  mathScopeIn: Record<string, unknown>,
  expr: string,
  options?: EvaluateOptions
): CompiledExpression;
export function compileExpression(
  first: string | ((expr: string) => MathNode),
  second?: Record<string, unknown> | EvaluateOptions,
  third?: string,
  options?: EvaluateOptions
): CompiledExpression {
  if (typeof first === 'string') {
    ensureDefaultInstance();
    return compileExpressionWithDeps(
      boundParse,
      boundMathScope,
      first,
      isEvaluateOptions(second) ? second : options
    );
  }
  return compileExpressionWithDeps(
    first,
    second as Record<string, unknown>,
    third as string,
    options
  );
}
