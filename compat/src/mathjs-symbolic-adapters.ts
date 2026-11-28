/**
 * Compat adapters for mathjs 15.3.0 symbolic algebra (#1790).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { factory_mathjsCompat, isNode } from '@danielsimonjr/mathts-functions';
import type { MathJSConfig } from './index.js';
import { stripCompatNodeEvaluatePatches } from './bignumber.js';
import { createMathjsDerivative } from './mathjs-symbolic-algebra/derivative.js';
import { createMathjsResolve } from './mathjs-symbolic-algebra/resolve.js';
import { createMathjsSimplify } from './mathjs-symbolic-algebra/simplify.js';
import { createMathjsSimplifyConstant } from './mathjs-symbolic-algebra/simplifyConstant.js';
import { createMathjsSimplifyCore } from './mathjs-symbolic-algebra/simplifyCore.js';

type SymbolicFn = (...args: unknown[]) => unknown;

type ExpressionNode = {
  isNode: boolean;
  toString: (options?: Record<string, unknown>) => string;
  map?: (fn: (child: unknown) => unknown) => unknown;
};

/** Deep-wrap nodes returned by mathjs symbolic factories for mathjs `toString` parity. */
export function wrapMathjsSymbolicNode(value: unknown): unknown {
  value = stripCompatNodeEvaluatePatches(value);
  if (Array.isArray(value)) {
    return value.map((entry) => wrapMathjsSymbolicNode(entry));
  }
  if (typeof value === 'object' && value !== null && isNode(value)) {
    const node = value as ExpressionNode;
    if (typeof node.map === 'function') {
      node.map((child) => {
        wrapMathjsSymbolicNode(child);
        return child;
      });
    }
    return node;
  }
  return value;
}

function withSymbolicResult(fn: SymbolicFn): SymbolicFn {
  return (...args: unknown[]) => wrapMathjsSymbolicNode(fn(...args)) as unknown;
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

/** Build factory scope for mathjs symbolic algebra ports. */
export function buildMathjsSymbolicAlgebraScope(
  config: Partial<MathJSConfig>
): Record<string, unknown> & {
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
  } as Record<string, unknown>;
  scope.mathWithTransform = scope;
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

/** @returns mathjs-shaped `simplifyCore`. */
export function createCompatSimplifyCore(): SymbolicFn {
  return withSymbolicResult(moduleScope.simplifyCore);
}

/** @returns mathjs-shaped `resolve`. */
export function createCompatResolve(): SymbolicFn {
  return (...args: unknown[]) => stripCompatNodeEvaluatePatches(moduleScope.resolve(...args));
}

/** @returns mathjs-shaped `simplify`. */
export function createCompatSimplify(
  config: Partial<MathJSConfig> = mathFunctions.config()
): SymbolicFn {
  const scoped =
    config === mathFunctions.config()
      ? moduleScope.simplify
      : (buildMathjsSymbolicAlgebraScope(config).simplify as SymbolicFn);
  return (...args: unknown[]) =>
    wrapMathjsSymbolicNode(scoped(...normalizeSimplifyArgs(args, config)));
}

/** @returns mathjs-shaped `derivative`. */
export function createCompatDerivative(): SymbolicFn {
  return withSymbolicResult(moduleScope.derivative);
}

/** Re-export mathjs factory creators for `native-factory-exports`. */
export {
  createMathjsDerivative,
  createMathjsResolve,
  createMathjsSimplify,
  createMathjsSimplifyCore,
};