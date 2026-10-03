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
import {
  Complex,
  Fraction,
  I,
  PHI,
  SQRT2,
  SQRT1_2,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  Unit,
  type UnitInstance,
} from '@danielsimonjr/mathts-core';

/** Map-like scope accepted by the expression compiler. */
interface Scope {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

import { factoryScope } from './scope.js';
import * as activatedFactories from './index.js';
import * as typedFns from '../typed/index.js';

// ---------------------------------------------------------------------------
// Step 1: Build the full math scope
// ---------------------------------------------------------------------------

const mathScope: Record<string, unknown> = {
  // Core scope (typed, config, Complex, BigNumber, etc.)
  ...factoryScope,

  // Activated factory functions (abs, addScalar, equalScalar, etc.)
  ...(activatedFactories as Record<string, unknown>),

  // Typed functions (add, subtract, multiply, divide, pow, sin, cos, etc.)
  ...(typedFns as Record<string, unknown>),

  // Math constants
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  phi: PHI,
  i: I,
  SQRT2,
  SQRT1_2,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  Infinity: Infinity,
  NaN: NaN,
  null: null,
  true: true,
  false: false,
};

// ---------------------------------------------------------------------------
// Step 1b: Expression-language transforms (wired 2026-07-05)
// ---------------------------------------------------------------------------
// Overlay the expression-language transforms (built once in factories/index.ts
// against factoryScope and registered on `mathWithTransform`): 1-based
// indices/dimensions (`A[1]`, `row(M, 1)`, `max(M, 1)`), end-inclusive ranges,
// and lazy `and`/`or`/`??` via `rawArgs` (which the standalone compiler in
// expression/src/compiler honors). Only the EXPRESSION namespace gets these —
// the programmatic API stays zero-based, exactly like mathjs.
{
  const mwt = factoryScope.mathWithTransform as Record<string, unknown>;
  for (const key of [
    'and',
    'bitAnd',
    'bitOr',
    'column',
    'concat',
    'cumsum',
    'diff',
    'filter',
    'forEach',
    'index',
    'map',
    'mapSlices',
    'max',
    'mean',
    'min',
    'nullish',
    'or',
    'print',
    'quantileSeq',
    'range',
    'row',
    'std',
    'subset',
    'sum',
    'variance',
  ]) {
    if (typeof mwt[key] === 'function') mathScope[key] = mwt[key];
  }
}

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
export const parse = factoryScope.parse as Parameters<typeof createEvaluate>[0];

// ---------------------------------------------------------------------------
// Step 3: Create the evaluate function
// ---------------------------------------------------------------------------

const _evaluate = createEvaluate(parse, mathScope);

/**
 * Exact elementary charge (CODATA / 2019 SI), in coulombs.
 * Physics mode binds bare `e` to a Unit of this many coulombs.
 */
const ELEMENTARY_CHARGE_COULOMB = 1.602176634e-19;

/** A fresh Unit so a caller cannot mutate the shared constant. */
function elementaryChargeUnit(): UnitInstance {
  return new Unit(ELEMENTARY_CHARGE_COULOMB, 'C');
}

/**
 * How physics mode binds bare `e`.
 *
 * `unit` is a `Unit` of `1.602176634e-19 C`. `scalar` is that same SI
 * magnitude as a plain number, so `1 - e^2` is ordinary arithmetic.
 */
export type PhysicsCharge = 'unit' | 'scalar';

/**
 * Options for {@link evaluate}, {@link compileExpr}, and {@link parser}.
 */
export interface PhysicsEvaluateOptions {
  /**
   * When `true`, disables the pre-compile AST validator.
   * Only opt out when the host is providing trusted, hand-authored input.
   */
  unsafe?: boolean;
  /**
   * Opt-in physics reading of bare `e`.
   *
   * When `true`, `e` is the elementary charge. The default binding is the
   * Unit `1.602176634e-19 C`. Pass `charge: 'scalar'` for the plain SI
   * magnitude, so a dimensionless formula such as `1 - e^2` can subtract.
   * `E` stays unbound so a formula can use it for energy. Euler's number is
   * only `exp(x)`, for example `exp(1)`. An explicit scope binding for `e`
   * still wins. Default `false`: `e` is Euler's number.
   */
  physics?: boolean;
  /**
   * Binding of bare `e` when {@link physics} is `true`. Default `'unit'`.
   * Setting this without `physics: true` throws.
   */
  charge?: PhysicsCharge;
}

/** Options for {@link physicsScope}. */
export interface PhysicsScopeOptions {
  /** Default `'unit'`. `'scalar'` binds the SI magnitude instead of a Unit. */
  charge?: PhysicsCharge;
}

function isMapScope(scope: object): scope is Scope {
  const candidate = scope as Partial<Scope>;
  return (
    typeof candidate.has === 'function' &&
    typeof candidate.get === 'function' &&
    typeof candidate.set === 'function'
  );
}

function physicsBinding(charge: PhysicsCharge | undefined): UnitInstance | number {
  return charge === 'scalar' ? ELEMENTARY_CHARGE_COULOMB : elementaryChargeUnit();
}

/**
 * Scope in which bare `e` is the elementary charge.
 *
 * Pass the result as `evaluate`'s scope, or use `{ physics: true }`.
 * Entries already present on `scope` win, including an explicit `e`.
 * `{ charge: 'scalar' }` binds the SI magnitude instead of a Unit.
 */
export function physicsScope(
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsScopeOptions
): Record<string, unknown> | Scope {
  const charge = physicsBinding(options?.charge);
  if (scope == null) return { e: charge };
  if (isMapScope(scope)) {
    if (scope.has('e')) return scope;
    return {
      has(key: string): boolean {
        return key === 'e' || scope.has(key);
      },
      get(key: string): unknown {
        return key === 'e' ? charge : scope.get(key);
      },
      set(key: string, value: unknown): void {
        scope.set(key, value);
      },
    };
  }
  if (Object.prototype.hasOwnProperty.call(scope, 'e')) return scope;
  return { e: charge, ...scope };
}

/**
 * Evaluate a math expression string against the full activated math scope.
 *
 * @param expr - Expression string (e.g., '2 + 3', 'sin(pi/2)', 'x^2')
 * @param scope - Optional variable bindings (e.g., { x: 3 })
 * @param options - Optional flags. `{ physics: true }` reads bare `e` as the elementary charge.
 * @returns The result of evaluating the expression
 *
 * @example
 * ```ts
 * evaluate('2 + 3');                              // 5
 * evaluate('sin(pi / 2)');                        // 1
 * evaluate('x^2 + 1', { x: 3 });                  // 10
 * evaluate('e');                                  // Euler's number
 * evaluate('e', undefined, { physics: true });    // 1.602176634e-19 C
 * evaluate('e', undefined, { physics: true, charge: 'scalar' }); // 1.602176634e-19
 * evaluate('1 - e^2', undefined, { physics: true, charge: 'scalar' }); // near 1
 * evaluate('exp(1)', undefined, { physics: true }); // Euler's number
 * ```
 */
function assertPhysicsOptions(options?: PhysicsEvaluateOptions): PhysicsScopeOptions | undefined {
  if (options?.charge !== undefined && options.charge !== 'unit' && options.charge !== 'scalar') {
    throw new TypeError('charge must be "unit" or "scalar"');
  }
  if (options?.physics !== true) {
    if (options?.charge !== undefined) {
      throw new TypeError('charge requires { physics: true }');
    }
    return undefined;
  }
  return { charge: options.charge ?? 'unit' };
}

export function evaluate(
  expr: string,
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): unknown;
export function evaluate(
  exprs: string[],
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): unknown[];
export function evaluate(
  exprOrExprs: string | string[],
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): unknown | unknown[] {
  const physics = assertPhysicsOptions(options);
  const bound = physics === undefined ? scope : physicsScope(scope, physics);
  const inner = options?.unsafe === true ? { unsafe: true as const } : undefined;
  if (Array.isArray(exprOrExprs)) return _evaluate(exprOrExprs, bound, inner);
  return _evaluate(exprOrExprs, bound, inner);
}

/**
 * Compile a math expression into a reusable CompiledExpression.
 *
 * More efficient than `evaluate` when the same expression is evaluated
 * many times with different variable bindings.
 *
 * @param expr - Expression string to compile
 * @param options - Optional flags. `{ physics: true }` reads bare `e` as the elementary charge.
 * @returns CompiledExpression with an evaluate(scope?) method
 *
 * @example
 * ```ts
 * const compiled = compileExpr('x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * compileExpr('e', { physics: true }).evaluate(); // 1.602176634e-19 C
 * compileExpr('1 - e^2', { physics: true, charge: 'scalar' }).evaluate(); // near 1
 * ```
 */
export function compileExpr(expr: string, options?: PhysicsEvaluateOptions) {
  const compiled = _compileExpression(
    parse,
    mathScope,
    expr,
    options?.unsafe === true ? { unsafe: true } : undefined
  );
  const physics = assertPhysicsOptions(options);
  if (physics === undefined) return compiled;
  return {
    evaluate(scope?: Record<string, unknown> | Scope): unknown {
      return compiled.evaluate(physicsScope(scope, physics));
    },
  };
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
 * @param options - Optional flags. `{ physics: true }` reads bare `e` as the elementary charge.
 * @example
 * ```ts
 * const p = parser();
 * p.set('x', 3);
 * p.evaluate('x^2');               // 9
 * p.set('y', p.evaluate('x + 1')); // retain a computed value
 * p.get('y');                      // 4
 * parser({ physics: true }).evaluate('exp(1)'); // Euler's number
 * ```
 */
export function parser(options?: PhysicsEvaluateOptions) {
  const scope: Record<string, unknown> = {};
  const callOptions: PhysicsEvaluateOptions | undefined =
    options?.physics === true || options?.unsafe === true || options?.charge !== undefined
      ? { physics: options?.physics, unsafe: options?.unsafe, charge: options?.charge }
      : undefined;
  return {
    /** The live scope object — assignments during `evaluate` land here. */
    scope,
    /** Evaluate an expression against the retained scope. */
    evaluate(expr: string): unknown {
      return evaluate(expr, scope, callOptions);
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
