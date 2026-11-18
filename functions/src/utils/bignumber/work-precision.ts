/** The part of the BigNumber class that sets the working precision. */
export interface PrecisionClass {
  precision: number;
  config(options: { precision: number }): unknown;
}

/** A value with the rounding method of a BigNumber. */
interface Roundable {
  toSignificantDigits(digits: number): unknown;
}

/**
 * Runs `compute` with at least `workPrecision` significant digits, restores the precision of the
 * call, and rounds the result one time to that precision.
 *
 * BigNumber add and multiply round each result to the configured precision (#1118). An integer
 * algorithm that needs exact steps, or guard digits, runs its steps here.
 */
export function atWorkPrecision<T extends Roundable>(
  BigNumber: PrecisionClass,
  workPrecision: number,
  compute: () => T
): T {
  const precision = BigNumber.precision;
  BigNumber.config({ precision: Math.max(precision, workPrecision) });
  let value: T;
  try {
    value = compute();
  } finally {
    BigNumber.config({ precision });
  }
  // The BigNumber type of the factory layer declares the decimal.js return type here. The method
  // returns a value of the class of `value`.
  return value.toSignificantDigits(precision) as T;
}
