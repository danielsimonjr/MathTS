/**
 * mathjs-policy expression names for compat `create(all)` only (#1549, #1562).
 * Lives in compat so `functions` does not import `help` from a cycle with `evaluate`.
 */
import { createHelpClass } from '@danielsimonjr/mathts-expression';
import { isMatrix } from '@danielsimonjr/mathts-core';
import type { PhysicsEvaluateOptions } from '@danielsimonjr/mathts-functions';
import { compatHelpDocForSearch } from './compat-help.js';

function stringExpressionBatch(input: unknown): string[] | undefined {
  if (Array.isArray(input) && input.every((entry) => typeof entry === 'string')) {
    return input;
  }
  if (isMatrix(input)) {
    const raw =
      (input as { toArray?: () => unknown[] }).toArray?.() ??
      (input as { _data?: unknown[] })._data;
    if (Array.isArray(raw) && raw.every((entry) => typeof entry === 'string')) {
      return raw as string[];
    }
  }
  return undefined;
}

type HelpResult = ReturnType<ReturnType<typeof createHelpClass>['fromJSON']>;
type HelpCtor = new (doc: unknown) => HelpResult;

/** Compat instance evaluate / compile / parser surface used by mathjs-policy bindings. */
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
/** Compat instance evaluator used for unsafe-scope expression calls (#1776). */
export type CompatEvaluatorEvaluate = (
  expr: string | string[],
  scope?: Record<string, unknown>,
  options?: PhysicsEvaluateOptions
) => unknown;

export function createMathjsExpressionBindings(
  getApi: () => CompatExpressionApi,
  mathWithTransform: () => Record<string, unknown>,
  getEvaluatorEvaluate: () => CompatEvaluatorEvaluate,
  getCreateUnit: () => (...args: unknown[]) => unknown
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
    const doc = compatHelpDocForSearch(search, mathWithTransform());
    return new Help(doc);
  }

  return {
    createUnit: (...args: unknown[]) => getCreateUnit()(...args),
    help,
    evaluate: (
      expr: string | string[],
      scope?: Record<string, unknown>,
      options?: PhysicsEvaluateOptions
    ) => {
      const opts = { ...options, unsafe: true as const };
      const batch = stringExpressionBatch(expr);
      if (batch !== undefined) {
        const shared = scope === undefined ? {} : scope;
        return getEvaluatorEvaluate()(batch, shared, opts);
      }
      return getEvaluatorEvaluate()(expr, scope, opts);
    },
    compile: (expr: string, options?: PhysicsEvaluateOptions) => getApi().compile(expr, options),
    parser: (options?: PhysicsEvaluateOptions) => getApi().parser(options),
  };
}
