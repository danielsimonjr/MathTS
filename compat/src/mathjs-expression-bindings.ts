/**
 * mathjs-policy expression names for compat `create(all)` only (#1549, #1562).
 * Lives in compat so `functions` does not import `help` from a cycle with `evaluate`.
 */
import { createHelpClass, embeddedDocs } from '@danielsimonjr/mathts-expression';
import type { PhysicsEvaluateOptions } from '@danielsimonjr/mathts-functions';

type HelpResult = ReturnType<ReturnType<typeof createHelpClass>['fromJSON']>;
type HelpCtor = new (doc: unknown) => HelpResult;

export type CompatExpressionApi = {
  evaluate(
    expr: string,
    scope?: Record<string, unknown>,
    options?: PhysicsEvaluateOptions & { safe?: boolean }
  ): unknown;
  compile(
    expr: string,
    options?: PhysicsEvaluateOptions & { safe?: boolean }
  ): {
    evaluate(scope?: Record<string, unknown>): unknown;
  };
  parser(options?: PhysicsEvaluateOptions & { safe?: boolean }): {
    evaluate(expr: string): unknown;
    scope: Record<string, unknown>;
  };
};

/**
 * Bindings for {@link createInstanceEvaluator}'s optional `expressionUnsafeBindings`
 * (help, evaluate, compile, parser on the mathjs-policy unsafe scope).
 */
export function createMathjsExpressionBindings(
  getApi: () => CompatExpressionApi
): Record<string, unknown> {
  let savedConfig: Record<string, unknown> = {};

  const helpEvaluate = (expr: unknown, scope?: Record<string, unknown>): unknown => {
    const text = String(expr).trim();
    if (text === 'config()') return { ...savedConfig };
    if (text.startsWith('config(')) {
      const next = scope && (scope.newConfig ?? scope.originalConfig);
      if (next && typeof next === 'object') savedConfig = { ...(next as Record<string, unknown>) };
      return { ...savedConfig };
    }
    return getApi().evaluate(text, scope);
  };

  const Help = (createHelpClass as unknown as (deps: { evaluate: unknown }) => HelpCtor)({
    evaluate: helpEvaluate,
  });

  function help(search: unknown): HelpResult {
    const name =
      typeof search === 'string'
        ? search
        : typeof search === 'function'
          ? (search as { name?: string }).name
          : undefined;

    const doc =
      typeof name === 'string' && Object.prototype.hasOwnProperty.call(embeddedDocs, name)
        ? (embeddedDocs as Record<string, unknown>)[name]
        : undefined;

    if (!doc) {
      throw new Error(`No documentation found on "${String(name ?? search)}"`);
    }
    return new Help(doc);
  }

  return {
    help,
    evaluate: (expr: string, scope?: Record<string, unknown>, options?: PhysicsEvaluateOptions) =>
      getApi().evaluate(expr, scope, options),
    compile: (expr: string, options?: PhysicsEvaluateOptions) => getApi().compile(expr, options),
    parser: (options?: PhysicsEvaluateOptions) => getApi().parser(options),
  };
}
