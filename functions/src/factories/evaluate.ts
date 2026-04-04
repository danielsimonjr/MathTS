/**
 * Expression evaluator wired to the activated factory scope.
 *
 * Reuses the parse function and node constructors built in index.ts
 * and connects them to the full activated math scope, producing a top-level
 * `evaluate(expr, scope?)` function.
 *
 * @packageDocumentation
 */

import {
  createEvaluate,
  compileExpression as _compileExpression,
} from '@mathts/expression';

import { factoryScope } from './scope.js';
import * as activatedFactories from './index.js';
import * as typedFns from '../typed/index.js';

// ---------------------------------------------------------------------------
// Step 1: Build the full math scope
// ---------------------------------------------------------------------------

const mathScope: Record<string, any> = {
  // Core scope (typed, config, Complex, BigNumber, etc.)
  ...factoryScope,

  // Activated factory functions (abs, addScalar, equalScalar, etc.)
  ...(activatedFactories as Record<string, any>),

  // Typed functions (add, subtract, multiply, divide, pow, sin, cos, etc.)
  ...(typedFns as Record<string, any>),

  // Math constants
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  Infinity: Infinity,
  NaN: NaN,
  null: null,
  true: true,
  false: false,
};

// ---------------------------------------------------------------------------
// Step 2: Reuse parse from index.ts (already built with node constructors)
// ---------------------------------------------------------------------------

/**
 * Parse a math expression string into an AST node.
 * Can be used for inspection or pre-compilation.
 *
 * Reuses the parse function built in index.ts to avoid duplicate
 * typed-function conversion registrations.
 */
export const parse = (factoryScope as any).parse;

// ---------------------------------------------------------------------------
// Step 3: Create the evaluate function
// ---------------------------------------------------------------------------

/**
 * Evaluate a math expression string against the full activated math scope.
 *
 * @param expr - Expression string (e.g., '2 + 3', 'sin(pi/2)', 'x^2')
 * @param scope - Optional variable bindings (e.g., { x: 3 })
 * @returns The result of evaluating the expression
 *
 * @example
 * ```ts
 * evaluate('2 + 3');            // 5
 * evaluate('sin(pi / 2)');      // 1
 * evaluate('x^2 + 1', { x: 3 }) // 10
 * ```
 */
export const evaluate = createEvaluate(parse, mathScope);

/**
 * Compile a math expression into a reusable CompiledExpression.
 *
 * More efficient than `evaluate` when the same expression is evaluated
 * many times with different variable bindings.
 *
 * @param expr - Expression string to compile
 * @returns CompiledExpression with an evaluate(scope?) method
 *
 * @example
 * ```ts
 * const compiled = compileExpr('x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * ```
 */
export function compileExpr(expr: string) {
  return _compileExpression(parse, mathScope, expr);
}
