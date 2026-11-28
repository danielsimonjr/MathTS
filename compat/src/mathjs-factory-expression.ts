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
import { keywords, Node as ExprNodeBase } from '@danielsimonjr/mathts-expression';
import type { PhysicsEvaluateOptions } from '@danielsimonjr/mathts-functions';
import { createMap } from '@danielsimonjr/mathts-core/internal';
import { preprocessMathjsCompatParseInput } from './mathjs-parse-preprocess.js';
import { guardMathjsObjectLiteralKeys } from './mathjs-parse-sandbox.js';
import { remapMathjsSandboxEvaluateError } from './mathjs-sandbox-errors.js';
import { MATH_WITH_TRANSFORM_EXCLUDED } from './g13-transforms.js';

type ScopedParse = (expr: string) => MathNode;

type TreeCompile = (expr: string, options?: PhysicsEvaluateOptions) => CompiledExpression;

/** Factory AST node with `_compile` (not on the public MathNode type). */
type FactoryCompileNode = MathNode & {
  isSymbolNode?: boolean;
  isAssignmentNode?: boolean;
  name?: string;
  value?: FactoryCompileNode;
  _compile(
    math: Record<string, unknown>,
    argNames: Record<string, boolean>
  ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown;
};

function snapshotAssignmentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return typeof structuredClone === 'function' ? structuredClone(value) : value.slice();
  }
  return value;
}

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
  /** Post-process compiled literal results (Fraction number mode, …). */
  normalizeValue?: (value: unknown) => unknown;
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

const compileScopeCache = new WeakMap<Record<string, unknown>, Record<string, unknown>>();

/** Namespace passed to `node._compile` (mathjs binds the live instance, not parseScope). */
export function compileScopeForFactoryCompile(
  mathWithTransform: Record<string, unknown>,
  unitCtor?: unknown,
  instance?: Record<string, unknown>
): Record<string, unknown> {
  if (instance === undefined) {
    const cached = compileScopeCache.get(mathWithTransform);
    if (cached !== undefined) return cached;
  }
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
  if (instance === undefined) {
    compileScopeCache.set(mathWithTransform, withUnit);
    return withUnit;
  }
  const unitClass = unitCtor as UnitConstructor | undefined;
  const instanceOverrides = new Set(['createUnit', 'unit']);
  const wrapped = new Proxy(withUnit, {
    has(target, prop) {
      if (prop === 'chain' || prop === 'import') return false;
      if (typeof prop !== 'string') return Reflect.has(target, prop);
      if (Reflect.has(target, prop)) return true;
      if (unitClass?.isValuelessUnit?.(prop)) return false;
      return resolveInheritedInstanceBinding(instance, prop) !== undefined;
    },
    get(target, prop, receiver) {
      if (prop === 'chain' || prop === 'import') return undefined;
      if (
        typeof prop === 'string' &&
        instanceOverrides.has(prop) &&
        typeof (instance as Record<string, unknown>)[prop] === 'function'
      ) {
        return asMathjsExpressionScopeValue((instance as Record<string, unknown>)[prop]);
      }
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
      if (typeof prop === 'string') {
        const inherited = resolveInheritedInstanceBinding(instance, prop);
        if (inherited !== undefined) return asMathjsExpressionScopeValue(inherited);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return wrapped;
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
  function scopeFn(this: unknown, a?: unknown, b?: unknown): unknown {
    if (new.target !== undefined) {
      return Reflect.construct(
        fn as unknown as new (...args: unknown[]) => object,
        Array.prototype.slice.call(arguments),
        new.target === scopeFn ? (fn as unknown as new (...args: unknown[]) => object) : new.target
      );
    }
    const argc = arguments.length;
    if (argc === 2) return (fn as (x: unknown, y: unknown) => unknown).call(this, a, b);
    if (argc === 1) return (fn as (x: unknown) => unknown).call(this, a);
    if (argc === 0) return (fn as () => unknown).call(this);
    return fn.apply(this, Array.prototype.slice.call(arguments) as never[]);
  }
  const descriptors = Object.getOwnPropertyDescriptors(fn);
  delete descriptors.prototype;
  Object.defineProperties(scopeFn, descriptors);
  scopeFnWrapperCache.set(fn, scopeFn);
  scopeFnUnwrapMap.set(scopeFn, fn);
  return scopeFn;
}

function validateScope(scope: Map<string, unknown>): void {
  for (const symbol of keywords) {
    if (scope.has(symbol)) {
      throw new Error('Scope contains an illegal symbol, "' + symbol + '" is a reserved keyword');
    }
  }
}

/** Options for {@link wrapMathjsFactoryCompiledNode} / {@link patchFactoryCompiledNodeInPlace}. */
export type WrapFactoryCompiledNodeOptions = {
  /** Expose `isTensor` for sandbox index shapes (#1777). */
  sandboxTensor?: boolean;
  /** Re-wrap child nodes from `map` / `transform` / `clone` (#1786). */
  wrapSubtree?: boolean;
};

const FACTORY_COMPILE_PATCHED = new WeakSet<object>();

function normalizeWrapOptions(
  sandboxMethodsOrOptions: boolean | WrapFactoryCompiledNodeOptions
): WrapFactoryCompiledNodeOptions {
  if (typeof sandboxMethodsOrOptions === 'boolean') {
    return {
      sandboxTensor: sandboxMethodsOrOptions,
      wrapSubtree: sandboxMethodsOrOptions,
    };
  }
  return {
    sandboxTensor: sandboxMethodsOrOptions.sandboxTensor === true,
    wrapSubtree: sandboxMethodsOrOptions.wrapSubtree !== false,
  };
}

/** Route `node.compile()` through mathjs factory `_compile` without breaking `instanceof` (#1786). */
export function wrapMathjsFactoryCompiledNode<T extends MathNode>(
  node: T,
  ctx: CompatFactoryCompileContext,
  sandboxMethodsOrOptions: boolean | WrapFactoryCompiledNodeOptions = false
): T {
  const options = normalizeWrapOptions(sandboxMethodsOrOptions);
  if (FACTORY_COMPILE_PATCHED.has(node as object)) return node;
  FACTORY_COMPILE_PATCHED.add(node as object);

  if (options.sandboxTensor) {
    Object.defineProperty(node, 'isTensor', {
      value: true,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }

  const compileImpl = (): CompiledExpression => compileParsedFactoryNode(node, ctx);
  Object.defineProperty(node, 'compile', {
    value: compileImpl,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(node, 'evaluate', {
    value: (scope?: Record<string, unknown>) => {
      const value = compileImpl().evaluate(scope);
      return ctx.normalizeValue === undefined ? value : ctx.normalizeValue(value);
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });

  const self = node;
  const patchNodeMethod = (method: string, impl: (...args: unknown[]) => unknown): void => {
    Object.defineProperty(node, method, {
      value: impl,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  };

  const bindTreeWalk = (method: string): void => {
    const original = Reflect.get(node, method);
    if (typeof original !== 'function') return;
    patchNodeMethod(method, function walkBinder(this: unknown, ...args: unknown[]) {
      const callback = args[0];
      if (typeof callback === 'function') {
        args[0] = (child: unknown, path: unknown, parent: unknown) =>
          (callback as (n: unknown, p: unknown, par: unknown) => unknown).call(
            undefined,
            child === self ? node : child,
            path,
            parent === null ? parent : parent === self ? node : parent
          );
      }
      return (original as (...a: unknown[]) => unknown).call(this, ...args);
    });
  };

  if (options.wrapSubtree) {
    bindTreeWalk('forEach');
    bindTreeWalk('map');
    bindTreeWalk('filter');

    const maybeWrapChild = (result: unknown): unknown => {
      if (!isFactoryMathNode(result)) return result;
      return wrapMathjsFactoryCompiledNode(result as MathNode, ctx, options);
    };

    for (const method of ['map', 'transform', 'clone'] as const) {
      const original = Reflect.get(node, method);
      if (typeof original !== 'function') continue;
      patchNodeMethod(method, function wrapTreeOp(this: unknown, ...args: unknown[]) {
        return maybeWrapChild((original as (...a: unknown[]) => unknown).call(this, ...args));
      });
    }
  }

  if (options.wrapSubtree) {
    const traverseOrig = Reflect.get(node, 'traverse');
    if (typeof traverseOrig === 'function') {
      patchNodeMethod('traverse', function traverseBinder(this: unknown, ...args: unknown[]) {
        const callback = args[0];
        if (typeof callback === 'function') {
          args[0] = (child: unknown, path: unknown, parent: unknown) => {
            const parentArg = parent === null ? parent : parent === self ? node : parent;
            if (path === null && parent === null) {
              return (callback as (n: unknown, p: unknown, par: unknown) => unknown)(
                this,
                path,
                parentArg
              );
            }
            const nodeArg = child === self ? node : child;
            return (callback as (n: unknown, p: unknown, par: unknown) => unknown)(
              nodeArg,
              path,
              parentArg
            );
          };
        }
        return (traverseOrig as (...a: unknown[]) => unknown).call(this, ...args);
      });
    }
  } else {
    patchNodeMethod('traverse', (...args: unknown[]) =>
      (ExprNodeBase.prototype.traverse as (...a: unknown[]) => unknown).call(node, ...args)
    );
    patchNodeMethod('filter', (...args: unknown[]) =>
      (ExprNodeBase.prototype.filter as (...a: unknown[]) => unknown).call(node, ...args)
    );
  }

  return node;
}

function isFactoryMathNode(value: unknown): value is MathNode {
  return (
    value !== null && typeof value === 'object' && (value as { isNode?: boolean }).isNode === true
  );
}

/** Custom `parse(..., { nodes })` entries must keep their prototype for `instanceof` / `filter`. */
function isStandardFactoryParseNode(node: MathNode): boolean {
  const flags = node as {
    isSymbolNode?: boolean;
    isOperatorNode?: boolean;
    isConstantNode?: boolean;
    isFunctionNode?: boolean;
    isAssignmentNode?: boolean;
    isArrayNode?: boolean;
    isBlockNode?: boolean;
    isConditionalNode?: boolean;
    isAccessorNode?: boolean;
    isIndexNode?: boolean;
    isObjectNode?: boolean;
    isParenthesisNode?: boolean;
    isRangeNode?: boolean;
    isRelationalNode?: boolean;
    isFunctionAssignmentNode?: boolean;
  };
  return (
    flags.isSymbolNode === true ||
    flags.isOperatorNode === true ||
    flags.isConstantNode === true ||
    flags.isFunctionNode === true ||
    flags.isAssignmentNode === true ||
    flags.isArrayNode === true ||
    flags.isBlockNode === true ||
    flags.isConditionalNode === true ||
    flags.isAccessorNode === true ||
    flags.isIndexNode === true ||
    flags.isObjectNode === true ||
    flags.isParenthesisNode === true ||
    flags.isRangeNode === true ||
    flags.isRelationalNode === true ||
    flags.isFunctionAssignmentNode === true
  );
}

/**
 * mathjs binds `runtimeMath` only on the parse root; nested nodes otherwise compile
 * against the module default scope (#1786). Every subtree node routes `compile()`
 * through factory `_compile` with the instance `mathWithTransform`.
 */
export function deepWrapParsedExpressionTree<T extends MathNode>(
  node: T,
  ctx: CompatFactoryCompileContext,
  wrapOptions?: WrapFactoryCompiledNodeOptions
): T {
  const options: WrapFactoryCompiledNodeOptions = {
    sandboxTensor: wrapOptions?.sandboxTensor === true,
    wrapSubtree: wrapOptions?.wrapSubtree !== false,
  };
  if (!isStandardFactoryParseNode(node)) {
    if (typeof (node as { _compile?: unknown })._compile === 'function') {
      wrapMathjsFactoryCompiledNode(node, ctx, { wrapSubtree: false });
    }
    return node;
  }
  const pending: MathNode[] = [node];
  while (pending.length > 0) {
    const current = pending.pop() as MathNode;
    if (!isStandardFactoryParseNode(current)) continue;
    wrapMathjsFactoryCompiledNode(current, ctx, options);
    current.forEach((child) => {
      if (isFactoryMathNode(child)) pending.push(child);
    });
  }
  return node;
}

const EXPR_NODE_CLASS_NAMES = [
  'Node',
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionAssignmentNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'SymbolNode',
] as const;

/** Replace AST constructors on a compat instance so `new ArrayNode().compile()` uses factory `_compile` (#1786). */
export function wireInstanceExprNodeConstructors(
  instance: Record<string, unknown>,
  getCtx: () => CompatFactoryCompileContext,
  wrapOptions?: Omit<WrapFactoryCompiledNodeOptions, 'wrapSubtree'>
): void {
  for (const name of EXPR_NODE_CLASS_NAMES) {
    if (!MATH_WITH_TRANSFORM_EXCLUDED.has(name)) continue;
    const Original = instance[name];
    if (typeof Original !== 'function') continue;
    const originalProto = Original.prototype as object;
    const Wrapped = function ExprNodeCompatCtor(this: object, ...args: unknown[]) {
      if (new.target === undefined) {
        throw new TypeError(`Class constructor ${name} cannot be invoked without 'new'`);
      }
      const node = Reflect.construct(Original as new (...a: unknown[]) => MathNode, args);
      return wrapMathjsFactoryCompiledNode(node, getCtx(), {
        sandboxTensor: wrapOptions?.sandboxTensor,
        wrapSubtree: true,
      });
    };
    Object.setPrototypeOf(Wrapped, Original);
    Wrapped.prototype = originalProto;
    Object.defineProperties(Wrapped, Object.getOwnPropertyDescriptors(Original));
    instance[name] = Wrapped;
  }
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
  let evalFn = factoryNode._compile.call(node, math, {});
  if (
    (factoryNode.isAssignmentNode === true || factoryNode.type === 'AssignmentNode') &&
    factoryNode.value !== undefined
  ) {
    const evalValue = factoryNode.value._compile.call(factoryNode.value, math, {});
    const runAssign = evalFn;
    evalFn = (scope, args, context) => {
      const returnedValue = snapshotAssignmentValue(evalValue(scope, args, context));
      const valueNode = factoryNode.value;
      let savedRhs: unknown;
      let rhsName: string | undefined;
      if (
        valueNode?.isSymbolNode === true &&
        typeof valueNode.name === 'string' &&
        scope.has(valueNode.name)
      ) {
        rhsName = valueNode.name;
        savedRhs = snapshotAssignmentValue(scope.get(rhsName));
      }
      runAssign(scope, args, context);
      if (rhsName !== undefined) {
        scope.set(rhsName, savedRhs);
      }
      return returnedValue;
    };
  }
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
        const value = evalFn(s, args, context);
        return ctx.normalizeValue === undefined ? value : ctx.normalizeValue(value);
      } catch (error) {
        remapMathjsSandboxEvaluateError(error);
      }
    },
  };
}

function compatParseInput(expr: string): string {
  return preprocessMathjsCompatParseInput(expr);
}

/** Evaluate one expression string via factory `node._compile` / compat preprocess (#1777, #1786). */
export function evaluateWithMathjsFactoryCompile(
  api: CompatExpressionCompileApi,
  expr: string,
  scope: Record<string, unknown> | undefined,
  options: PhysicsEvaluateOptions | undefined,
  mathjsPolicy: boolean,
  ctx: CompatFactoryCompileContext
): unknown {
  const input = compatParseInput(expr);
  guardMathjsObjectLiteralKeys(input);
  if (!mathjsPolicy) {
    return api.compileTree(input, options).evaluate(scope);
  }
  const node = api.parse(input);
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
  const input = compatParseInput(expr);
  guardMathjsObjectLiteralKeys(input);
  if (!mathjsPolicy) {
    return api.compileTree(input, options);
  }
  return compileParsedFactoryNode(api.parse(input), ctx);
}
