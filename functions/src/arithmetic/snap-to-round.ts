import { nearlyEqual } from '../utils/number.js';

type TowardNumber = (x: number) => number;

/** Shared nearlyEqual snap for scalar ceil/floor (`toward` is `Math.ceil` or `Math.floor`). */
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

/** Shared nearlyEqual snap for factory BigNumber ceil/floor. */
export function snapBig<T extends { eq(other: T): boolean }>(
  x: T,
  toward: (v: T) => T,
  round: (v: T) => T,
  bne: (a: T, b: T) => boolean
): T {
  const t = toward(x);
  const r = round(x);
  if (t.eq(r)) return t;
  if (bne(x, r) && !bne(x, t)) return r;
  return t;
}
