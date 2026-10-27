import { nearlyEqual } from '../utils/number.js';

type TowardNumber = (x: number) => number;

/**
 * Shared nearlyEqual snap for scalar ceil/floor (`toward` is `Math.ceil` or `Math.floor`).
 *
 * When `toward(x)` and `round(x)` disagree, prefer the rounded integer if `x` is
 * indistinguishable from it (and distinguishable from the directed rounding).
 *
 * @param x - Value to snap.
 * @param toward - Directed rounding (`Math.ceil` or `Math.floor`).
 * @param round - Nearest-integer rounding used as the snap candidate.
 * @param relTol - Relative tolerance forwarded to `nearlyEqual`.
 * @param absTol - Absolute tolerance forwarded to `nearlyEqual`.
 * @returns `toward(x)`, or `round(x)` when the nearlyEqual snap rule fires.
 *
 * @example
 * snapNumber(2 - 1e-12, Math.floor, Math.round, 1e-12, 1e-15) // 2
 */
export function snapNumber(
  x: number,
  toward: TowardNumber,
  round: (x: number) => number,
  relTol: number,
  absTol: number
): number {
  const t = toward(x);
  const r = round(x);
  if (t === r) return t;
  if (nearlyEqual(x, r, relTol, absTol) && !nearlyEqual(x, t, relTol, absTol)) {
    return r;
  }
  return t;
}

/**
 * Equality used by {@link snapBig}: decimal.js `eq`, else core BigNumber `equals`.
 * Factory BigNumbers are core's class, which does not implement `eq`.
 */
function sameBig<T extends { eq?(other: T): boolean; equals?(other: T): boolean }>(
  a: T,
  b: T
): boolean {
  if (typeof a.eq === 'function') return a.eq(b);
  if (typeof a.equals === 'function') return a.equals(b);
  return Object.is(a, b);
}

/**
 * Shared nearlyEqual snap for factory BigNumber ceil/floor.
 *
 * @param x - BigNumber-like value.
 * @param toward - Directed rounding (`v => v.ceil()` or `v => v.floor()`).
 * @param round - Nearest-integer rounding used as the snap candidate.
 * @param bne - BigNumber nearlyEqual predicate (already closed over rel/abs tol).
 * @returns `toward(x)`, or `round(x)` when the nearlyEqual snap rule fires.
 *
 * @example
 * // floor of a value within relTol of 3 snaps to 3, not 2
 */
export function snapBig<T extends { eq?(other: T): boolean; equals?(other: T): boolean }>(
  x: T,
  toward: (v: T) => T,
  round: (v: T) => T,
  bne: (a: T, b: T) => boolean
): T {
  const t = toward(x);
  const r = round(x);
  if (sameBig(t, r)) return t;
  if (bne(x, r) && !bne(x, t)) return r;
  return t;
}
