/**
 * mathjs 15.3.0 evaluates parsed AST nodes via factory `node._compile(math, argNames)`,
 * not the standalone tree-walking compiler in `expression/src/compiler/compile.ts`.
 * Symbol resolution there uses `name in math` + `getSafeProperty`, so forbidden names
 * like bare `constructor` throw "No access to property" instead of "Undefined symbol"
 * (#1777).
 *
 * `node.compile()` binds the parse-time `parseScope`, which is a subset of the live
 * instance namespace. Compat compiles against `mathWithTransform` so `reviver`, `parse`,
 * and imported names match mathjs.
 */

import type { CompiledExpression, MathNode } from '@danielsimonjr/mathts-expression';
import { keywords } from '@danielsimonjr/mathts-expression';
import type { PhysicsEvaluateOptions } from '@danielsimonjr/mathts-functions';
import { createMap } from '@danielsimonjr/mathts-core/internal';
import { guardMathjsObjectLiteralKeys } from './mathjs-parse-sandbox.js';
import { remapMathjsSandboxEvaluateError } from './mathjs-sandbox-errors.js';

type ScopedParse = (expr: string) => MathNode;

type TreeCompile = (expr: string, options?: PhysicsEvaluateOptions) => CompiledExpression;

/** Factory AST node with `_compile` (not on the public MathNode type). */
type FactoryCompileNode = MathNode & {
  isSymbolNode?: boolean;
  name?: string;
  _compile(
    math: Record<string, unknown>,
    argNames: Record<string, boolean>
  ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown;
};

type UnitConstructor = {
  new (value: null, name: string): unknown;
  isValuelessUnit?: (name: string) => boolean;
};

/** Parse/compile entry points wired from {@link wireMathjsInstanceApi}. */
export interface CompatExpressionCompileApi {
  parse: ScopedParse;
  compileTree: TreeCompile;
}

/** mathjs `mathWithTransform` namespace for factory `node._compile` (#1777). */
export interface CompatFactoryCompileContext {
  mathWithTransform: Record<string, unknown>;
  /** `Unit` is excluded from `mathWithTransform` keys but required for valueless units (`chain`, …). */
  unitCtor?: unknown;
  /** Resolves inherited API names (e.g. lazy `besselJ0`) like mathjs `name in math`. */
  instance?: Record<string, unknown>;
}

function resolveInheritedInstanceBinding(
  instance: Record<string, unknown>,
  key: string
): unknown | undefined {
  if (Object.hasOwn(instance, key)) return undefined;
  let proto: unknown = Object.getPrototypeOf(instance);
  while (proto !== null && proto !== Object.prototype) {
    if (Object.hasOwn(proto as object, key)) {
      return (proto as Record<string, unknown>)[key];
    }
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

/** Namespace passed to `node._compile` (mathjs binds the live instance, not parseScope). */
export function compileScopeForFactoryCompile(
  mathWithTransform: Record<string, unknown>,
  unitCtor?: unknown,
  instance?: Record<string, unknown>
): Record<string, unknown> {
  const withUnit =
    unitCtor === undefined
      ? mathWithTransform
      : new Proxy(mathWithTransform, {
          get(target, prop, receiver) {
            if (prop === 'Unit') return unitCtor;
            return Reflect.get(target, prop, receiver);
          },
          has(target, prop) {
            if (prop === 'Unit') return true;
            return Reflect.has(target, prop);
          },
        });
  if (instance === undefined) return withUnit;
  const unitClass = unitCtor as UnitConstructor | undefined;
  return new Proxy(withUnit, {
    has(target, prop) {
      if (typeof prop !== 'string') return Reflect.has(target, prop);
      if (Reflect.has(target, prop)) return true;
      if (unitClass?.isValuelessUnit?.(prop)) return false;
      return resolveInheritedInstanceBinding(instance, prop) !== undefined;
    },
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
      if (typeof prop === 'string') {
        const inherited = resolveInheritedInstanceBinding(instance, prop);
        if (inherited !== undefined) return asMathjsExpressionScopeValue(inherited);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const scopeFnWrapperCache = new WeakMap<(...args: never[]) => unknown, unknown>();
const scopeFnUnwrapMap = new WeakMap<object, unknown>();

/** Unwrap a proxy created by {@link asMathjsExpressionScopeValue} back to its original function. */
export function unwrapMathjsExpressionScopeValue(value: unknown): unknown {
  if (value !== null && (typeof value === 'function' || typeof value === 'object')) {
    return scopeFnUnwrapMap.get(value) ?? value;
  }
  return value;
}

/**
 * mathjs security tests require every `mathWithTransform` function to satisfy
 * `fn.prototype.constructor === fn` without mutating the shared function object.
 */
export function asMathjsExpressionScopeValue(value: unknown): unknown {
  if (typeof value !== 'function') return value;
  const fn = value as ((...args: never[]) => unknown) & {
    prototype?: { constructor?: unknown };
  };
  let ownProto: { constructor?: unknown } | undefined;
  try {
    ownProto = fn.prototype;
  } catch {
    return fn;
  }
  if (ownProto?.constructor === fn) return fn;
  const cached = scopeFnWrapperCache.get(fn);
  if (cached !== undefined) return cached;
  function scopeFn(this: unknown, ...args: never[]): unknown {
    return fn.apply(this, args);
  }
  const proxy = new Proxy(scopeFn, {
    get(target, prop) {
      if (prop === 'prototype') return target.prototype;
      return Reflect.get(fn, prop, fn);
    },
    has(_target, prop) {
      return Reflect.has(fn, prop);
    },
    apply(_target, thisArg, argArray) {
      return Reflect.apply(fn, thisArg, argArray);
    },
    construct(_target, argArray, newTarget) {
      return Reflect.construct(
        fn as unknown as new (...args: unknown[]) => object,
        argArray,
        newTarget
      );
    },
  });
  scopeFn.prototype.constructor = proxy;
  scopeFnWrapperCache.set(fn, proxy);
  scopeFnUnwrapMap.set(proxy, fn);
  return proxy;
}

function validateScope(scope: Map<string, unknown>): void {
  for (const symbol of keywords) {
    if (scope.has(symbol)) {
      throw new Error('Scope contains an illegal symbol, "' + symbol + '" is a reserved keyword');
    }
  }
}

/** Route `node.compile()` through mathjs factory `_compile` (#1777). */
export function wrapMathjsFactoryCompiledNode<T extends MathNode>(
  node: T,
  ctx: CompatFactoryCompileContext,
  sandboxMethods = false
): T {
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (sandboxMethods && prop === 'isTensor') return true;
      if (prop === 'compile') {
        return () => compileParsedFactoryNode(target, ctx);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || prop === 'constructor') return value;
      if (sandboxMethods && (prop === 'map' || prop === 'transform' || prop === 'clone')) {
        return (...args: unknown[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (
            result !== null &&
            typeof result === 'object' &&
            (result as { isNode?: boolean }).isNode === true
          ) {
            return wrapMathjsFactoryCompiledNode(result as MathNode, ctx, true);
          }
          return result;
        };
      }
      return value.bind(target);
    },
  }) as T;
}

/**
 * Wrap an `index(...)` factory for compat expression evaluation so `a.dimension(...)`
 * passes `isSafeMethod` without widening the global `expression/` sandbox (#1777).
 */
export function wrapCompatSandboxIndex(
  indexFn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return function compatSandboxIndex(...args: unknown[]): unknown {
    const result = indexFn(...args);
    if (result === null || typeof result !== 'object') return result;
    return new Proxy(result, {
      get(target, prop, receiver) {
        if (prop === 'isTensor') return true;
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' && prop !== 'constructor' ? value.bind(target) : value;
      },
    });
  };
}

/** Compile a parsed AST with mathjs factory `_compile` (#1777). */
export function compileParsedFactoryNode(
  node: MathNode,
  ctx: CompatFactoryCompileContext
): CompiledExpression {
  const math = compileScopeForFactoryCompile(ctx.mathWithTransform, ctx.unitCtor, ctx.instance);
  const factoryNode = node as FactoryCompileNode;
  const evalFn = factoryNode._compile(math, {});
  const unitCtor = ctx.unitCtor as UnitConstructor | undefined;
  const symbolName =
    factoryNode.isSymbolNode === true && typeof factoryNode.name === 'string'
      ? factoryNode.name
      : undefined;
  const context: unknown = null;
  const args: Record<string, unknown> = {};
  return {
    evaluate(scope?: Record<string, unknown>): unknown {
      const s = createMap(scope) as Map<string, unknown>;
      validateScope(s);
      if (
        symbolName !== undefined &&
        !s.has(symbolName) &&
        !(symbolName in math) &&
        !Object.hasOwn(ctx.mathWithTransform, symbolName) &&
        unitCtor !== undefined &&
        typeof unitCtor.isValuelessUnit === 'function' &&
        unitCtor.isValuelessUnit(symbolName)
      ) {
        return new unitCtor(null, symbolName);
      }
      try {
        return evalFn(s, args, context);
      } catch (error) {
        remapMathjsSandboxEvaluateError(error);
      }
    },
  };
}

/** Evaluate one expression under the mathjs compile path (#1777). */
export function evaluateWithMathjsFactoryCompile(
  api: CompatExpressionCompileApi,
  expr: string,
  scope: Record<string, unknown> | undefined,
  options: PhysicsEvaluateOptions | undefined,
  mathjsPolicy: boolean,
  ctx: CompatFactoryCompileContext
): unknown {
  guardMathjsObjectLiteralKeys(expr);
  if (!mathjsPolicy) {
    return api.compileTree(expr, options).evaluate(scope);
  }
  const node = api.parse(expr);
  try {
    return compileParsedFactoryNode(node, ctx).evaluate(scope);
  } catch (error) {
    remapMathjsSandboxEvaluateError(error);
  }
}

/** Compile one expression under the mathjs compile path (#1777). */
export function compileWithMathjsFactory(
  api: CompatExpressionCompileApi,
  expr: string,
  options: PhysicsEvaluateOptions | undefined,
  mathjsPolicy: boolean,
  ctx: CompatFactoryCompileContext
): CompiledExpression {
  guardMathjsObjectLiteralKeys(expr);
  if (!mathjsPolicy) {
    return api.compileTree(expr, options);
  }
  return compileParsedFactoryNode(api.parse(expr), ctx);
}
