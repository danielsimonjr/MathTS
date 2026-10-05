/**
 * Public scalar-expression builder.
 *
 * UPT lowers an `ExprNode` numeric tree onto this API instead of printing a
 * formula and parsing it. `call('ln', x)` and a `transcendental` node whose
 * `fn` is `ln` store MathTS natural `log`. `call('log', x)` and `fn: 'log'`
 * store `log10`. `log10` and `log2` stay themselves.
 *
 * The node returned by {@link ScalarBuilder.call} and {@link ScalarBuilder.from}
 * already carries the lowered MathTS name on `fn`. Passing that node through
 * `from` again keeps natural `log`; it does not treat it as base-10.
 *
 * @packageDocumentation
 */

/** Operators on the scalar numeric path (`+ - * / ^`). */
export type ScalarOperator = '+' | '-' | '*' | '/' | '^';

/**
 * Input names accepted by {@link ScalarBuilder.call} and by a
 * `transcendental` node. `ln` and `log` are in this set; the stored node uses
 * the lowered name from {@link SCALAR_FUNCTION_LOWERING}.
 */
export const SCALAR_FUNCTION_LOWERING = {
  exp: 'exp',
  ln: 'log',
  log: 'log10',
  log2: 'log2',
  log10: 'log10',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  abs: 'abs',
} as const;

/** Names a caller may pass to {@link ScalarBuilder.call}. */
export type ScalarFunctionName = keyof typeof SCALAR_FUNCTION_LOWERING;

/** MathTS function stored on a built call node. */
export type LoweredScalarFn = (typeof SCALAR_FUNCTION_LOWERING)[ScalarFunctionName];

/**
 * Input names, in lowering-table order. Present so a consumer can see the
 * scalar set without parsing a formula.
 */
export const SCALAR_FUNCTIONS: readonly ScalarFunctionName[] = [
  'exp',
  'ln',
  'log',
  'log2',
  'log10',
  'sin',
  'cos',
  'tan',
  'sinh',
  'cosh',
  'tanh',
  'abs',
] as const;

const LOWERED_FUNCTIONS: ReadonlySet<string> = new Set(Object.values(SCALAR_FUNCTION_LOWERING));

/** A scalar node. Call `fn` is the lowered MathTS name. */
export type ScalarNode =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'symbol'; readonly name: string }
  | { readonly kind: 'op'; readonly op: ScalarOperator; readonly args: readonly ScalarNode[] }
  | { readonly kind: 'call'; readonly fn: LoweredScalarFn; readonly arg: ScalarNode };

/** Builds {@link ScalarNode} values. Each call returns a new builder. */
export interface ScalarBuilder {
  /** A numeric leaf. `value` must be a number (finite or not). */
  number(value: number): ScalarNode;
  /** A named leaf. Resolution of the name happens at evaluation. */
  symbol(name: string): ScalarNode;
  /**
   * An operator node. `^` requires exactly two arguments. `+`, `-`, `*`, and
   * `/` may be empty or n-ary; evaluation folds them left to right.
   */
  op(op: ScalarOperator, args: readonly ScalarNode[]): ScalarNode;
  /**
   * A unary call. `ln` is stored as `log` (natural). `log` is stored as
   * `log10`.
   */
  call(fn: ScalarFunctionName, arg: ScalarNode): ScalarNode;
  /**
   * Normalize a typed tree. Accepts builder nodes and the scalar arms
   * `symbol`, `op`, `transcendental`, and `abs`. A string is rejected.
   */
  from(node: unknown): ScalarNode;
}

/** A node or name the builder cannot represent. */
export class ScalarBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScalarBuildError';
  }
}

const OPERATORS: ReadonlySet<string> = new Set(['+', '-', '*', '/', '^']);

function isOperator(op: string): op is ScalarOperator {
  return OPERATORS.has(op);
}

function isScalarFunctionName(fn: string): fn is ScalarFunctionName {
  return Object.prototype.hasOwnProperty.call(SCALAR_FUNCTION_LOWERING, fn);
}

function isLoweredScalarFn(fn: string): fn is LoweredScalarFn {
  return LOWERED_FUNCTIONS.has(fn);
}

function isCanonicalNode(value: unknown): value is ScalarNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'number' || kind === 'symbol' || kind === 'op' || kind === 'call';
}

function readRecord(node: unknown): Record<string, unknown> {
  if (typeof node === 'string') {
    throw new ScalarBuildError(
      'scalar builder reads a typed node. A formula string is not accepted.'
    );
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    throw new ScalarBuildError('scalar builder reads a typed node');
  }
  return node as Record<string, unknown>;
}

/**
 * A builder of scalar nodes. Safe to call more than once; builders share no
 * mutable state.
 */
export function createScalarBuilder(): ScalarBuilder {
  function number(value: unknown): ScalarNode {
    if (typeof value !== 'number') {
      throw new ScalarBuildError('scalar number node requires a number value');
    }
    return { kind: 'number', value };
  }

  function symbol(name: unknown): ScalarNode {
    if (typeof name !== 'string') {
      throw new ScalarBuildError('scalar symbol node requires a string name');
    }
    return { kind: 'symbol', name };
  }

  function call(fn: ScalarFunctionName, arg: ScalarNode): ScalarNode {
    if (!isScalarFunctionName(fn)) {
      throw new ScalarBuildError(`unknown scalar function '${String(fn)}'`);
    }
    if (!isCanonicalNode(arg)) {
      throw new ScalarBuildError('scalar call argument must be a scalar node');
    }
    return { kind: 'call', fn: SCALAR_FUNCTION_LOWERING[fn], arg };
  }

  function op(operator: ScalarOperator, args: readonly ScalarNode[]): ScalarNode {
    if (!isOperator(operator)) {
      throw new ScalarBuildError(`unknown scalar operator '${String(operator)}'`);
    }
    if (!Array.isArray(args)) {
      throw new ScalarBuildError('scalar operator args must be an array of scalar nodes');
    }
    const copied: ScalarNode[] = [];
    for (const arg of args) {
      if (!isCanonicalNode(arg)) {
        throw new ScalarBuildError('scalar operator argument must be a scalar node');
      }
      copied.push(arg);
    }
    if (operator === '^' && copied.length !== 2) {
      throw new ScalarBuildError(`'^' needs exactly 2 args, got ${copied.length}`);
    }
    return { kind: 'op', op: operator, args: copied };
  }

  function from(node: unknown): ScalarNode {
    const record = readRecord(node);
    const kind = record.kind;
    if (typeof kind !== 'string') {
      throw new ScalarBuildError('scalar node is missing a string kind');
    }
    switch (kind) {
      case 'number':
        return number(record.value);
      case 'symbol':
        return symbol(record.name);
      case 'op': {
        const operator = record.op;
        if (typeof operator !== 'string' || !isOperator(operator)) {
          throw new ScalarBuildError(`unknown scalar operator '${String(operator)}'`);
        }
        const args = record.args;
        if (!Array.isArray(args)) {
          throw new ScalarBuildError('scalar operator node is missing args');
        }
        return op(
          operator,
          args.map((arg) => from(arg))
        );
      }
      case 'call': {
        const fn = record.fn;
        if (typeof fn !== 'string' || !isLoweredScalarFn(fn)) {
          throw new ScalarBuildError(
            `scalar call '${String(fn)}' must already use a lowered MathTS name`
          );
        }
        return { kind: 'call', fn, arg: from(record.arg) };
      }
      case 'transcendental': {
        const fn = record.fn;
        if (typeof fn !== 'string' || !isScalarFunctionName(fn)) {
          throw new ScalarBuildError(`unknown scalar function '${String(fn)}'`);
        }
        return call(fn, from(record.arg));
      }
      case 'abs':
        return call('abs', from(record.arg));
      default:
        throw new ScalarBuildError(
          `scalar builder: node kind '${kind}' is out of scope (symbol, op, transcendental, abs)`
        );
    }
  }

  return { number, symbol, op, call, from };
}
