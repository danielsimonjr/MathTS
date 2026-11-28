/**
 * Compat adapters for mathjs 15.3.0 symbolic algebra (#1790).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { factory_mathjsCompat, isNode } from '@danielsimonjr/mathts-functions';
import type { MathJSConfig } from './index.js';
import { markSymbolicAlgebraNodes } from './bignumber.js';
import { patchParsedTreeForMathjsCompat } from './totex-parity.js';
import { createMathjsDerivative } from './mathjs-symbolic-algebra/derivative.js';
import { createMathjsResolve } from './mathjs-symbolic-algebra/resolve.js';
import { createMathjsSimplify } from './mathjs-symbolic-algebra/simplify.js';
import { createMathjsSimplifyConstant } from './mathjs-symbolic-algebra/simplifyConstant.js';
import { createMathjsSimplifyCore } from './mathjs-symbolic-algebra/simplifyCore.js';

type SymbolicFn = (...args: unknown[]) => unknown;

type UnitLike = { isValuelessUnit: (name: string) => boolean };

/** Context for formatting symbolic algebra nodes like `math.parse`. */
export interface SymbolicAlgebraContext {
  mathScope: Record<string, unknown>;
  Unit: UnitLike;
}

const MATHJS_DERIVATIVE_NODE_TYPES =
  'ConstantNode or FunctionNode or FunctionAssignmentNode or OperatorNode or ParenthesisNode or SymbolNode';

function patchSymbolicTrees(value: unknown, ctx: SymbolicAlgebraContext | undefined): unknown {
  if (ctx === undefined) return value;
  const visit = (entry: unknown): void => {
    if (typeof entry === 'object' && entry !== null && isNode(entry)) {
      patchParsedTreeForMathjsCompat(
        entry as unknown as Parameters<typeof patchParsedTreeForMathjsCompat>[0],
        ctx.mathScope,
        ctx.Unit
      );
      const node = entry as { map?: (fn: (child: unknown) => unknown) => unknown };
      if (typeof node.map === 'function') {
        node.map((child) => {
          visit(child);
          return child;
        });
      }
    }
  };
  if (Array.isArray(value)) {
    for (const entry of value) visit(entry);
    return value;
  }
  visit(value);
  return value;
}

/** Prepare nodes returned by mathjs symbolic factories for mathjs unit tests. */
export function finalizeSymbolicAlgebraResult(
  value: unknown,
  ctx?: SymbolicAlgebraContext
): unknown {
  const marked = markSymbolicAlgebraNodes(value);
  return patchSymbolicTrees(marked, ctx);
}

function copySymbolicSurface(source: SymbolicFn, target: SymbolicFn): SymbolicFn {
  return Object.assign(target, source) as SymbolicFn;
}

function remapDerivativeTypeError(err: unknown): never {
  if (!(err instanceof TypeError)) throw err;
  let message = err.message;
  if (message.includes('function _derivative')) {
    message = message.replace(
      /expected: [^,]+, actual: /,
      `expected: ${MATHJS_DERIVATIVE_NODE_TYPES}, actual: `
    );
  }
  if (message.includes('Too few arguments in function derivative')) {
    message = message.replace(
      'expected: string or SymbolNode, index: 1',
      'expected: string or SymbolNode or boolean, index: 1'
    );
  }
  if (message !== err.message) throw new TypeError(message);
  throw err;
}

function enrichScopeObject(
  scope: Record<string, unknown>,
  config: Partial<MathJSConfig>
): Record<string, unknown> {
  if (config.number !== 'bigint') return scope;
  const next = { ...scope };
  if (!Object.hasOwn(next, 'bigint')) next.bigint = BigInt;
  if (!Object.hasOwn(next, 'BigInt')) next.BigInt = BigInt;
  return next;
}

function normalizeSimplifyArgs(args: unknown[], config: Partial<MathJSConfig>): unknown[] {
  const next = [...args];
  for (let i = 0; i < next.length; i++) {
    const arg = next[i];
    if (typeof arg === 'object' && arg !== null && !isNode(arg) && !Array.isArray(arg)) {
      if (!(arg instanceof Map)) {
        next[i] = enrichScopeObject(arg as Record<string, unknown>, config);
      }
    }
  }
  return next;
}

function installMathjsMixedAdd(scope: Record<string, unknown>): void {
  const baseAdd = scope.add as (...operands: unknown[]) => unknown;
  scope.add = (...operands: unknown[]) => {
    const hasBigint = operands.some((v) => typeof v === 'bigint');
    const hasNumber = operands.some((v) => typeof v === 'number');
    if (hasBigint && hasNumber && operands.length === 2) {
      return Number(operands[0]) + Number(operands[1]);
    }
    return baseAdd(...operands);
  };
}

/** Build factory scope for mathjs symbolic algebra ports. */
export function buildMathjsSymbolicAlgebraScope(config: Partial<MathJSConfig>): Record<
  string,
  unknown
> & {
  simplifyCore: SymbolicFn;
  resolve: SymbolicFn;
  simplify: SymbolicFn;
  derivative: SymbolicFn;
} {
  const scope = {
    ...(mathFunctions as unknown as Record<string, unknown>),
    ...factory_mathjsCompat.constructors,
    typed: factory_mathjsCompat.createCompatTyped(),
    config: () => config,
    mathWithTransform: undefined as unknown,
    fraction: mathFunctions.fraction,
    bignumber: mathFunctions.bignumber,
  } as Record<string, unknown>;
  scope.mathWithTransform = scope;
  installMathjsMixedAdd(scope);
  const baseEqual = scope.equal as (a: unknown, b: unknown) => boolean;
  scope.equal = (a: unknown, b: unknown) => {
    if (a === undefined || b === undefined) return a === b;
    if (typeof a === 'bigint' || typeof b === 'bigint') return a === b;
    return baseEqual(a, b);
  };
  scope.simplifyConstant = createMathjsSimplifyConstant(scope) as SymbolicFn;
  const simplifyCore = createMathjsSimplifyCore(scope) as SymbolicFn;
  scope.simplifyCore = simplifyCore;
  const resolve = createMathjsResolve(scope) as SymbolicFn;
  scope.resolve = resolve;
  const simplify = createMathjsSimplify(scope) as SymbolicFn;
  scope.simplify = simplify;
  const derivative = createMathjsDerivative(scope) as SymbolicFn;
  scope.derivative = derivative;
  return scope as Record<string, unknown> & {
    simplifyCore: SymbolicFn;
    resolve: SymbolicFn;
    simplify: SymbolicFn;
    derivative: SymbolicFn;
  };
}

const moduleScope = buildMathjsSymbolicAlgebraScope(mathFunctions.config());

type SymbolicContextSource = SymbolicAlgebraContext | (() => SymbolicAlgebraContext);

function resolveSymbolicCtx(ctx?: SymbolicContextSource): SymbolicAlgebraContext | undefined {
  if (ctx === undefined) return undefined;
  return typeof ctx === 'function' ? ctx() : ctx;
}

/** Create a compat `simplifyCore` matching mathjs 15.3.0. */
export function createCompatSimplifyCore(ctx?: SymbolicContextSource): SymbolicFn {
  return (...args: unknown[]) =>
    finalizeSymbolicAlgebraResult(moduleScope.simplifyCore(...args), resolveSymbolicCtx(ctx));
}

function matrixChildList(matrixValue: object): unknown[] | undefined {
  const record = matrixValue as { _data?: unknown; toArray?: () => unknown };
  if (Array.isArray(record._data)) {
    return record._data as unknown[];
  }
  const tabular = record.toArray?.();
  if (Array.isArray(tabular) && tabular.every((entry) => !Array.isArray(entry))) {
    return tabular as unknown[];
  }
  return undefined;
}

function reparseResolvedNodes(value: unknown, parseFn: (expr: string) => unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as { isMatrix?: boolean }).isMatrix === true &&
    typeof (value as { map?: (fn: (entry: unknown) => unknown) => unknown }).map === 'function'
  ) {
    return (value as { map: (fn: (entry: unknown) => unknown) => unknown }).map((entry) =>
      reparseResolvedNodes(entry, parseFn)
    );
  }
  if (Array.isArray(value)) {
    return value.map((entry) => reparseResolvedNodes(entry, parseFn));
  }
  if (typeof value === 'string') {
    return parseFn(value);
  }
  if (typeof value === 'object' && value !== null && isNode(value)) {
    return parseFn((value as { toString: () => string }).toString());
  }
  return value;
}

/** Create a compat `resolve` matching mathjs 15.3.0. */
export function createCompatResolve(ctx?: SymbolicContextSource): SymbolicFn {
  return (...args: unknown[]) => {
    const hadScope = args.length > 1 && args[1] != null;
    let result = moduleScope.resolve(...args);
    const ctxResolved = resolveSymbolicCtx(ctx);
    const parseFn = ctxResolved?.mathScope?.parse;
    if (hadScope && typeof parseFn === 'function') {
      result = reparseResolvedNodes(result, parseFn as (expr: string) => unknown);
      const matrixFn = ctxResolved?.mathScope?.matrix;
      if (
        typeof result === 'object' &&
        result !== null &&
        (result as { isMatrix?: boolean }).isMatrix === true &&
        typeof matrixFn === 'function'
      ) {
        const children = matrixChildList(result as object);
        if (children !== undefined) {
          result = (matrixFn as (data: unknown) => unknown)(children);
        }
      }
    }
    return finalizeSymbolicAlgebraResult(result, ctxResolved);
  };
}

/** Create a compat `simplify` matching mathjs 15.3.0. */
export function createCompatSimplify(
  config: Partial<MathJSConfig> = mathFunctions.config(),
  ctx?: SymbolicContextSource
): SymbolicFn {
  const scoped =
    config === mathFunctions.config()
      ? moduleScope.simplify
      : (buildMathjsSymbolicAlgebraScope(config).simplify as SymbolicFn);
  const wrapped = (...args: unknown[]) =>
    finalizeSymbolicAlgebraResult(
      scoped(...normalizeSimplifyArgs(args, config)),
      resolveSymbolicCtx(ctx)
    ) as unknown;
  return copySymbolicSurface(scoped, wrapped);
}

/** Create a compat `derivative` matching mathjs 15.3.0. */
export function createCompatDerivative(ctx?: SymbolicContextSource): SymbolicFn {
  const wrapped = (...args: unknown[]) => {
    try {
      return finalizeSymbolicAlgebraResult(
        moduleScope.derivative(...args),
        resolveSymbolicCtx(ctx)
      );
    } catch (err) {
      remapDerivativeTypeError(err);
    }
  };
  return wrapped;
}

/** Re-export mathjs factory creators for `native-factory-exports`. */
export {
  createMathjsDerivative,
  createMathjsResolve,
  createMathjsSimplify,
  createMathjsSimplifyCore,
};
