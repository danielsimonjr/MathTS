/**
 * Shared 2-D circumcircle computation for geometry consumers.
 *
 * @packageDocumentation
 */

/**
 * Circumcenter of triangle `(a, b, c)` in the plane.
 *
 * Returns `null` when the triangle is degenerate (`|d| < 1e-15`).
 * Callers map `null` to `Infinity` (circumradius) or keep `null` (circumcenter).
 */
export function circumcircle(
  a: number[],
  b: number[],
  c: number[]
): { ux: number; uy: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-15) return null;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { ux, uy };
}
