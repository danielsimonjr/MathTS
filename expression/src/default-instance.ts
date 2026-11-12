/**
 * Default wired `parse` / `evaluate` for thin packages and one-liner use.
 *
 * Wiring is **lazy**: importing this module builds nothing. The default parse,
 * math scope and evaluate are built on the first call that needs them, and each
 * is built once. The public factories (`createParse`, `createEvaluate`) resolve
 * the same defaults when the caller leaves a dependency out.
 *
 * Uses the minimal arithmetic math scope (`defaultMathScope`), not the full
 * functions barrel. See `default-math-scope.ts` for the safe-namespace rules.
 *
 * @packageDocumentation
 */

import { getDefaultMathScope, defaultMathScope } from './default-math-scope.js';
import {
  getDefaultParse,
  getDefaultEvaluate,
  compileExpressionWithDeps,
} from './evaluator/evaluate.js';
import type { CompiledExpression } from './compiler/compile.js';
import type { EvaluateOptions } from './evaluator/evaluate.js';
import type { MathNode } from './node/Node.js';
import type { Scope } from './compiler/compile.js';

export { defaultMathScope };

/**
 * A compiled expression from the ready-to-call `compileExpression(expr)`.
 * Call it or use `.evaluate()`. Both read an optional scope.
 */
export interface CallableCompiledExpression extends CompiledExpression {
  (scope?: Record<string, unknown> | Scope): unknown;
}

/** Ready-to-call parse (no factory bootstrap). */
export function parse(expr: string): MathNode {
  return getDefaultParse()(expr);
}

/** Ready-to-call evaluate against the default math scope. */
export function evaluate(
  expr: string,
  scope?: Record<string, unknown> | Scope,
  options?: EvaluateOptions
): unknown {
  return getDefaultEvaluate()(expr, scope, options);
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
    return asCallable(
      compileExpressionWithDeps(
        getDefaultParse(),
        getDefaultMathScope(),
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

/** `compileExpression('2+3')()` and `.evaluate()` share one compiled body. */
function asCallable(compiled: CompiledExpression): CallableCompiledExpression {
  const call = (scope?: Record<string, unknown> | Scope): unknown => compiled.evaluate(scope);
  const fn = call as CallableCompiledExpression;
  fn.evaluate = (scope?: Record<string, unknown> | Scope): unknown => compiled.evaluate(scope);
  return fn;
}
