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
} from '@danielsimonjr/mathts-expression';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';

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

// ---------------------------------------------------------------------------
// Stateful parser (EXPANSION_PLAN W9)
// ---------------------------------------------------------------------------

/**
 * A stateful parser with a retained scope. Variables persist across
 * `evaluate` calls.
 *
 * Assignment expressions (`x = 5`) are rejected by the expression security
 * validator — manage retained state with `set` / `get` instead.
 *
 * @example
 * ```ts
 * const p = parser();
 * p.set('x', 3);
 * p.evaluate('x^2');               // 9
 * p.set('y', p.evaluate('x + 1')); // retain a computed value
 * p.get('y');                      // 4
 * ```
 */
export function parser() {
  const scope: Record<string, unknown> = {};
  return {
    /** The live scope object — assignments during `evaluate` land here. */
    scope,
    /** Evaluate an expression against the retained scope. */
    evaluate(expr: string): unknown {
      return evaluate(expr, scope);
    },
    /** Read a retained variable. */
    get(name: string): unknown {
      return scope[name];
    },
    /** Set a retained variable. */
    set(name: string, value: unknown): void {
      scope[name] = value;
    },
    /** Remove a retained variable. */
    remove(name: string): void {
      delete scope[name];
    },
    /** Clear all retained variables. */
    clear(): void {
      for (const key of Object.keys(scope)) delete scope[key];
    },
  };
}

// ---------------------------------------------------------------------------
// JSON reviver / replacer (EXPANSION_PLAN W9)
// ---------------------------------------------------------------------------

/**
 * `JSON.stringify` replacer that preserves non-finite numbers. `Complex` and
 * `Fraction` already serialize via their own `toJSON()`.
 */
export function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number') {
    if (value === Infinity) return { mathjs: 'number', value: 'Infinity' };
    if (value === -Infinity) return { mathjs: 'number', value: '-Infinity' };
    if (Number.isNaN(value)) return { mathjs: 'number', value: 'NaN' };
  }
  return value;
}

/**
 * `JSON.parse` reviver that reconstructs `Complex`, `Fraction`, and
 * non-finite numbers tagged by {@link replacer} / the types' own `toJSON()`.
 */
export function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && 'mathjs' in value) {
    const tagged = value as { mathjs: string; [k: string]: unknown };
    switch (tagged.mathjs) {
      case 'Complex':
        return Complex.fromJSON(tagged as unknown as { re: number; im: number });
      case 'Fraction':
        return Fraction.fromJSON(tagged as unknown as { n: string; d: string });
      case 'number':
        if (tagged.value === 'Infinity') return Infinity;
        if (tagged.value === '-Infinity') return -Infinity;
        if (tagged.value === 'NaN') return NaN;
        return Number(tagged.value);
    }
  }
  return value;
}
