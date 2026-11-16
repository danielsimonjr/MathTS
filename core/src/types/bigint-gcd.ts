/**
 * The greatest common divisor of two bigints, always non-negative.
 * @module @danielsimonjr/mathts-core/types/bigint-gcd
 */

const SAFE_GCD = 1n << 53n;

/** Euclid on bigints. When both values are exact doubles, the loop runs in floating point, which is exact there and faster. */
export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  if (x <= SAFE_GCD && y <= SAFE_GCD) {
    let p = Number(x);
    let q = Number(y);
    while (q !== 0) [p, q] = [q, p % q];
    return BigInt(p);
  }
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}
