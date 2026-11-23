import { BigNumber, ROOT_SAFE_MIN, powerOfTwoBelow } from '@danielsimonjr/mathts-core';

/**
 * An exact scale for a list of real values, so that the squares of the scaled values cannot
 * leave the range of the type (#1257).
 *
 * The largest value is divided by a power of 2 when every value is a number, else by a power of
 * 10 (a number is read as a BigNumber). Both scales change only the exponent, so no digit is
 * lost. `down` divides a value by the scale. `up` multiplies a result by the scale.
 */
export interface RealScale {
  /**
   * `true` when the scale is a power of 10: at least one value is a BigNumber. `down` and `up`
   * then return BigNumbers.
   */
  readonly big: boolean;
  /** `true` when the scale is 1, so `down` and `up` change no value. */
  readonly unit: boolean;
  /**
   * The decimal order of the largest absolute value: the exponent of its scientific notation
   * (`BigNumber.e`, so 0 for 1 to 9.99, 200 for 3e200). This is the order that core compares
   * with `minExponent` and `maxExponent`. A count of the digits before the point (that order
   * plus 1) is a different convention.
   */
  readonly order: number;
  /** The values divided by the scale. */
  down(value: number | BigNumber): number | BigNumber;
  /** The result multiplied by the scale. */
  up(result: number | BigNumber): number | BigNumber;
}

/** The scale of `values`, or `undefined` when a value is not finite, is not a number or a BigNumber, or every value is 0. */
export function realScale(values: readonly unknown[]): RealScale | undefined {
  let anyBig = false;
  for (const v of values) {
    if (v instanceof BigNumber) {
      if (!v.isFinite()) return undefined;
      anyBig = true;
    } else if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  }
  if (anyBig) {
    let order: number | undefined;
    for (const v of values) {
      const b = v instanceof BigNumber ? v : BigNumber.fromNumber(v as number);
      if (b.isZero()) continue;
      if (order === undefined || b.e > order) order = b.e;
    }
    if (order === undefined) return undefined;
    const down10 = new BigNumber(`1e${-order}`);
    const up10 = new BigNumber(`1e${order}`);
    return {
      big: true,
      unit: order === 0,
      order,
      down: (v) => (v instanceof BigNumber ? v : BigNumber.fromNumber(v)).multiply(down10),
      up: (r) => (r instanceof BigNumber ? r : BigNumber.fromNumber(r)).multiply(up10),
    };
  }
  let max = 0;
  for (const v of values as number[]) if (Math.abs(v) > max) max = Math.abs(v);
  if (max === 0) return undefined;
  // 2^k <= max < 2^(k+1), so max / s is in [1, 2). s is exact. For k below -1022 it is a
  // subnormal, which is still a power of 2.
  const s = powerOfTwoBelow(max);
  return {
    big: false,
    unit: s === 1,
    order: Math.floor(Math.log10(max)),
    down: (v) => (v as number) / s,
    up: (r) => (r as number) * s,
  };
}

/**
 * The number or BigNumber `r` is NaN, infinite or zero. A result of one of these kinds can come
 * from a square that left the range of the type.
 */
export function isDegenerate(r: unknown): boolean {
  if (r instanceof BigNumber) return !r.isFinite() || r.isZero();
  return typeof r === 'number' && (!Number.isFinite(r) || r === 0);
}

/**
 * The root `r` of a sum of squares is degenerate (see {@link isDegenerate}) or below
 * `ROOT_SAFE_MIN` (2^-400): the sum of squares can have lost digits to subnormal squares (#1280).
 * A root of at least 2^-400 has a sum of squares of at least 2^-800, which keeps all its digits.
 * Only a number can lose digits this way: a BigNumber has no subnormal range.
 */
export function rootOfSquaresLostDigits(r: unknown): boolean {
  return isDegenerate(r) || (typeof r === 'number' && Math.abs(r) < ROOT_SAFE_MIN);
}

/**
 * The result of `plain` for the scaled values, multiplied back by the scale. `plain` must be
 * homogeneous of degree 1, as the standard deviation is: f(s * x) = s * f(x). The scale is exact,
 * so `plain` does the same operations on the same digits as for values of order 1, and the
 * result has the rounding of `plain` for those values (an exact 0 stays an exact 0).
 *
 * Returns `undefined` when the values have no scale (see `realScale`), when the scale is 1 (the
 * values are scaled already) or when the result for the scaled values is not finite.
 */
export function rescaled(
  values: readonly unknown[],
  plain: (scaled: (number | BigNumber)[]) => unknown
): number | BigNumber | undefined {
  const scale = realScale(values);
  if (scale === undefined || scale.unit) return undefined;
  const r = plain(values.map((v) => scale.down(v as number | BigNumber)));
  if (r instanceof BigNumber) return r.isFinite() ? scale.up(r) : undefined;
  return typeof r === 'number' && Number.isFinite(r) ? scale.up(r) : undefined;
}

/**
 * A sum of `count` squares of values of decimal order `order` can leave the exponent bounds of
 * the BigNumber configuration. A BigNumber that is out of range becomes Infinity or 0.
 */
export function squaresLeaveRange(order: number, count: number): boolean {
  const { maxExponent, minExponent } = BigNumber.config();
  const margin = String(Math.max(1, count)).length + 2;
  return 2 * order + margin > maxExponent || 2 * order - margin < minExponent;
}
