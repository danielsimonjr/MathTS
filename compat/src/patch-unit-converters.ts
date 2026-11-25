/**
 * Native `Unit.typeConverters.BigNumber` already reads `Fraction.numerator` /
 * `denominator` (#1551). Kept as a no-op so older call sites stay valid.
 */

/** No-op: do not mutate native or per-instance Unit converters. */
export function patchCompatUnitTypeConverters(_Unit: {
  typeConverters: Record<string, unknown>;
  _getNumberConverter?: (type: string) => (x: never) => unknown;
}): void {
  /* native converters are correct */
}
