/**
 * The modulus of two numbers, with the sign of the divisor (`mod` of mathjs). The typed `mod` and
 * the factory `mod` (`factory_mod`) both call this function, so they cannot differ.
 *
 * - A zero divisor returns the dividend (mathjs rule).
 * - Two integers take the exact remainder. The mathjs formula `x - y * floor(x / y)` is wrong for
 *   a large integer, because the product `y * floor(x / y)` rounds: mathjs gives
 *   `mod(1700006399999, 86400000)` as -1, and the true value is 86399999. The result of `%` is
 *   exact for doubles. A zero remainder is +0, as in mathjs.
 * - A finite pair whose quotient is 2^53 or more in magnitude takes the exact remainder too. The
 *   quotient has no fractional bits there, so the formula gives 0 or -Infinity for a remainder
 *   that `%` returns exactly: `mod(1e22, 0.7)` is 0.1569... and not 0, and `mod(1e308, 0.1)` is
 *   0.0609... and not -Infinity. No snap can apply at that size.
 * - Any other pair takes the mathjs formula with a floor that snaps to the nearest integer within
 *   the configured tolerance, so `mod(0.3, 0.1)` is -5.551115123125783e-17 and not 0.0999...
 *
 * @param a - Dividend.
 * @param b - Divisor.
 * @param floorOf - The floor of the number path, with the snap to the configured tolerance.
 * @returns The remainder of `a` divided by `b`, with the sign of `b`.
 */
export function modWithFloor(a: number, b: number, floorOf: (x: number) => number): number {
  if (b === 0) return a;
  if (Number.isInteger(a) && Number.isInteger(b)) return exactFlooredRemainder(a, b);
  const quotient = a / b;
  if (Math.abs(quotient) >= NO_FRACTION_BITS && Number.isFinite(a) && Number.isFinite(b)) {
    return exactFlooredRemainder(a, b);
  }
  return a - b * floorOf(quotient);
}

/** A double of this size or more is an integer: it has no bit for a fraction. */
const NO_FRACTION_BITS = 2 ** 53;

/** The remainder of `%` (exact for doubles), moved to the sign of `b`. A zero remainder is +0. */
function exactFlooredRemainder(a: number, b: number): number {
  const r = a % b;
  return r === 0 ? 0 : r < 0 !== b < 0 ? r + b : r;
}
