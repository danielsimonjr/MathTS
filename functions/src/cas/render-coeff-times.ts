import type { Rat } from './rat.js';

/**
 * Renders `coeff * rest` for CAS string output (`1`, `-1`, or `n/d*rest`).
 * @internal
 */
export function renderCoeffTimes(r: Rat, rest: string): string {
  const neg = r.num < 0n;
  const absNum = neg ? -r.num : r.num;
  const sign = neg ? '-' : '';
  if (absNum === r.den) {
    return `${sign}${rest}`;
  }
  const denPart = r.den === 1n ? '' : `/${r.den}`;
  return `${sign}${absNum}${denPart}*${rest}`;
}
