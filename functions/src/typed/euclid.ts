/**
 * Euclidean GCD with a caller-chosen integer snap (floor vs round).
 * @internal — not re-exported from the package barrel.
 */
export function euclidSnap(a: number, b: number, snap: (x: number) => number): number {
  // No integer gcd exists for NaN or +-Infinity. The loop below never ends on NaN or +-Infinity.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  a = Math.abs(snap(a));
  b = Math.abs(snap(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
