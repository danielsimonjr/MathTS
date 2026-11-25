import { expect } from 'vitest';
import { pair, show } from './oracle.js';

type Lib = {
  typeOf(v: unknown): string;
  format(v: unknown, o: { precision: number }): string;
};

export type SideResult = { value: string; function?: string } | { error: string; message: string };

function outcome(L: Lib, run: (L: Record<string, unknown>) => unknown): SideResult {
  try {
    const v = run(L as unknown as Record<string, unknown>);
    if (typeof v === 'function') {
      return { value: 'function', function: (v as { name?: string }).name ?? '' };
    }
    return { value: show(L, v) };
  } catch (e) {
    const err = e as Error;
    return { error: err.name, message: firstClause(err.message) };
  }
}

/**
 * The message compared through its first colon-terminated clause: bigint conversion
 * messages embed the whole value, so the tail is not stable across formatting.
 */
function firstClause(message: string): string {
  const i = message.indexOf(':');
  return i === -1 ? message : message.slice(0, i + 1);
}

/**
 * Assert one behavior on a compat instance and on the mathjs 15.3.0 oracle built with the
 * same config: equal `typeOf` + precision-14 format, or the same error name and message
 * prefix. Numeric values are compared through the format string, so a divergence below the
 * 14th digit does not fail; an issue that needs a tighter tolerance asserts the values
 * itself.
 */
export function expectSame(
  label: string,
  config: Record<string, unknown> | undefined,
  run: (L: Record<string, unknown>) => unknown
): void {
  const { mathjs, compat } = pair(config ?? {});
  const oracleOutcome = outcome(mathjs as unknown as Lib, run);
  const compatOutcome = outcome(compat as unknown as Lib, run);
  expect(compatOutcome, label).toEqual(oracleOutcome);
}
