/**
 * The members of a BigNumber that the floored remainder uses. The BigNumber of
 * `@danielsimonjr/mathts-core` and the BigNumber type of the factory layer both have them.
 */
interface ModValue<T> {
  isZero(): boolean;
  isNegative(): boolean;
  mod(y: T): T;
  add(y: T): T;
  constructor: { precision: number; config(options: { precision: number }): unknown };
}

/**
 * The remainder of `x / y` with the sign of `y` (the `mod` of mathjs), exact at any precision.
 * A divisor of zero returns `x`.
 *
 * `BigNumber.mod` is exact and takes the sign of `x`. The floored result adds `y` when the signs
 * differ. `x - y * floor(x / y)` would round the product to the precision (#1118).
 */
export function flooredModBigNumber<T extends ModValue<T>>(x: T, y: T): T {
  if (y.isZero()) return x;
  const remainder = x.mod(y);
  if (remainder.isZero() || remainder.isNegative() === y.isNegative()) return remainder;
  // |remainder + y| < |y|, but the sum can have more digits than the precision, so the add runs
  // with no precision limit.
  const BigNumber = x.constructor;
  const precision = BigNumber.precision;
  BigNumber.config({ precision: Infinity });
  try {
    return remainder.add(y);
  } finally {
    BigNumber.config({ precision });
  }
}
