/**
 * Expression evaluator for MathTS.
 *
 * Provides a high-level evaluate function that parses an expression string
 * and evaluates it against a math scope.
 *
 * @packageDocumentation
 */

import { compile } from '../compiler/compile.js';
import type { CompiledExpression, Scope } from '../compiler/compile.js';
import type { MathNode } from '../node/Node.js';

/**
 * Options accepted by evaluate / compileExpression.
 *
 * @property unsafe - When `true`, disables the pre-compile AST validator.
 *   The validator otherwise rejects assignments, function definitions, and
 *   calls to high-risk builtins (`import`, `createUnit`, `evaluate`, …).
 *   Only opt out when the host is providing trusted, hand-authored input.
 */
export interface EvaluateOptions {
  unsafe?: boolean;
}

/**
 * Names of forbidden top-level functions. Mirrors math-mcp's
 * `validateVariableName` blocklist plus the Mathjs RCE-vector functions
 * that build/eval other expressions at runtime.
 */
const FORBIDDEN_FUNCTIONS: ReadonlySet<string> = new Set([
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'simplify',
  'derivative',
  'help',
  'chain',
]);

/**
 * Walk an AST and throw on dangerous shapes.
 *
 * Default-safe rules:
 *   - AssignmentNode  → reject (mutating scope from an untrusted expression)
 *   - FunctionAssignmentNode → reject (`f(x) = …` lets payloads define captures)
 *   - FunctionNode whose name is in {@link FORBIDDEN_FUNCTIONS} → reject
 *
 * Caller can opt out with `{ unsafe: true }`.
 */
function validateAst(node: unknown): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }

  const n = node as Record<string, unknown>;

  // Hard rejections.
  if (n.isAssignmentNode === true) {
    throw new Error(
      'Security: assignment expressions are disabled. Pass `{ unsafe: true }` to opt out.'
    );
  }
  if (n.isFunctionAssignmentNode === true) {
    throw new Error(
      'Security: function definitions (FunctionAssignmentNode) are disabled. ' +
        'Pass `{ unsafe: true }` to opt out.'
    );
  }
  if (n.isFunctionNode === true) {
    const fn = n.fn as { isSymbolNode?: boolean; name?: unknown } | undefined;
    const fnName: string | undefined =
      (fn && typeof fn === 'object' && fn.isSymbolNode && typeof fn.name === 'string'
        ? fn.name
        : undefined) || (typeof n.name === 'string' ? n.name : undefined);
    if (fnName && FORBIDDEN_FUNCTIONS.has(fnName)) {
      throw new Error(
        `Security: call to forbidden function "${fnName}" is disabled. ` +
          'Pass `{ unsafe: true }` to opt out.'
      );
    }
  }

  // Recurse into children. Each AST node exposes `forEach`, but mock test
  // nodes don't, so fall back to walking known relational/structural fields.
  if (typeof n.forEach === 'function') {
    try {
      (n.forEach as (callback: (child: unknown) => void) => void)((child) => validateAst(child));
      return;
    } catch (err) {
      // Re-throw security errors; absorb forEach incompatibilities.
      if (err instanceof Error && err.message.startsWith('Security:')) throw err;
    }
  }

  // Manual recursion for plain mock nodes used in tests.
  for (const key of [
    'object',
    'index',
    'value',
    'expr',
    'condition',
    'trueExpr',
    'falseExpr',
    'content',
    'fn',
    'start',
    'end',
    'step',
  ]) {
    if (key in n) validateAst(n[key]);
  }
  for (const key of ['args', 'items', 'params']) {
    const arr = n[key];
    if (Array.isArray(arr)) for (const child of arr) validateAst(child);
  }
  if (Array.isArray(n.blocks)) {
    for (const b of n.blocks) validateAst(b && (b as { node?: unknown }).node);
  }
  if (n.properties && typeof n.properties === 'object') {
    const properties = n.properties as Record<string, unknown>;
    for (const k of Object.keys(properties)) validateAst(properties[k]);
  }
}

/**
 * Create an evaluate function bound to a math scope and parse function.
 *
 * @param parseFn - The parse function (from createParse factory)
 * @param mathScope - Math namespace with functions and constants
 * @returns An evaluate function
 *
 * @example
 * ```ts
 * const mathScope = { add: (a, b) => a + b, pi: Math.PI, sin: Math.sin };
 * const evaluate = createEvaluate(parse, mathScope);
 * evaluate('2 + 3');         // 5
 * evaluate('sin(pi / 2)');   // 1
 * evaluate('x^2', { x: 3 }); // 9
 * ```
 */
export function createEvaluate(
  parseFn: (expr: string) => MathNode,
  mathScope: Record<string, unknown>
) {
  /**
   * Evaluate a math expression string.
   *
   * @param expr - Expression string to evaluate (e.g., '2 + 3', 'sin(pi/2)')
   * @param scope - Optional scope with variable bindings (e.g., { x: 3 })
   * @param options - Optional flags ({@link EvaluateOptions})
   * @returns The result of evaluating the expression
   */
  function evaluate(
    expr: string,
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown;
  /**
   * Evaluate multiple expression strings.
   *
   * @param exprs - Array of expression strings
   * @param scope - Optional scope with variable bindings
   * @param options - Optional flags
   * @returns Array of results
   */
  function evaluate(
    exprs: string[],
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown[];
  function evaluate(
    exprOrExprs: string | string[],
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown | unknown[] {
    if (Array.isArray(exprOrExprs)) {
      return exprOrExprs.map((expr) => evaluateOne(expr, scope, options));
    }
    return evaluateOne(exprOrExprs, scope, options);
  }

  function evaluateOne(
    expr: string,
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown {
    const node = parseFn(expr);
    if (!options || options.unsafe !== true) {
      validateAst(node);
    }
    const compiled = compile(node, mathScope);
    return compiled.evaluate(scope);
  }

  return evaluate;
}

/**
 * Compile an expression string into a reusable CompiledExpression.
 *
 * @param parseFn - The parse function
 * @param mathScope - Math namespace
 * @param expr - Expression string
 * @param options - Optional flags ({@link EvaluateOptions})
 * @returns CompiledExpression that can be evaluated multiple times with different scopes
 *
 * @example
 * ```ts
 * const compiled = compileExpression(parse, mathScope, 'x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * ```
 */
export function compileExpression(
  parseFn: (expr: string) => MathNode,
  mathScope: Record<string, unknown>,
  expr: string,
  options?: EvaluateOptions
): CompiledExpression {
  const node = parseFn(expr);
  if (!options || options.unsafe !== true) {
    validateAst(node);
  }
  return compile(node, mathScope);
}
