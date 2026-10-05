/**
 * Evaluate a scalar node with MathTS numeric functions.
 *
 * {@link scalar} is a {@link createScalarBuilder} instance. {@link evaluateScalar}
 * normalizes a typed tree (builder nodes, or `symbol` / `op` / `transcendental`
 * / `abs`) and evaluates it. A formula string is rejected.
 *
 * Symbol lookup is the caller scope, then a decimal literal spelling of the
 * name (`'2'`, `'-1'`, `'1e-3'`). Names such as `pi`, `e`, `c`, and `6pi` are
 * unresolved unless the scope supplies them.
 *
 * `+ - * /` fold left to right. An empty `*` or `/` is 1; an empty `+` or `-`
 * is 0. A single-argument `+ - * /` returns that argument. `^` requires two
 * arguments and calls MathTS `pow`. One-argument `-` does not negate; a
 * unary minus is `(-1) * x`.
 *
 * A non-finite operator or call result throws {@link ScalarEvalError}. A bare
 * symbol or number is returned as stored, including a non-finite value.
 *
 * @packageDocumentation
 */

import {
  ScalarBuildError,
  createScalarBuilder,
  type LoweredScalarFn,
  type ScalarNode,
  type ScalarOperator,
} from '@danielsimonjr/mathts-expression';
import {
  abs,
  add,
  cosh,
  divide,
  exp,
  log,
  log10,
  log2,
  multiply,
  pow,
  sinh,
  subtract,
  tanh,
} from './typed/arithmetic.js';
import { cos, sin, tan } from './typed/trigonometry.js';

/** Scope for {@link evaluateScalar}. Caller bindings win over literal names. */
export type ScalarScope = Readonly<Record<string, number>>;

/** The shared scalar builder. `ln` lowers to natural `log`; `log` lowers to `log10`. */
export const scalar = createScalarBuilder();

/** A scalar node could not be evaluated. */
export class ScalarEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScalarEvalError';
  }
}

const UNARY: Record<LoweredScalarFn, (value: number) => unknown> = {
  exp,
  log,
  log10,
  log2,
  sin,
  cos,
  tan,
  sinh,
  cosh,
  tanh,
  abs,
};

/** Decimal literal spellings. Hex, blank, and `Infinity` are not literals. */
const NUMERIC_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScalarEvalError(
      `evaluateScalar: '${label}' produced a non-finite value (${String(value)}).`
    );
  }
  return value;
}

function resolveSymbol(name: string, scope: ScalarScope): number {
  if (Object.prototype.hasOwnProperty.call(scope, name)) {
    const value = scope[name];
    if (typeof value !== 'number') {
      throw new ScalarEvalError(`evaluateScalar: scope['${name}'] is not a number.`);
    }
    return value;
  }
  if (NUMERIC_LITERAL.test(name)) {
    const literal = Number(name);
    if (Number.isFinite(literal)) return literal;
  }
  throw new ScalarEvalError(
    `evaluateScalar: symbol '${name}' has no value (not in scope, not a numeric literal).`
  );
}

function combine(op: Exclude<ScalarOperator, '^'>, left: number, right: number): unknown {
  switch (op) {
    case '+':
      return add(left, right);
    case '-':
      return subtract(left, right);
    case '*':
      return multiply(left, right);
    case '/':
      return divide(left, right);
  }
}

function evalOp(op: ScalarOperator, args: readonly ScalarNode[], scope: ScalarScope): number {
  if (op === '^') {
    if (args.length !== 2) {
      throw new ScalarEvalError(`evaluateScalar: '^' needs exactly 2 args, got ${args.length}.`);
    }
    const base = evalNode(args[0], scope);
    const exponent = evalNode(args[1], scope);
    return requireFinite(pow(base, exponent), '^');
  }
  if (args.length === 0) return op === '*' || op === '/' ? 1 : 0;
  let acc = evalNode(args[0], scope);
  for (let i = 1; i < args.length; i++) {
    const right = evalNode(args[i], scope);
    acc = requireFinite(combine(op, acc, right), op);
  }
  return requireFinite(acc, op);
}

function evalCall(fn: LoweredScalarFn, arg: number): number {
  const impl = UNARY[fn];
  if (impl === undefined) {
    throw new ScalarEvalError(`evaluateScalar: unknown scalar function '${String(fn)}'.`);
  }
  return requireFinite(impl(arg), fn);
}

function evalNode(node: ScalarNode, scope: ScalarScope): number {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'symbol':
      return resolveSymbol(node.name, scope);
    case 'op':
      return evalOp(node.op, node.args, scope);
    case 'call':
      return evalCall(node.fn, evalNode(node.arg, scope));
  }
}

function normalizeScope(scope: ScalarScope): ScalarScope {
  if (scope === null || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new ScalarEvalError('evaluateScalar: scope must be an object of numbers.');
  }
  return scope;
}

/**
 * Evaluate `node` with MathTS scalar functions.
 *
 * `node` may be a builder node or a typed `symbol` / `op` / `transcendental` /
 * `abs` tree. `scalar.from` normalizes it first.
 */
export function evaluateScalar(node: unknown, scope: ScalarScope = {}): number {
  const bound = normalizeScope(scope);
  let canonical: ScalarNode;
  try {
    canonical = scalar.from(node);
  } catch (err) {
    if (err instanceof ScalarBuildError) throw new ScalarEvalError(err.message);
    throw err;
  }
  return evalNode(canonical, bound);
}
