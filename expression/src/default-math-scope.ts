/**
 * The default math scope that the public factories fall back to.
 *
 * It is a minimal arithmetic namespace (not the full functions barrel). It is
 * the safe namespace: `parse`, `typed`, `compile`, `import`, `createUnit`,
 * `resolve`, `chain`, `simplify`, `derivative`, and the node constructors are not
 * properties of it. `evaluate` / one-arg `compileExpression` therefore cannot
 * resolve them, including from a nested expression (`map`'s callback is compiled
 * against the same object).
 *
 * A negative real outside the real domain gives a Complex, as in mathjs: `sqrt(-4)` is `2i`,
 * `log(-1)` is `πi`, and `(-8)^(1/3)` is `1 + 1.732i`. A NaN argument keeps the number NaN.
 *
 * @packageDocumentation
 */

import { Complex, I, isComplex } from '@danielsimonjr/mathts-core';
import { compile } from './compiler/compile.js';
import type { Scope } from './compiler/compile.js';
import { compileInlineExpression } from './transform/utils/compileInlineExpression.js';
import type { MathNode } from './node/Node.js';

/**
 * Names that build or evaluate other expressions, or that are the typed-function
 * dispatcher or a node constructor. An expression must never resolve them. This
 * is the single source of the expression denylist: `functions` evaluate, compat
 * import and the parse defaults all read it.
 */
export const EXPRESSION_SCOPE_OMIT: ReadonlySet<string> = new Set([
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
  // compat instance members that compile, import or rebind the evaluator, or
  // that run a callback under another config.
  'compileExpr',
  'importFactory',
  'createInstanceEvaluator',
  'runWithConfig',
  'expression',
  'emit',
  'create',
  'factory',
  'on',
  'off',
  'once',
  'Node',
  'Parser',
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

/** Names kept off the default math scope: the denylist plus the parser dependencies. */
const SAFE_SCOPE_OMIT: readonly string[] = [...EXPRESSION_SCOPE_OMIT, 'config', 'numeric'];

const expressionViews = new WeakMap<object, Record<string, unknown>>();

/**
 * A live view of a caller's math scope in which the names of
 * `EXPRESSION_SCOPE_OMIT` do not exist. Every other read goes to the caller's
 * scope, so later changes to that scope stay visible. One view per scope, so
 * node classes built for one scope share one `Node` base.
 */
export function expressionView(scope: Record<string, unknown>): Record<string, unknown> {
  let view = expressionViews.get(scope);
  if (view !== undefined) return view;
  const hidden = (key: string | symbol): boolean =>
    typeof key === 'string' && EXPRESSION_SCOPE_OMIT.has(key);
  // The proxy target is an empty object, so the traps can hide a property of the
  // caller's scope without breaking a proxy invariant.
  view = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => (hidden(key) ? undefined : Reflect.get(scope, key)),
    has: (_t, key) => !hidden(key) && Reflect.has(scope, key),
    set: (_t, key, value) => !hidden(key) && Reflect.set(scope, key, value),
    deleteProperty: (_t, key) => !hidden(key) && Reflect.deleteProperty(scope, key),
    ownKeys: () => Reflect.ownKeys(scope).filter((key) => !hidden(key)),
    getOwnPropertyDescriptor: (_t, key) => {
      if (hidden(key)) return undefined;
      const descriptor = Reflect.getOwnPropertyDescriptor(scope, key);
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
    },
    getPrototypeOf: () => Reflect.getPrototypeOf(scope),
  });
  expressionViews.set(scope, view);
  return view;
}

/**
 * The real n-th root. An odd integer index keeps the sign of a negative radicand
 * (nthRoot(-8, 3) is -2). An even index of a negative radicand is NaN.
 */
function nthRoot(a: number, n: number = 2): number {
  if (n === 0) return NaN;
  if (n < 0) return 1 / nthRoot(a, -n);
  const negative = a < 0;
  if (negative && !(Number.isInteger(n) && n % 2 === 1)) return NaN;
  const magnitude = Math.abs(a);
  const root = Math.pow(magnitude, 1 / n);
  // Prefer the exact integer root when one exists: 81^(1/4) must be 3, not 3.0000000000000004.
  const rounded = Math.round(root);
  const exact = Number.isInteger(n) && Math.pow(rounded, n) === magnitude ? rounded : root;
  return negative ? -exact : exact;
}

/** A value of the default scope: a real number or a Complex. */
type Operand = number | Complex;

/** Lifts a real operand to Complex, so a Complex operation can take it on either side. */
function complexOf(x: Operand): Complex {
  return isComplex(x) ? x : Complex.fromNumber(x);
}

/**
 * Real `a ^ b`. A negative base with a non-integer exponent gives the Complex power, as in
 * mathjs. An integer exponent stays real.
 * @param a - the base
 * @param b - the exponent
 * @returns a number, or a Complex for a negative base with a non-integer exponent
 */
function powReal(a: number, b: number): Operand {
  if (!(a < 0) || Number.isInteger(b)) return Math.pow(a, b);
  // mathjs keeps the real limit 0 for these two cases; the Complex power gives NaN + NaN i.
  if ((a * a < 1 && b === Infinity) || (a * a > 1 && b === -Infinity)) return 0;
  return complexOf(a).pow(b);
}

/**
 * A binary operator. A Complex operand routes to Complex arithmetic; two real
 * operands keep the plain JS result, or a Complex when the real form says so (a negative
 * base with a non-integer exponent). Without the Complex branch a Complex coerces to its
 * magnitude through `valueOf`, so `1 + i` would return 2.
 */
function binary(
  real: (a: number, b: number) => Operand,
  complex: (a: Complex, b: Operand) => Complex
): (a: Operand, b: Operand) => Operand {
  return (a, b) => (isComplex(a) || isComplex(b) ? complex(complexOf(a), b) : real(a, b));
}

/**
 * A function of one argument with a real form and a Complex form. A Complex argument takes the
 * Complex form. A real argument keeps the plain JS result, or a Complex when the real form says
 * so (a negative real outside the real domain, as in mathjs).
 */
function unary(
  real: (a: number) => Operand,
  complex: (a: Complex) => Operand
): (a: Operand) => Operand {
  return (a) => (isComplex(a) ? complex(a) : real(a));
}

/**
 * A real-only function (`mod`, `nthRoot`; mathjs also rejects a complex value for both).
 * A Complex argument throws. It is never coerced to a number, because `valueOf` returns the magnitude.
 */
function realOnly(name: string, fn: (...args: number[]) => number): (...args: Operand[]) => number {
  return (...args) => {
    if (args.some((arg) => isComplex(arg))) {
      throw new TypeError(`${name} does not take a complex value in the default scope`);
    }
    return fn(...(args as number[]));
  };
}

/** Minimal math scope for arithmetic expressions (no matrix/functions barrel). */
export const defaultMathScope: Record<string, unknown> = {
  add: binary(
    (a, b) => a + b,
    (a, b) => a.add(complexOf(b))
  ),
  subtract: binary(
    (a, b) => a - b,
    (a, b) => a.sub(complexOf(b))
  ),
  multiply: binary(
    (a, b) => a * b,
    (a, b) => a.mul(complexOf(b))
  ),
  divide: binary(
    (a, b) => a / b,
    (a, b) => a.div(complexOf(b))
  ),
  pow: binary(powReal, (a, b) => a.pow(b)),
  mod: realOnly('mod', (a, b) => a % b),
  unaryMinus: unary(
    (a) => -a,
    (a) => a.neg()
  ),
  unaryPlus: (a: Operand): Operand => (isComplex(a) ? a : +a),
  sin: unary(Math.sin, (z) => z.sin()),
  cos: unary(Math.cos, (z) => z.cos()),
  tan: unary(Math.tan, (z) => z.tan()),
  sqrt: unary(
    (a) => (a < 0 ? complexOf(a).sqrt() : Math.sqrt(a)),
    (z) => z.sqrt()
  ),
  cbrt: unary(Math.cbrt, (z) => z.cbrt()),
  nthRoot: realOnly('nthRoot', nthRoot),
  abs: unary(Math.abs, (z) => z.abs()),
  exp: unary(Math.exp, (z) => z.exp()),
  log: unary(
    (a) => (a < 0 ? complexOf(a).log() : Math.log(a)),
    (z) => z.log()
  ),
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  i: I,
  Infinity: Infinity,
  NaN: NaN,
  true: true,
  false: false,
};

let boundMathScope: Record<string, unknown> | undefined;

/**
 * The shared default math scope: a copy of `defaultMathScope` with the unsafe
 * names removed, plus the callback transforms. It is built once, on first use.
 * Every default factory that needs a math scope gets this same object.
 */
export function getDefaultMathScope(): Record<string, unknown> {
  if (boundMathScope !== undefined) return boundMathScope;
  const scope: Record<string, unknown> = { ...defaultMathScope };
  // Parser dependencies stay out of this object: it is mathWithTransform
  // (node.compile / map callbacks) and the namespace createEvaluate resolves
  // symbols against.
  for (const key of SAFE_SCOPE_OMIT) {
    delete scope[key];
  }
  // Callbacks compile against this same object, so a nested expression cannot
  // see the symbols deleted above. Arrays only: the default scope has no matrix.
  scope.map = createCallbackTransform('map', false);
  scope.filter = createCallbackTransform('filter', true);
  boundMathScope = scope;
  return scope;
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
