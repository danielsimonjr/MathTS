/**
 * Alpha shape (2-D) — a consumer of the Delaunay triangulation.
 *
 * An alpha shape generalises the convex hull: it keeps only the Delaunay
 * triangles whose circumradius is `≤ 1/alpha`, then returns the boundary of
 * that region (edges belonging to exactly one kept triangle). Large `alpha`
 * hugs the point set tightly; `alpha → 0` recovers the convex hull. With the
 * right `alpha`, an annulus-shaped point cloud yields a shape with a hole.
 *
 * Pinned on a known shape (annulus → recovers the hole: two boundary loops) in
 * `functions/tests/geometry-consumers-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { delaunay } from './delaunay.js';

/** Structured alpha-shape result. */
export interface AlphaShapeResult {
  /** Kept Delaunay triangles (circumradius ≤ 1/alpha), as index triples. */
  triangles: number[][];
  /**
   * Boundary edges of the alpha shape — the edges that belong to exactly one
   * kept triangle — as index pairs `[i, j]` with `i < j`.
   */
  edges: number[][];
}

/** Circumradius of triangle (a, b, c); `Infinity` for a degenerate triangle. */
function circumradius(a: number[], b: number[], c: number[]): number {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-15) return Infinity;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return Math.hypot(a[0] - ux, a[1] - uy);
}

/**
 * Alpha shape of a set of 2-D points.
 *
 * @param points - Array of `[x, y]` points (at least 3, not all collinear).
 * @param alpha - Positive alpha parameter; triangles with circumradius `≤ 1/alpha`
 *   are kept. Smaller `alpha` → looser shape (→ convex hull); larger `alpha` →
 *   tighter shape that can open holes/concavities.
 * @returns An {@link AlphaShapeResult} (kept triangles + boundary edges).
 * @throws When given fewer than 3 points, a non-2-D point set, or `alpha ≤ 0`.
 */
export function alphaShape(points: number[][], alpha: number): AlphaShapeResult {
  if (!(alpha > 0)) throw new Error('alphaShape: alpha must be positive');
  const { simplices: tris } = delaunay(points);
  const threshold = 1 / alpha;

  const triangles: number[][] = [];
  const edgeCount = new Map<string, number>();
  for (const t of tris) {
    if (circumradius(points[t[0]], points[t[1]], points[t[2]]) > threshold) continue;
    triangles.push([...t]);
    const es: [number, number][] = [
      [t[0], t[1]],
      [t[1], t[2]],
      [t[2], t[0]],
    ];
    for (const [u, v] of es) {
      const key = `${Math.min(u, v)},${Math.max(u, v)}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  // Boundary = edges belonging to exactly one kept triangle.
  const edges: number[][] = [];
  for (const [key, count] of edgeCount) {
    if (count === 1) {
      const [lo, hi] = key.split(',').map(Number);
      edges.push([lo, hi]);
    }
  }
  return { triangles, edges };
}
