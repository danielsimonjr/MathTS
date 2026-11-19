import { BigNumber } from '@danielsimonjr/mathts-core';

/**
 * The square root of the sum of the squares of real values, `sqrt(sum(x^2))`, where at least one
 * value is a BigNumber. A square can be out of range when the root is in range (#1255). Each value
 * is multiplied by 10^-shift first, with `shift` the largest decimal exponent, so the largest
 * square has an exponent near 0. The squares run with the widest exponent bounds. The root is
 * then multiplied by 10^shift under the configured bounds, so the result is correct whenever it
 * is in range. A power of ten is exact, so the digits equal the plain formula's digits when the
 * plain formula does not overflow.
 *
 * A NaN value gives NaN. An infinite value gives Infinity.
 */
export function bigHypot(values: readonly (number | BigNumber)[]): BigNumber {
  const xs = values.map((v) => (typeof v === 'number' ? BigNumber.fromNumber(v) : v));
  if (xs.some((x) => x.isNaN())) return BigNumber.fromNumber(NaN);
  if (xs.some((x) => !x.isFinite())) return BigNumber.fromNumber(Infinity);
  let shift = 0;
  let found = false;
  for (const x of xs) {
    if (x.isZero()) continue;
    if (!found || x.e > shift) shift = x.e;
    found = true;
  }
  if (!found) return BigNumber.fromNumber(0);

  const saved = BigNumber.config();
  const limit = 2 ** 53 - 2 ** 31;
  let root: BigNumber;
  let factor: BigNumber;
  try {
    BigNumber.config({ minExponent: -limit, maxExponent: limit });
    const unscale = new BigNumber(`1e${-shift}`);
    let sum = BigNumber.fromNumber(0);
    for (const x of xs) {
      const s = x.multiply(unscale);
      sum = sum.add(s.multiply(s));
    }
    root = sum.sqrt();
    factor = new BigNumber(`1e${shift}`);
  } finally {
    BigNumber.config({
      minExponent: saved.minExponent,
      maxExponent: saved.maxExponent,
    });
  }
  return root.multiply(factor);
}
