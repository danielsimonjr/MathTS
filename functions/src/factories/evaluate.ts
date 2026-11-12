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
  compileExpressionWithDeps as _compileExpression,
} from '@danielsimonjr/mathts-expression';
import {
  BigNumber,
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

/**
 * Symbols that build or evaluate other expressions, or that are the typed-function
 * dispatcher. They stay out of every namespace the safe expression language can
 * resolve, including the one `Node.compile` and map/filter callbacks close over.
 * A denylist that only covers the object passed to `createEvaluate` is not enough:
 * those callbacks compile against `mathWithTransform`.
 */
/** Symbols kept out of the safe expression namespace (also enforced on compat import). */
export const EVALUATE_SCOPE_OMIT = new Set([
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
]);

function omitEvaluateInternals(scope: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...scope };
  for (const key of EVALUATE_SCOPE_OMIT) {
    delete out[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 1: Build the full math scope
// ---------------------------------------------------------------------------

const fullMathScope: Record<string, unknown> = {
  // Core scope (typed, config, Complex, BigNumber, etc.)
  ...factoryScope,

  // Activated factory functions (abs, addScalar, equalScalar, etc.)
  ...(activatedFactories as Record<string, unknown>),

  // Typed functions (add, subtract, multiply, divide, pow, sin, cos, etc.)
  ...(typedFns as Record<string, unknown>),

  // Math constants (Unicode aliases for notebook input)
  pi: Math.PI,
  π: Math.PI,
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

const mathScope: Record<string, unknown> = omitEvaluateInternals(fullMathScope);

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
    if (typeof mwt[key] === 'function' && !EVALUATE_SCOPE_OMIT.has(key)) {
      mathScope[key] = mwt[key];
    }
  }
  // Same object Node.compile and inline map/filter callbacks close over.
  for (const key of EVALUATE_SCOPE_OMIT) delete mwt[key];
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

/**
 * Literal parsing reads the live config (`number`, `numberFallback`,
 * `precision`, ...) through the overlay-aware view in `factoryScope.config`,
 * so a compiled expression is only reusable under the same config values.
 */
const liveConfig = factoryScope.config as Record<string, unknown>;
function configFingerprint(): string {
  let key = '';
  for (const k in liveConfig) key += k + '=' + String(liveConfig[k]) + ';';
  return key;
}

/**
 * Trusted-input scope: the safe scope plus the compiler/dispatch symbols
 * `{ unsafe: true }` is allowed to call by name. Callback re-entry still uses
 * the stripped `mathWithTransform`, so a safe `map` callback cannot load them.
 */
const unsafeMathScope: Record<string, unknown> = { ...mathScope };
for (const key of EVALUATE_SCOPE_OMIT) {
  if (Object.prototype.hasOwnProperty.call(fullMathScope, key)) {
    unsafeMathScope[key] = fullMathScope[key];
  }
}

const _evaluate = createEvaluate(parse, mathScope, configFingerprint);
const _evaluateUnsafe = createEvaluate(parse, unsafeMathScope, configFingerprint);

/**
 * Exact elementary charge (CODATA / 2019 SI), in coulombs.
 * Physics scopes bind `e0`, not bare `e`.
 */
const ELEMENTARY_CHARGE_COULOMB = 1.602176634e-19;

/** A fresh Unit so a caller cannot mutate the shared constant. */
function elementaryChargeUnit(): UnitInstance {
  return new Unit(ELEMENTARY_CHARGE_COULOMB, 'C');
}

/**
 * How {@link physicsScope} binds elementary charge (`e0`).
 *
 * `unit` is a `Unit` of `1.602176634e-19 C`. `scalar` is that same SI
 * magnitude as a plain number, so `1 - e0^2` is ordinary arithmetic.
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
   * Opt-in physics constant bindings (CODATA units on `e0`, `G`, `c`, `hbar`, …).
   *
   * Bare `e` stays Euler's number; use `e0` or `elementaryCharge` for the
   * elementary charge. Pass `charge: 'scalar'` so `e0` is the plain SI
   * magnitude for dimensionless formulas such as `1 - e0^2`.
   * Default `false`: only the usual math scope applies.
   */
  physics?: boolean;
  /**
   * Binding of `e0` when {@link physics} is `true`. Default `'unit'`.
   * Setting this without `physics: true` throws.
   */
  charge?: PhysicsCharge;
}

/** Options for {@link physicsScope}. */
export interface PhysicsScopeOptions {
  /** Default `'unit'`. `'scalar'` binds the SI magnitude instead of a Unit on `e0`. */
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

const PHYSICS_SCOPE_KEYS = ['e0', 'elementaryCharge', 'G', 'c', 'hbar'] as const;

type PhysicsScopeKey = (typeof PHYSICS_SCOPE_KEYS)[number];

function defaultPhysicsBindings(
  charge: PhysicsCharge | undefined
): Record<PhysicsScopeKey, unknown> {
  const factories = activatedFactories as Record<string, unknown>;
  return {
    e0: physicsBinding(charge),
    elementaryCharge: factories.elementaryCharge,
    G: factories.gravitationConstant,
    c: factories.speedOfLight,
    hbar: factories.reducedPlanckConstant,
  };
}

function mergePhysicsIntoRecord(
  scope: Record<string, unknown>,
  bindings: Record<PhysicsScopeKey, unknown>
): Record<string, unknown> {
  return { ...bindings, ...scope };
}

/**
 * Scope with CODATA physics constants (`e0`, `G`, `c`, `hbar`, …).
 *
 * Bare `e` is **not** rebound — it remains Euler's number on the math scope.
 * Pass the result as `evaluate`'s scope, or use `{ physics: true }`.
 * Explicit entries on `scope` win for each constant key.
 */
export function physicsScope(
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsScopeOptions
): Record<string, unknown> | Scope {
  const bindings = defaultPhysicsBindings(options?.charge);
  if (scope == null) return { ...bindings };
  if (isMapScope(scope)) {
    return {
      has(key: string): boolean {
        return (bindings as Record<string, unknown>)[key] !== undefined || scope.has(key);
      },
      get(key: string): unknown {
        if (scope.has(key)) return scope.get(key);
        const bound = (bindings as Record<string, unknown>)[key];
        return bound === undefined ? scope.get(key) : bound;
      },
      set(key: string, value: unknown): void {
        scope.set(key, value);
      },
    };
  }
  return mergePhysicsIntoRecord(scope, bindings);
}

/**
 * Validate `evaluate`'s `physics` and `charge` options.
 *
 * @param options - The options that `evaluate` received.
 * @returns The scope options for the elementary-charge binding, or `undefined` when `physics` is off.
 * @throws TypeError - When `charge` is not `'unit'` or `'scalar'`, or is set without `physics`.
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

/**
 * Evaluate a math expression string against the full activated math scope.
 *
 * @param expr - Expression string (e.g., '2 + 3', 'sin(pi/2)', 'x^2')
 * @param scope - Optional variable bindings (e.g., { x: 3 })
 * @param options - Optional flags. `{ physics: true }` adds CODATA physics constants.
 * @returns The result of evaluating the expression
 *
 * @example
 * ```ts
 * evaluate('2 + 3');                              // 5
 * evaluate('sin(pi / 2)');                        // 1
 * evaluate('x^2 + 1', { x: 3 });                  // 10
 * evaluate('e');                                  // Euler's number
 * evaluate('e0', undefined, { physics: true });   // 1.602176634e-19 C
 * evaluate('e0', undefined, { physics: true, charge: 'scalar' }); // 1.602176634e-19
 * evaluate('1 - e0^2', undefined, { physics: true, charge: 'scalar' }); // near 1
 * evaluate('exp(1)', undefined, { physics: true }); // Euler's number
 * ```
 */
export function evaluate(
  expr: string,
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): number;
export function evaluate(
  exprs: string[],
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): number[];
/** Implementation signature of the overloads above; the documented contract is on the first overload. */
export function evaluate(
  exprOrExprs: string | string[],
  scope?: Record<string, unknown> | Scope,
  options?: PhysicsEvaluateOptions
): number | number[] {
  const physics = assertPhysicsOptions(options);
  const bound = physics === undefined ? scope : physicsScope(scope, physics);
  const inner = options?.unsafe === true ? { unsafe: true as const } : undefined;
  const runner = options?.unsafe === true ? _evaluateUnsafe : _evaluate;
  if (Array.isArray(exprOrExprs)) return runner(exprOrExprs, bound, inner) as number[];
  return runner(exprOrExprs, bound, inner) as number;
}

/**
 * Compile a math expression into a reusable CompiledExpression.
 *
 * More efficient than `evaluate` when the same expression is evaluated
 * many times with different variable bindings.
 *
 * @param expr - Expression string to compile
 * @param options - Optional flags. `{ physics: true }` adds CODATA physics constants.
 * @returns CompiledExpression with an evaluate(scope?) method
 *
 * @example
 * ```ts
 * const compiled = compileExpr('x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * compileExpr('e0', { physics: true }).evaluate(); // 1.602176634e-19 C
 * compileExpr('1 - e0^2', { physics: true, charge: 'scalar' }).evaluate(); // near 1
 * ```
 */
export function compileExpr(expr: string, options?: PhysicsEvaluateOptions) {
  const compiled = _compileExpression(
    parse,
    options?.unsafe === true ? unsafeMathScope : mathScope,
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
      case 'Unit':
        return Unit.fromJSON(tagged as unknown as Parameters<typeof Unit.fromJSON>[0]);
      case 'BigNumber':
        return BigNumber.fromJSON({
          value: typeof tagged.value === 'string' ? tagged.value : String(tagged.value),
        });
      case 'DenseMatrix': {
        const Ctor = factoryScope.DenseMatrix as new (data: {
          data: unknown;
          size: number[];
        }) => unknown;
        const data = tagged.data;
        const size = Array.isArray(tagged.size) ? (tagged.size as number[]) : [];
        return new Ctor({ data, size });
      }
      case 'SparseMatrix': {
        const Ctor = factoryScope.SparseMatrix as new (data: {
          values: unknown;
          index: unknown;
          ptr: unknown;
          size: unknown;
        }) => unknown;
        return new Ctor({
          values: tagged.values,
          index: tagged.index,
          ptr: tagged.ptr,
          size: tagged.size,
        });
      }
      case 'number':
        if (tagged.value === 'Infinity') return Infinity;
        if (tagged.value === '-Infinity') return -Infinity;
        if (tagged.value === 'NaN') return NaN;
        return Number(tagged.value);
    }
  }
  return value;
}

function scrubImportedExpressionScope(imported: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...imported };
  for (const key of EVALUATE_SCOPE_OMIT) {
    delete out[key];
  }
  return out;
}

function buildScopedMathNamespace(imported: Record<string, unknown>): Record<string, unknown> {
  return omitEvaluateInternals({ ...mathScope, ...scrubImportedExpressionScope(imported) });
}

function buildUnsafeScopedMathNamespace(
  imported: Record<string, unknown>
): Record<string, unknown> {
  const scoped = buildScopedMathNamespace(imported);
  for (const key of EVALUATE_SCOPE_OMIT) {
    if (Object.prototype.hasOwnProperty.call(fullMathScope, key)) {
      scoped[key] = fullMathScope[key];
    }
  }
  return scoped;
}

/**
 * Evaluate/compile pair that closes over per-instance imports (compat `math.import`).
 * Denylisted symbols cannot be reached from safe evaluate, even if import tries to
 * override them.
 */
export function createInstanceEvaluator(importedExpressionScope: Record<string, unknown>): {
  evaluate: typeof evaluate;
  compile: typeof compileExpr;
} {
  const safeScope = buildScopedMathNamespace(importedExpressionScope);
  const unsafeScope = buildUnsafeScopedMathNamespace(importedExpressionScope);
  const safeEvaluate = createEvaluate(parse, safeScope, configFingerprint);
  const unsafeEvaluate = createEvaluate(parse, unsafeScope, configFingerprint);

  function evaluateBound(
    exprOrExprs: string | string[],
    scope?: Record<string, unknown> | Scope,
    options?: PhysicsEvaluateOptions
  ): unknown | unknown[] {
    const physics = assertPhysicsOptions(options);
    const bound = physics === undefined ? scope : physicsScope(scope, physics);
    const inner = options?.unsafe === true ? { unsafe: true as const } : undefined;
    const runner = options?.unsafe === true ? unsafeEvaluate : safeEvaluate;
    if (Array.isArray(exprOrExprs)) return runner(exprOrExprs, bound, inner);
    return runner(exprOrExprs, bound, inner);
  }

  function compileBound(expr: string, options?: PhysicsEvaluateOptions) {
    const compiled = _compileExpression(
      parse,
      options?.unsafe === true ? unsafeScope : safeScope,
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

  return {
    evaluate: evaluateBound as typeof evaluate,
    compile: compileBound as typeof compileExpr,
  };
}
