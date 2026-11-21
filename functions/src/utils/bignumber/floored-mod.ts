/**
 * The members of a BigNumber that the floored remainder uses. The BigNumber of
 * `@danielsimonjr/mathts-core` and the BigNumber type of the factory layer both have them.
 */
interface ModValue<T> {
  isZero(): boolean;
  isFinite(): boolean;
  isNegative(): boolean;
  mod(y: T): T;
  add(y: T): T;
  constructor: {
    precision: number;
    config(options: { precision: number }): unknown;
    new (value: number): T;
  };
}

/**
 * The remainder of `x / y` with the sign of `y` (the `mod` of mathjs), exact at any precision.
 * A divisor of zero returns `x`. A NaN or an infinite operand gives NaN, as the mathjs formula
 * `x - y * floor(x / y)` does.
 *
 * `BigNumber.mod` is exact and takes the sign of `x`. The floored result adds `y` when the signs
 * differ. `x - y * floor(x / y)` would round the product to the precision (#1118).
 */
export function flooredModBigNumber<T extends ModValue<T>>(x: T, y: T): T {
  if (y.isZero()) return x;
  // `BigNumber.mod` returns `x` for an infinite `y`, and the sum below would then add the
  // infinite `y` to a negative `x`.
  if (!x.isFinite() || !y.isFinite()) return new x.constructor(NaN);
  const remainder = x.mod(y);
  if (remainder.isZero() || remainder.isNegative() === y.isNegative()) return remainder;
  // |remainder + y| < |y|, but the sum can have more digits than the precision, so the add runs
  // with no precision limit.
  return withUnlimitedPrecision(x.constructor, () => remainder.add(y));
}

/** Runs `compute` with the BigNumber class set to no precision limit, then restores the limit. */
function withUnlimitedPrecision<T>(
  BigNumber: { precision: number; config(options: { precision: number }): unknown },
  compute: () => T
): T {
  const precision = BigNumber.precision;
  BigNumber.config({ precision: Infinity });
  try {
    return compute();
  } finally {
    BigNumber.config({ precision });
  }
}

/** The members of a BigNumber that the snapped floored remainder adds to `ModValue`. */
interface SnappedModValue extends ModValue<SnappedModValue> {
  div(y: SnappedModValue): SnappedModValue;
  mul(y: SnappedModValue): SnappedModValue;
  sub(y: SnappedModValue): SnappedModValue;
  floor(): SnappedModValue;
  isInteger(): boolean;
  equals(y: SnappedModValue): boolean;
}

/**
 * The remainder of `x / y` with the sign of `y`, as the mathjs formula `x - y * floor(x / y)`
 * gives it: the floor of the quotient snaps to the nearest integer within the configured
 * tolerance (`floorOf`). So `mod(2.9999999999999999999999, 1)` is -1e-22, and the exact
 * remainder 0.9999999999999999999999 is not the result. This is the rule of the number kernel
 * (`modWithFloor`), so a BigNumber and a number agree.
 *
 * - Two integers, a zero divisor and a non-finite operand take `flooredModBigNumber`, as the
 *   number kernel takes `%` for two integers. The exact remainder of two integers is not changed
 *   by a snap (mathjs gives `mod(1700006399999, 86400000)` as -1; the exact value is 86399999).
 * - A quotient whose snapped floor equals its plain floor keeps the exact remainder, so a
 *   product that is wider than the precision does not round (#1118).
 * - A quotient that snaps one above its floor gives `x - y * snapped`, computed with no
 *   precision limit, so the result is exact for the snapped integer.
 *
 * @param x - Dividend.
 * @param y - Divisor.
 * @param floorOf - The floor of the BigNumber path, with the snap to the configured tolerance.
 * @returns The remainder of `x` divided by `y`, with the sign of `y`.
 */
export function flooredModSnappedBigNumber<T>(x: T, y: T, floorOf: (quotient: T) => T): T {
  // The BigNumber classes type `constructor` as `Function`, so the members are read through one
  // view of the type.
  const a = x as unknown as SnappedModValue;
  const b = y as unknown as SnappedModValue;
  const remainder = flooredModBigNumber(a, b);
  if (b.isZero() || !a.isFinite() || !b.isFinite() || remainder.isZero()) return remainder as T;
  if (a.isInteger() && b.isInteger()) return remainder as T;
  const quotient = a.div(b);
  const snapped = floorOf(quotient as unknown as T) as unknown as SnappedModValue;
  if (snapped.equals(quotient.floor())) return remainder as T;
  return withUnlimitedPrecision(a.constructor, () => a.sub(b.mul(snapped))) as T;
}
