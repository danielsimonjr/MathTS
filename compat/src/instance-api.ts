import { compatDecimalResult } from './bignumber.js';
import { wrapParseNodeForCompatToString } from './fraction-format-parity.js';
/**
 * mathjs instance methods on `create(all)`: import, typed, compile, and
 * expression scope wired for per-instance evaluate.
 */

import type { mathTyped } from '@danielsimonjr/mathts-core';
import { deepMap, isMatrix } from '@danielsimonjr/mathts-core/internal';
import { createHelpClass } from '@danielsimonjr/mathts-expression';
import {
  createInstanceEvaluator,
  factory_mathjsCompat,
  EVALUATE_SCOPE_OMIT,
  help as nativeHelp,
  parser as functionsParser,
  runWithConfig,
  type BridgeMatrix,
  type PhysicsEvaluateOptions,
} from '@danielsimonjr/mathts-functions';
import { createCompatHelpEvaluate } from './help-evaluate.js';
import { importFactory, type ImportOptions } from '@danielsimonjr/mathts-functions';
import type { MathJSConfig } from './index.js';
import {
  compatReplacer as replacer,
  compatReviver as reviver,
  reviveInstanceValue,
} from './serialization.js';
import { COMPAT_INTERNAL_NAMES } from './internal-names.generated.js';
import { patchParseForMathjsToTex } from './totex-parity.js';
import { wrapBlockArrayAsResultSet } from './g12-mathjs-parity.js';

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
  reviver: typeof reviver;
  replacer: typeof replacer;
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
    mathWithTransform: { num: instance.num, den: instance.den },
  };

  const instanceTyped = factory_mathjsCompat.createCompatTyped();

  if (typeof instance.num !== 'function') delete expressionLayers.mathWithTransform.num;
  if (typeof instance.den !== 'function') delete expressionLayers.mathWithTransform.den;
  const mathNs = instance as MathNamespace;
  mathNs.typed = instanceTyped;
  mathNs.expression = expressionLayers;
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

  const UnitCtor = instance.Unit as { isValuelessUnit: (name: string) => boolean } | undefined;
  if (UnitCtor?.isValuelessUnit) {
    mathNs.Unit = UnitCtor;
    expressionLayers.mathWithTransform.Unit = UnitCtor;
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
  const runBound = <T extends (...args: never[]) => unknown>(fn: T): T =>
    ((...args: never[]) => runWithConfig(currentConfig, () => fn(...args))) as T;

  /** Compat shims that must win over the functions singleton in `evaluate` (#1589). */
  const EVALUATE_SCOPE_OVERRIDES = ['zpk2tf', 'freqz'] as const;

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

  function resolveHelpName(search: unknown): string {
    if (typeof search === 'string') return search;
    const mwt = expressionLayers.mathWithTransform;
    if (typeof search === 'function') {
      const found = Object.keys(mwt).find((key) => mwt[key] === search);
      if (found !== undefined) return found;
      throw new Error(`No documentation found on "${search.name}"`);
    }
    throw new Error(`No documentation found on "${String(search)}"`);
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
    instance.help = (search: unknown) => new Help(nativeHelp(resolveHelpName(search)).doc);
  }

  function rebindEvaluator(): InstanceEvaluator {
    scrubDenylist(expressionLayers.mathWithTransform);
    syncEvaluateScopeOverrides();
    evaluator = createInstanceEvaluator(
      expressionLayers.mathWithTransform,
      COMPAT_INTERNAL_NAMES,
      true,
      constants,
      true,
      compatDecimalResult
    );
    patchEvaluatorToTex(evaluator);
    const ResultSetCtor = factory_mathjsCompat.constructors.ResultSet as new (
      entries?: unknown[]
    ) => unknown;
    instance.evaluate = runBound(
      (expression: unknown, scope?: ExpressionScope, options?: PhysicsEvaluateOptions) =>
        mapExpressions(expression, (text) =>
          wrapBlockArrayAsResultSet(evaluator.evaluate(text, scope, options), text, ResultSetCtor)
        )
    );
    instance.compile = runBound((expression: unknown, options?: PhysicsEvaluateOptions) =>
      mapExpressions(expression, (text) => {
        const compiled = evaluator.compile(text, options);
        return { evaluate: runBound(compiled.evaluate.bind(compiled)) };
      })
    );
    instance.compileExpr = instance.compile;
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
    rebindEvaluator();
  }

  // The parser of the functions package evaluates in the module scope. The instance
  // parser keeps its retained scope and evaluates with the current instance evaluator,
  // so it resolves imported names, uses the instance config and hides the internal
  // names (#1216).
  function Parser(
    this: object,
    options?: PhysicsEvaluateOptions
  ): ReturnType<typeof functionsParser> {
    const made = functionsParser(options);
    made.evaluate = (expr: string): unknown =>
      (instance.evaluate as WiredCompatInstance['evaluate'])(expr, made.scope, options);
    return Object.assign(this, made);
  }
  const ParserClass = Parser as unknown as WiredCompatInstance['Parser'];
  instance.Parser = ParserClass;
  if (bindParser) {
    const instanceParser: typeof functionsParser = (options) => new ParserClass(options);
    instance.parser = instanceParser;
  }

  instance.import = mathImport;
  instance.typed = instanceTyped;
  instance.reviver = (key: string, value: unknown) =>
    reviveInstanceValue(key, value, instance.Unit as typeof factory_mathjsCompat.constructors.Unit);
  instance.replacer = replacer;

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
    reviver,
    replacer,
    expression: expressionLayers,
  };
}
