/**
 * Euclidean GCD with a caller-chosen integer snap (floor vs round).
 * @internal — not re-exported from the package barrel.
 */
export function euclidSnap(a: number, b: number, snap: (x: number) => number): number {
  a = Math.abs(snap(a));
  b = Math.abs(snap(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
