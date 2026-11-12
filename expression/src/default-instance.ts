/**
 * Default wired `parse` / `evaluate` for thin packages and one-liner use.
 *
 * Wiring is **lazy**: importing this module does not call `createParse`, so
 * co-importing `@danielsimonjr/mathts-functions` does not double-register parse
 * conversions. The instance is built on the first `parse` / `evaluate` / one-arg
 * `compileExpression` call.
 *
 * Uses a minimal arithmetic math scope (not the full functions barrel).
 * That scope is the safe namespace: `parse`, `typed`, `compile`, `import`,
 * `createUnit`, `resolve`, `chain`, `simplify`, `derivative`, and the node
 * constructors are not properties of it. `evaluate` / one-arg
 * `compileExpression` therefore cannot resolve them, including from a nested
 * expression (`map`'s callback is compiled against the same object).
 * Assignment and function definitions still require `{ unsafe: true }`.
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
import { compile } from './compiler/compile.js';
import { createEvaluate, compileExpressionWithDeps } from './evaluator/evaluate.js';
import { compileInlineExpression } from './transform/utils/compileInlineExpression.js';
import type { CompiledExpression } from './compiler/compile.js';
import type { EvaluateOptions } from './evaluator/evaluate.js';
import type { MathNode } from './node/Node.js';
import type { Scope } from './compiler/compile.js';

/**
 * A compiled expression from the ready-to-call `compileExpression(expr)`.
 * Call it or use `.evaluate()`. Both read an optional scope.
 */
export interface CallableCompiledExpression extends CompiledExpression {
  (scope?: Record<string, unknown> | Scope): unknown;
}

/**
 * Names that build or evaluate other expressions. They are never copied onto
 * the default math scope (the same denylist `functions` evaluate strips).
 */
const SAFE_SCOPE_OMIT: readonly string[] = [
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'typed',
  'simplify',
  'derivative',
  'help',
  'chain',
  'parser',
  'resolve',
  'config',
  'numeric',
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'AssignmentNode',
  'FunctionAssignmentNode',
  'BlockNode',
  'ArrayNode',
  'ObjectNode',
  'IndexNode',
  'AccessorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'ConditionalNode',
];

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
  π: Math.PI,
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

  // Parser dependencies stay in this closure. They are not copied onto
  // boundMathScope: that object is mathWithTransform (node.compile / map
  // callbacks) and the namespace createEvaluate resolves symbols against.
  for (const key of SAFE_SCOPE_OMIT) {
    delete boundMathScope[key];
  }

  // Callbacks compile against this same object, so a nested expression cannot
  // see the symbols deleted above. Arrays only: the default scope has no matrix.
  boundMathScope.map = createCallbackTransform('map', false);
  boundMathScope.filter = createCallbackTransform('filter', true);

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
export function compileExpression(
  expr: string,
  options?: EvaluateOptions
): CallableCompiledExpression;
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
): CallableCompiledExpression | CompiledExpression {
  if (typeof first === 'string') {
    ensureDefaultInstance();
    return asCallable(
      compileExpressionWithDeps(
        boundParse,
        boundMathScope,
        first,
        isEvaluateOptions(second) ? second : options
      )
    );
  }
  return compileExpressionWithDeps(
    first,
    second as Record<string, unknown>,
    third as string,
    options
  );
}

/**
 * `map` / `filter` for the default scope. `rawArgs` so the callback expression
 * is compiled against `math` (the stripped scope), not evaluated as a value.
 */
function createCallbackTransform(kind: 'map' | 'filter', keepOnTruthy: boolean) {
  const transform = (args: MathNode[], math: Record<string, unknown>, scope: Scope): unknown => {
    if (args.length < 2) {
      throw new TypeError(`${kind} expects an array and a callback expression`);
    }
    const collection = compile(args[0] as MathNode, math).evaluate(scope);
    if (!Array.isArray(collection)) {
      throw new TypeError(`${kind} on the default evaluator expects an array`);
    }
    const callback = compileInlineExpression(
      args[1] as unknown as Parameters<typeof compileInlineExpression>[0],
      math,
      scope as unknown as Map<string, unknown>
    );
    const out: unknown[] = [];
    for (const item of collection) {
      const value: unknown = callback(item);
      if (keepOnTruthy) {
        if (value) out.push(item);
      } else {
        out.push(value);
      }
    }
    return out;
  };
  transform.rawArgs = true;
  return transform;
}

/** `compileExpression('2+3')()` and `.evaluate()` share one compiled body. */
function asCallable(compiled: CompiledExpression): CallableCompiledExpression {
  const call = (scope?: Record<string, unknown> | Scope): unknown => compiled.evaluate(scope);
  const fn = call as CallableCompiledExpression;
  fn.evaluate = (scope?: Record<string, unknown> | Scope): unknown => compiled.evaluate(scope);
  return fn;
}
