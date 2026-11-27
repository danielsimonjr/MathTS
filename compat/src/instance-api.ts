import {
  BigNumber as CompatBigNumber,
  compatDecimalResult,
  type CompatDecimalBigNumberCtor,
} from './bignumber.js';
import { wrapParseNodeForCompatToString } from './fraction-format-parity.js';
/**
 * mathjs instance methods on `create(all)`: import, typed, compile, and
 * expression scope wired for per-instance evaluate.
 */

import type { mathTyped } from '@danielsimonjr/mathts-core';
import { deepMap, isMatrix } from '@danielsimonjr/mathts-core/internal';
import { isCompatFactory } from './create-factory-validation.js';
import { createCompatParserApi, installParserHasInstance } from './compat-parser-api.js';
import { newOperatorGuard } from './constructors-without-new.js';
import { createHelpClass } from '@danielsimonjr/mathts-expression';
import {
  createInstanceEvaluator,
  factory_mathjsCompat,
  EVALUATE_SCOPE_OMIT,
  parser as functionsParser,
  runWithConfig,
  type BridgeMatrix,
  type PhysicsEvaluateOptions,
} from '@danielsimonjr/mathts-functions';
import { createCompatHelpEvaluate } from './help-evaluate.js';
import { createCompatTypedHelp } from './compat-help.js';
import { importFactory, type ImportOptions } from '@danielsimonjr/mathts-functions';
import type { MathJSConfig } from './index.js';
import { attachParserJsonMethods, patchParserFunctionExpr } from './compat-parser-json.js';
import { compatReplacer, compatReviver } from './serialization.js';
import { COMPAT_INTERNAL_NAMES } from './internal-names.generated.js';
const INTERNAL_NAMES: ReadonlySet<string> = new Set<string>(COMPAT_INTERNAL_NAMES);
import {
  createMathjsExpressionBindings,
  type CompatEvaluatorEvaluate,
  type CompatExpressionApi,
} from './mathjs-expression-bindings.js';
import { wrapBlockArrayAsResultSet } from './g12-mathjs-parity.js';
import { wrapCompatUnitConstructor } from './mathjs-unit.js';
import { wrapFactoryCreator, type CompatFactory } from './factory-mathjs-errors.js';
import { patchParseForMathjsToTex } from './totex-parity.js';
import {
  buildExpressionTransforms,
  mathWithTransformValue,
  MATH_WITH_TRANSFORM_EXCLUDED,
} from './g13-transforms.js';

/** Compat instance evaluate options: adds `{ safe: true }` mathjs opt-in (#1549). */
export type CompatEvaluateOptions = PhysicsEvaluateOptions & { safe?: boolean };

type MathNamespace = Parameters<typeof importFactory>[2];
type ImportableFactories = Parameters<typeof importFactory>[3];

/** Expression overlay updated by `math.import` and used by instance evaluate. */
export interface CompatExpressionLayers {
  transform: Record<string, unknown>;
  mathWithTransform: Record<string, unknown>;
}

type Emitter = ReturnType<typeof factory_mathjsCompat.attachEmitter>;
type InstanceEvaluator = ReturnType<typeof createInstanceEvaluator>;
type CompiledExpression = ReturnType<InstanceEvaluator['compile']>;
type ExpressionScope = Parameters<CompiledExpression['evaluate']>[0];
type ExpressionArray = readonly (string | ExpressionArray)[];
type CompiledArray = (CompiledExpression | CompiledArray)[];

interface CompatCompile {
  (expression: string, options?: PhysicsEvaluateOptions): CompiledExpression;
  (expression: readonly string[], options?: PhysicsEvaluateOptions): CompiledExpression[];
  (expression: ExpressionArray, options?: PhysicsEvaluateOptions): CompiledArray;
  (expression: BridgeMatrix, options?: PhysicsEvaluateOptions): BridgeMatrix;
}

interface CompatEvaluate {
  (expression: string, scope?: ExpressionScope, options?: PhysicsEvaluateOptions): unknown;
  (
    expression: ExpressionArray,
    scope?: ExpressionScope,
    options?: PhysicsEvaluateOptions
  ): unknown[];
  (
    expression: BridgeMatrix,
    scope?: ExpressionScope,
    options?: PhysicsEvaluateOptions
  ): BridgeMatrix;
}

/** mathjs batches string arrays with one shared map when scope is omitted (#1776). */
function patchBatchEvaluateScope(
  evaluateFn: InstanceEvaluator['evaluate']
): InstanceEvaluator['evaluate'] {
  const run = evaluateFn as (
    exprOrExprs: string | string[],
    scope?: ExpressionScope,
    options?: PhysicsEvaluateOptions
  ) => unknown;
  return ((
    exprOrExprs: string | string[],
    scope?: ExpressionScope,
    options?: PhysicsEvaluateOptions
  ) => {
    if (
      Array.isArray(exprOrExprs) &&
      exprOrExprs.length > 0 &&
      exprOrExprs.every((entry) => typeof entry === 'string')
    ) {
      const shared = scope === undefined ? {} : scope;
      return run(exprOrExprs, shared, options);
    }
    return run(exprOrExprs, scope, options);
  }) as InstanceEvaluator['evaluate'];
}

function mapExpressions(expression: unknown, operation: (expression: string) => unknown): unknown {
  function run(value: unknown): unknown {
    if (typeof value !== 'string') throw new TypeError('Expression must be a string');
    return operation(value);
  }

  if (Array.isArray(expression)) return deepMap(expression as unknown[], run);
  if (isMatrix(expression)) return (expression as unknown as BridgeMatrix).map(run);
  return run(expression);
}

/** mathjs instance API attached by {@link wireMathjsInstanceApi}. */
export interface WiredCompatInstance {
  Parser: new (options?: PhysicsEvaluateOptions) => ReturnType<typeof functionsParser>;
  on: Emitter['on'];
  off: Emitter['off'];
  once: Emitter['once'];
  import: (functions: unknown, options?: ImportOptions) => void;
  typed: typeof mathTyped & { isTypedFunction: (value: unknown) => boolean };
  compile: CompatCompile;
  evaluate: CompatEvaluate;
  reviver: typeof compatReviver;
  replacer: typeof compatReplacer;
  expression: CompatExpressionLayers;
}

/**
 * Instances built by {@link wireMathjsInstanceApi}. A WeakSet keeps the brand off
 * the instance, so its property layout (and V8 fast-properties mode) is unchanged.
 */
const wiredInstances = new WeakSet<object>();

/**
 * Registry brand for instances of another bundled copy of compat (#1033), which
 * {@link wiredInstances} cannot see. It sits on the instance's own first prototype
 * level, or on the instance when it has no level (`create({})`).
 */
const INSTANCE_BRAND = Symbol.for('mathts.compat.instance');

/** True when `value` is a compat instance built by `create` / `wireMathjsInstanceApi`. */
export function isCompatMathInstance(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  return isInstance(value as object);
}

function isInstance(value: object): boolean {
  if (wiredInstances.has(value)) return true;
  const proto: unknown = Object.getPrototypeOf(value);
  const holder = proto !== null && proto !== Object.prototype ? proto : value;
  return Object.prototype.hasOwnProperty.call(holder, INSTANCE_BRAND);
}

/**
 * True when `value` is, or holds at any depth, a compat instance. Reads data
 * properties only, so no user getter runs.
 */
function containsInstance(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (isInstance(value)) return true;
  if (seen.has(value)) return false;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  for (const key of Object.keys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc !== undefined && 'value' in desc && containsInstance(desc.value, seen)) return true;
  }
  return false;
}

function scrubDenylist(scope: Record<string, unknown>): void {
  for (const key of EVALUATE_SCOPE_OMIT) {
    delete scope[key];
  }
}

/** mathjs defers evaluator rebuild until plain values are imported; lazy factories stay unread (#1575 G20 D5). */
function importRequiresEvaluatorRebind(functions: unknown): boolean {
  if (functions === null || typeof functions !== 'object') return false;
  const queue: unknown[] = Array.isArray(functions) ? [...functions] : [functions];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === null || typeof current !== 'object') {
      if (!isCompatFactory(current)) return true;
      continue;
    }
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const key of Object.keys(current)) {
      const desc = Object.getOwnPropertyDescriptor(current, key);
      if (desc === undefined) continue;
      if ('value' in desc) {
        const value = desc.value;
        if (value !== null && typeof value === 'object' && !isCompatFactory(value)) {
          queue.push(value);
        } else if (!isCompatFactory(value)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Attach mathjs `import` / `typed` / `compile`, rebind evaluate to merged import
 * scope, and keep sandbox denylist intact.
 *
 * @param instance - The compat instance.
 * @param currentConfig - The live config object of the instance.
 * @param bindParser - When `true`, `instance.parser` becomes a parser that evaluates
 *   with the instance evaluator. Default: `false`.
 * @param bindParse - Whether parsed nodes should evaluate in the instance scope.
 * @param constants - Live reads of the instance's configured expression bindings.
 * @param defaultRandom - Random functions supplied by the built-in namespace.
 */
export function wireMathjsInstanceApi(
  instance: Record<string, unknown>,
  currentConfig: MathJSConfig,
  bindParser: boolean,
  bindParse: boolean,
  constants: Record<string, () => unknown> = {},
  defaultRandom: ReadonlySet<string> = new Set()
): WiredCompatInstance {
  wiredInstances.add(instance);
  const brandHolder: object = Object.getPrototypeOf(instance) ?? instance;
  Object.defineProperty(brandHolder === Object.prototype ? instance : brandHolder, INSTANCE_BRAND, {
    value: true,
  });
  const expressionLayers: CompatExpressionLayers = {
    transform: {},
    // mathjs 15.3.0: every block evaluates to a ResultSet (#1556) — compat only.
    mathWithTransform: {
      compatBlockResultSet: true,
    },
  };

  const instanceTyped = factory_mathjsCompat.createCompatTyped();
  const instanceBigNumber =
    (instance.BigNumber as typeof CompatBigNumber | undefined) ?? CompatBigNumber;
  instanceTyped.addConversion(
    {
      from: 'bigint',
      to: 'BigNumber',
      convert: (x: unknown) => new instanceBigNumber((x as bigint).toString()),
    },
    { override: true }
  );

  const mathNs = instance as MathNamespace;
  mathNs.typed = instanceTyped;
  if (typeof instance.factory === 'function') {
    instance.factory = wrapFactoryCreator(
      instance.factory as (...args: unknown[]) => CompatFactory
    );
  }
  mathNs.expression = expressionLayers;
  // G13 (#1572): the 26 expression-language transforms, built against the
  // instance, and `mathWithTransform` = the instance's function namespace with
  // those 26 replaced by their transforms (the mathjs layout).
  const transforms = buildExpressionTransforms(mathNs as Record<string, unknown>);
  expressionLayers.transform = transforms;
  const emitter = factory_mathjsCompat.attachEmitter({});
  mathNs.emit = emitter.emit;
  instance.on = emitter.on;
  instance.off = emitter.off;
  instance.once = emitter.once;

  if (defaultRandom.size > 0) {
    const factories = factory_mathjsCompat.createCompatRandomSources(
      currentConfig as Parameters<typeof factory_mathjsCompat.createCompatRandomSources>[0],
      (event: string, callback: (current: MathJSConfig, previous: MathJSConfig) => void) =>
        emitter.on(event, (...args) => {
          callback(...(args as Parameters<typeof callback>));
        })
    );
    for (const [name, build] of Object.entries(factories)) {
      if (!defaultRandom.has(name)) continue;
      instance[name] = build();
      constants[name] = () => instance[name];
    }
  }

  const UnitCtor = instance.Unit as Parameters<typeof wrapCompatUnitConstructor>[0] | undefined;
  let wrappedUnit: unknown;
  if (typeof UnitCtor === 'function' && typeof UnitCtor.isValuelessUnit === 'function') {
    const mathjsUnit = wrapCompatUnitConstructor(UnitCtor);
    mathNs.Unit = mathjsUnit;
    wrappedUnit = mathjsUnit;
  }

  // G13 (#1572): `mathWithTransform` mirrors mathjs — every instance function and
  // constant, with the 26 transform names holding their transform versions
  // instead of the plain functions. The entries are live getters over the
  // instance, so config-dependent constants (`pi`, the unit constants, …) and
  // lazy compat wrappers stay live and are not materialised eagerly. The
  // evaluator keeps its own scope (see `buildEvaluatorScope`): the module math
  // scope of `createInstanceEvaluator` already resolves the built-in functions,
  // and statically flattening every instance value into it would override the
  // richer typed signatures the expression language relies on.
  const mwt = expressionLayers.mathWithTransform;
  mwt.compatBlockResultSet = true;
  const wholesaleGetters = new Map<string, () => unknown>();
  for (const key of Object.keys(instance)) {
    if (MATH_WITH_TRANSFORM_EXCLUDED.has(key)) continue;
    if (INTERNAL_NAMES.has(key)) continue;
    const read =
      transforms[key] !== undefined
        ? () => mathWithTransformValue(transforms, key)
        : () => instance[key];
    wholesaleGetters.set(key, read);
    Object.defineProperty(mwt, key, {
      enumerable: true,
      configurable: true,
      get: read,
      // `import` and the transform bookkeeping assign and delete these entries.
      set(value: unknown) {
        Object.defineProperty(mwt, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      },
    });
  }
  const importedFactories: ImportableFactories = {};
  const noopLoad = (): unknown => undefined;
  const internalImport = importFactory(
    instanceTyped as never,
    noopLoad as never,
    mathNs,
    importedFactories
  );

  let evaluator: InstanceEvaluator;
  const expressionApi: CompatExpressionApi = {
    evaluate() {
      throw new Error('compat expression API not wired yet');
    },
    compile() {
      throw new Error('compat expression API not wired yet');
    },
    parser() {
      throw new Error('compat expression API not wired yet');
    },
  };
  const evaluatorEvaluateRef: { current?: InstanceEvaluator['evaluate'] } = {};
  const mathjsExpressionBindings = createMathjsExpressionBindings(
    () => expressionApi,
    () => expressionLayers.mathWithTransform,
    () => {
      const run = evaluatorEvaluateRef.current;
      if (run === undefined) {
        throw new Error('compat evaluator is not wired yet');
      }
      return run as unknown as CompatEvaluatorEvaluate;
    },
    () => instance.createUnit as (...args: unknown[]) => unknown
  );
  const runBound = <T extends (...args: never[]) => unknown>(fn: T): T =>
    ((...args: never[]) => runWithConfig(currentConfig, () => fn(...args))) as T;

  /** Compat shims that must win over the functions singleton in `evaluate` (#1589). */
  const EVALUATE_SCOPE_OVERRIDES = [
    'zpk2tf',
    'freqz',
    'format',
    // G05 (#1553, #1584): the mathjs 15.3.0 schur/sylvester/lyap/solveODE adapters.
    'schur',
    'sylvester',
    'lyap',
    'solveODE',
  ] as const;

  function syncEvaluateScopeOverrides(): void {
    for (const name of EVALUATE_SCOPE_OVERRIDES) {
      const fn = instance[name];
      if (typeof fn === 'function') {
        expressionLayers.mathWithTransform[name] = fn;
      } else {
        delete expressionLayers.mathWithTransform[name];
      }
    }
  }

  /**
   * Compat runs the mathjs policy by default (#1549): no AST validator, no
   * result sanitizer, and the mathjs scope. `{ safe: true }` opts back into
   * the typed-API hardening for that call.
   */
  function policyOptions(options?: CompatEvaluateOptions): PhysicsEvaluateOptions | undefined {
    if (options?.safe === true && options?.unsafe === true) {
      throw new TypeError('Pass either `{ safe: true }` or `{ unsafe: true }`, not both');
    }
    if (options?.safe === true) {
      const { safe: _safe, ...rest } = options;
      return rest;
    }
    return { ...options, unsafe: true };
  }

  function patchEvaluatorToTex(bound: InstanceEvaluator): void {
    const unit = instance.Unit as { isValuelessUnit?: (name: string) => boolean } | undefined;
    if (typeof unit?.isValuelessUnit !== 'function') return;
    const originalParse = bound.parse;
    const patched = patchParseForMathjsToTex(
      originalParse.bind(bound),
      instance as Record<string, unknown>,
      unit as { isValuelessUnit: (name: string) => boolean }
    );
    // Copy `isValidLatinOrGreek` / other parse statics from the *scoped* parser
    // (mathjsSyntax). Assigning `functionsParse` overwrote those with the typed
    // namespace parser, so `compat.parse.isValidLatinOrGreek('×')` became false.
    Object.assign(patched, originalParse);
    bound.parse = patched as typeof bound.parse;
  }

  function rebindInstanceHelp(): void {
    const instEvaluate = instance.evaluate as WiredCompatInstance['evaluate'];
    const helpEvaluate = createCompatHelpEvaluate(
      (expr, scope) => instEvaluate(expr, scope) as unknown,
      () => {
        const cfg = instance.config;
        return typeof cfg === 'function'
          ? ({ ...(cfg as () => Record<string, unknown>)() } as Record<string, unknown>)
          : {};
      }
    );
    type HelpCtor = new (doc: unknown) => unknown;
    const Help = createHelpClass({ evaluate: helpEvaluate }) as unknown as HelpCtor;
    instance.Help = Help;
    instance.help = createCompatTypedHelp(
      instanceTyped as Parameters<typeof createCompatTypedHelp>[0],
      expressionLayers.mathWithTransform,
      Help as Parameters<typeof createCompatTypedHelp>[2]
    );
  }

  /**
   * The scope `createInstanceEvaluator` sees. The public `mathWithTransform`
   * carries the full instance surface as live getters (#1572), but the module
   * math scope already resolves those built-ins with their full typed
   * signatures. Only the compat markers, the wrapped `Unit`, and names that
   * `import` added or overrode (data properties, not the wholesale getters)
   * need to reach the evaluator.
   */
  function buildEvaluatorScope(): Record<string, unknown> {
    const scope: Record<string, unknown> = {
      // mathjs 15.3.0: every block evaluates to a ResultSet (#1556) — compat only.
      compatBlockResultSet: true,
    };
    // Expression `apply` is the one-based transform (`expression.transform.apply`),
    // not the programmatic alias `mapSlices` (`formerly: 'apply'`). The module math
    // scope only overlays the other 25 transforms; mirror mathjs by wiring apply here.
    const applyTransform = expressionLayers.transform.apply;
    if (typeof applyTransform === 'function') {
      scope.apply = applyTransform;
    }
    if (typeof instance.num === 'function') scope.num = instance.num;
    if (typeof instance.den === 'function') scope.den = instance.den;
    if (wrappedUnit !== undefined) scope.Unit = wrappedUnit;
    if (typeof instance.unit === 'function') scope.unit = instance.unit;
    if (typeof instance.createUnit === 'function') scope.createUnit = instance.createUnit;
    if (instance.ResultSet !== undefined) scope.ResultSet = instance.ResultSet;
    for (const key of Object.keys(mwt)) {
      const desc = Object.getOwnPropertyDescriptor(mwt, key);
      if (desc === undefined) continue;
      if (desc.get !== undefined) {
        // A wholesale getter is supplied by the module math scope; a getter that
        // `import` installed later (a lazy factory import) resolves here, like
        // the scope spread did before the G13 split.
        if (wholesaleGetters.get(key) === desc.get) continue;
        scope[key] = desc.get();
      } else if ('value' in desc) {
        scope[key] = desc.value;
      }
    }
    return scope;
  }

  function rebindEvaluator(): InstanceEvaluator {
    scrubDenylist(expressionLayers.mathWithTransform);
    syncEvaluateScopeOverrides();
    const instanceBigNumberCtor = instance.BigNumber as CompatDecimalBigNumberCtor;
    const normalizeDecimal = (value: unknown): unknown =>
      compatDecimalResult(value, instanceBigNumberCtor);
    evaluator = createInstanceEvaluator(
      buildEvaluatorScope(),
      COMPAT_INTERNAL_NAMES,
      true,
      constants,
      true,
      normalizeDecimal,
      mathjsExpressionBindings
    );
    evaluator.evaluate = patchBatchEvaluateScope(evaluator.evaluate);
    evaluatorEvaluateRef.current = evaluator.evaluate;
    patchEvaluatorToTex(evaluator);
    const ResultSetCtor = factory_mathjsCompat.constructors.ResultSet as new (
      entries?: unknown[]
    ) => unknown;
    instance.evaluate = runBound(
      (expression: unknown, scope?: ExpressionScope, options?: CompatEvaluateOptions) => {
        const opts = policyOptions(options);
        if (
          Array.isArray(expression) &&
          expression.length > 0 &&
          expression.every((entry) => typeof entry === 'string')
        ) {
          const sharedScope = scope === undefined ? {} : scope;
          return normalizeDecimal(evaluator.evaluate(expression as string[], sharedScope, opts));
        }
        return normalizeDecimal(
          mapExpressions(expression, (text) =>
            wrapBlockArrayAsResultSet(evaluator.evaluate(text, scope, opts), text, ResultSetCtor)
          )
        );
      }
    );
    instance.compile = runBound((expression: unknown, options?: CompatEvaluateOptions) =>
      mapExpressions(expression, (text) => {
        const compiled = evaluator.compile(text, policyOptions(options));
        return {
          evaluate: runBound((...ea: unknown[]) =>
            normalizeDecimal((compiled.evaluate as (...a: unknown[]) => unknown)(...ea))
          ),
        };
      })
    );
    instance.compileExpr = instance.compile;
    expressionApi.evaluate = (expr, scope, options) =>
      (instance.evaluate as CompatEvaluate)(expr, scope, options);
    expressionApi.compile = (expr, options) => (instance.compile as CompatCompile)(expr, options);
    expressionApi.parser = (options) => new ParserClass(options);
    rebindInstanceHelp();
    return evaluator;
  }

  function mathImport(functions: unknown, options?: ImportOptions): void {
    if (containsInstance(functions, new Set())) {
      throw new TypeError(
        'import of a math instance is not supported; import its functions (an object of functions or factories) instead'
      );
    }
    internalImport(functions, options);
    scrubDenylist(expressionLayers.mathWithTransform);
    if (importRequiresEvaluatorRebind(functions)) {
      rebindEvaluator();
    }
  }

  // The parser of the functions package evaluates in the module scope. The instance
  // parser keeps its retained scope and evaluates with the current instance evaluator,
  // so it resolves imported names, uses the instance config and hides the internal
  // names (#1216).
  function Parser(
    this: object,
    options?: CompatEvaluateOptions
  ): ReturnType<typeof functionsParser> {
    const made = functionsParser(options);
    const boundEvaluate = instance.evaluate as CompatEvaluate;
    const evaluateSingle = (expr: string): unknown => {
      const result = boundEvaluate(expr, made.scope, options);
      if (typeof expr === 'string') {
        patchParserFunctionExpr(made.scope, expr);
      }
      return result;
    };
    const evaluateParserExpr = (expr: string | string[]) => {
      if (Array.isArray(expr)) {
        return expr.map((entry) => evaluateSingle(entry));
      }
      return evaluateSingle(expr);
    };
    const api = {
      scope: made.scope,
      evaluate: evaluateParserExpr,
      get: made.get.bind(made),
      set: made.set.bind(made),
      remove: made.remove.bind(made),
      clear: made.clear.bind(made),
    };
    return createCompatParserApi(api) as ReturnType<typeof functionsParser>;
  }
  installParserHasInstance(Parser);
  const ParserClass = newOperatorGuard(Parser) as unknown as WiredCompatInstance['Parser'];
  installParserHasInstance(ParserClass);
  instance.Parser = ParserClass;
  attachParserJsonMethods(ParserClass, (options) => new ParserClass(options));
  if (bindParser) {
    const instanceParser: typeof functionsParser = (options) => new ParserClass(options);
    instance.parser = instanceParser;
  }

  instance.import = mathImport;
  instance.typed = instanceTyped;

  const initialEvaluator = rebindEvaluator();
  if (bindParse) {
    instance.parse = new Proxy(initialEvaluator.parse, {
      apply: (_target, receiver, args) => {
        const node = runWithConfig(currentConfig, () =>
          Reflect.apply(evaluator.parse, receiver, args)
        );
        return wrapParseNodeForCompatToString(
          node as { toString(options?: unknown): string },
          currentConfig.number as string | undefined
        );
      },
    });
  }

  return {
    Parser: ParserClass,
    on: emitter.on,
    off: emitter.off,
    once: emitter.once,
    import: mathImport,
    typed: instanceTyped,
    compile: instance.compile as WiredCompatInstance['compile'],
    evaluate: instance.evaluate as WiredCompatInstance['evaluate'],
    reviver: compatReviver,
    replacer: compatReplacer,
    expression: expressionLayers,
  };
}
