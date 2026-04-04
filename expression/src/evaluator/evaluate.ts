/**
 * Expression evaluator for MathTS.
 *
 * Provides a high-level evaluate function that parses an expression string
 * and evaluates it against a math scope.
 *
 * @packageDocumentation
 */

import { compile } from '../compiler/compile.js'
import type { CompiledExpression, Scope } from '../compiler/compile.js'

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
  parseFn: (expr: string) => any,
  mathScope: Record<string, any>
) {
  /**
   * Evaluate a math expression string.
   *
   * @param expr - Expression string to evaluate (e.g., '2 + 3', 'sin(pi/2)')
   * @param scope - Optional scope with variable bindings (e.g., { x: 3 })
   * @returns The result of evaluating the expression
   */
  function evaluate(expr: string, scope?: Record<string, any> | Scope): any
  /**
   * Evaluate multiple expression strings.
   *
   * @param exprs - Array of expression strings
   * @param scope - Optional scope with variable bindings
   * @returns Array of results
   */
  function evaluate(exprs: string[], scope?: Record<string, any> | Scope): any[]
  function evaluate(
    exprOrExprs: string | string[],
    scope?: Record<string, any> | Scope
  ): any | any[] {
    if (Array.isArray(exprOrExprs)) {
      return exprOrExprs.map(expr => evaluateOne(expr, scope))
    }
    return evaluateOne(exprOrExprs, scope)
  }

  function evaluateOne(expr: string, scope?: Record<string, any> | Scope): any {
    const node = parseFn(expr)
    const compiled = compile(node, mathScope)
    return compiled.evaluate(scope)
  }

  return evaluate
}

/**
 * Compile an expression string into a reusable CompiledExpression.
 *
 * @param parseFn - The parse function
 * @param mathScope - Math namespace
 * @param expr - Expression string
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
  parseFn: (expr: string) => any,
  mathScope: Record<string, any>,
  expr: string
): CompiledExpression {
  const node = parseFn(expr)
  return compile(node, mathScope)
}
