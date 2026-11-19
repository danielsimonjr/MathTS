import { BigNumber } from '@danielsimonjr/mathts-core';

/**
 * An exact scale for a list of real values, so that the squares of the scaled values cannot
 * leave the range of the type (#1257).
 *
 * The largest value is divided by a power of 2 when every value is a number, else by a power of
 * 10 (a number is read as a BigNumber). Both scales change only the exponent, so no digit is
 * lost. `down` divides a value by the scale. `up` multiplies a result by the scale.
 */
export interface RealScale {
  /** `true` when the scale is a power of 10 and every value is a BigNumber. */
  readonly big: boolean;
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
      order,
      down: (v) => (v instanceof BigNumber ? v : BigNumber.fromNumber(v)).multiply(down10),
      up: (r) => (r instanceof BigNumber ? r : BigNumber.fromNumber(r)).multiply(up10),
    };
  }
  let max = 0;
  for (const v of values as number[]) if (Math.abs(v) > max) max = Math.abs(v);
  if (max === 0) return undefined;
  const k = Math.floor(Math.log2(max));
  // 2^k is exact. For k below -1022 it is a subnormal, which is still a power of 2.
  const s = 2 ** k;
  return {
    big: false,
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
 * A sum of `count` squares of values of decimal order `order` can leave the exponent bounds of
 * the BigNumber configuration. A BigNumber that is out of range becomes Infinity or 0.
 */
export function squaresLeaveRange(order: number, count: number): boolean {
  const { maxExponent, minExponent } = BigNumber.config();
  const margin = String(Math.max(1, count)).length + 2;
  return 2 * order + margin > maxExponent || 2 * order - margin < minExponent;
}
