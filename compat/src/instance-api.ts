/**
 * mathjs instance methods on `create(all)`: import, typed, compile, and
 * expression scope wired for per-instance evaluate.
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import {
  createInstanceEvaluator,
  EVALUATE_SCOPE_OMIT,
  reviver,
  replacer,
  runWithConfig,
  type PhysicsEvaluateOptions,
} from '@danielsimonjr/mathts-functions';
import { importFactory, type ImportOptions } from '@danielsimonjr/mathts-functions';
import type { MathJSConfig } from './index.js';

type MathNamespace = Parameters<typeof importFactory>[2];
type ImportableFactories = Parameters<typeof importFactory>[3];

/** Expression overlay updated by `math.import` and used by instance evaluate. */
export interface CompatExpressionLayers {
  transform: Record<string, unknown>;
  mathWithTransform: Record<string, unknown>;
}

/** mathjs instance API attached by {@link wireMathjsInstanceApi}. */
export interface WiredCompatInstance {
  import: (functions: unknown, options?: ImportOptions) => void;
  typed: typeof mathTyped & { isTypedFunction: (value: unknown) => boolean };
  compile: (
    expr: string,
    options?: PhysicsEvaluateOptions
  ) => ReturnType<typeof createInstanceEvaluator>['compile'];
  evaluate: ReturnType<typeof createInstanceEvaluator>['evaluate'];
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
 */
export function wireMathjsInstanceApi(
  instance: Record<string, unknown>,
  currentConfig: MathJSConfig
): WiredCompatInstance {
  wiredInstances.add(instance);
  const brandHolder: object = Object.getPrototypeOf(instance) ?? instance;
  Object.defineProperty(brandHolder === Object.prototype ? instance : brandHolder, INSTANCE_BRAND, {
    value: true,
  });
  const expressionLayers: CompatExpressionLayers = {
    transform: {},
    mathWithTransform: {},
  };

  // The call builds through the shared typed instance. Every other member
  // (`addConversion`, `find`, `isTypedFunction`, ...) is read from mathTyped
  // through the prototype chain, so the declared `typeof mathTyped` holds.
  const instanceTyped = Object.setPrototypeOf(
    (...args: unknown[]) => mathTyped(...(args as Parameters<typeof mathTyped>)),
    mathTyped
  ) as WiredCompatInstance['typed'];

  const mathNs = instance as MathNamespace;
  mathNs.typed = instanceTyped;
  mathNs.expression = expressionLayers;
  mathNs.emit = () => {
    /* importFactory notifies listeners; compat does not subscribe */
  };

  const UnitCtor = instance.Unit as { isValuelessUnit: (name: string) => boolean } | undefined;
  if (UnitCtor?.isValuelessUnit) {
    mathNs.Unit = UnitCtor;
  }

  const importedFactories: ImportableFactories = {};
  const noopLoad = (): unknown => undefined;

  const internalImport = importFactory(
    instanceTyped as never,
    noopLoad as never,
    mathNs,
    importedFactories
  );

  let evaluator = createInstanceEvaluator(expressionLayers.mathWithTransform);

  const runBound = <T extends (...args: never[]) => unknown>(fn: T): T =>
    ((...args: never[]) => runWithConfig(currentConfig, () => fn(...args))) as T;

  function rebindEvaluator(): void {
    scrubDenylist(expressionLayers.mathWithTransform);
    evaluator = createInstanceEvaluator(expressionLayers.mathWithTransform);
    instance.evaluate = runBound(evaluator.evaluate);
    instance.compile = runBound(evaluator.compile);
    instance.compileExpr = instance.compile;
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

  instance.import = mathImport;
  instance.typed = instanceTyped;
  instance.reviver = reviver;
  instance.replacer = replacer;

  rebindEvaluator();

  return {
    import: mathImport,
    typed: instanceTyped,
    compile: instance.compile as WiredCompatInstance['compile'],
    evaluate: instance.evaluate as WiredCompatInstance['evaluate'],
    reviver,
    replacer,
    expression: expressionLayers,
  };
}
