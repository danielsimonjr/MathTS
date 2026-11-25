import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';

export type OracleConfig = Record<string, unknown>;

/** The structural surface the harness needs from either library instance. */
export interface HarnessInstance {
  evaluate(expression: string): unknown;
  format(value: unknown, options: { precision: number }): string;
  typeOf(value: unknown): string;
  [key: string]: unknown;
}

/**
 * One mathjs oracle instance and one compat instance, built with the same config. Every
 * differential test compares these two side by side, so a config-dependent divergence
 * (BigNumber, Fraction, `matrix: 'Array'`) shows up as a pair mismatch.
 */
export function pair(config: OracleConfig = {}): {
  mathjs: HarnessInstance;
  compat: HarnessInstance;
} {
  return {
    mathjs: create(all, config) as unknown as HarnessInstance,
    compat: createCompat(compatAll, config) as unknown as HarnessInstance,
  };
}

/**
 * The canonical rendering of a value for comparison: the `typeOf` name plus the
 * precision-14 format string, the pair the parity issues capture.
 */
export function show(
  lib: { typeOf(v: unknown): string; format(v: unknown, o: { precision: number }): string },
  value: unknown
): string {
  if (typeof value === 'function') return 'function ' + (value as { name?: string }).name;
  return lib.typeOf(value) + ' ' + lib.format(value, { precision: 14 });
}
