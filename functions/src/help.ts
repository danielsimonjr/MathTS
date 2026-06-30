/**
 * GC4 — `help(search)` mathjs-canonical export.
 *
 * The Help class + embedded documentation live in the `expression` package; this
 * wires them together with the package's `evaluate` (used by `Help` to run the
 * doc examples) and exposes the bare `help` name mathjs users expect.
 */
import { createHelpClass, embeddedDocs } from '@danielsimonjr/mathts-expression';
import { evaluate } from './factories/evaluate.js';

type HelpCtor = new (doc: unknown) => unknown;

// `Help.toString()` evaluates each doc example and brackets them with
// `config()` (get) / `config(newConfig)` (set) to restore state afterwards. The
// standalone `evaluate` exposes `config` as a plain object, not a callable, so
// wrap it: intercept the config round-trip and delegate real examples through.
let savedConfig: Record<string, unknown> = {};
function helpEvaluate(expr: unknown, scope?: Record<string, unknown>): unknown {
  const text = String(expr).trim();
  if (text === 'config()') return { ...savedConfig };
  if (text.startsWith('config(')) {
    const next = scope && (scope.newConfig ?? scope.originalConfig);
    if (next && typeof next === 'object') savedConfig = { ...(next as Record<string, unknown>) };
    return { ...savedConfig };
  }
  return evaluate(text, scope);
}

const Help = (createHelpClass as unknown as (deps: { evaluate: unknown }) => HelpCtor)({
  evaluate: helpEvaluate,
});

/**
 * Retrieve help on a function or constant. Mirrors mathjs `math.help`.
 *
 *     help('sin').toString()
 *     help(add)               // resolves the function back to its name
 *
 * @param search  A function-name string, or a function/constant value.
 * @returns A `Help` object (stringifies to the documentation text).
 */
export function help(search: unknown): unknown {
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
