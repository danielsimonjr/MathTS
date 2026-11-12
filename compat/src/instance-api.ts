/**
 * mathjs instance methods on `create(all)`: import, typed, compile, and
 * expression scope wired for per-instance evaluate.
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import typedFunction from 'typed-function';
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
  const expressionLayers: CompatExpressionLayers = {
    transform: {},
    mathWithTransform: {},
  };

  const instanceTyped = Object.assign(
    (...args: unknown[]) => mathTyped(...(args as Parameters<typeof mathTyped>)),
    {
      isTypedFunction: typedFunction.isTypedFunction,
      // The declared type is typeof mathTyped, so the registry method is delegated too.
      // The parse factory registers its string-to-Node conversion through it.
      addConversion: (...args: Parameters<typeof mathTyped.addConversion>) =>
        mathTyped.addConversion(...args),
    }
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
