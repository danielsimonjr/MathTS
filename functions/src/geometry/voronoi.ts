/**
 * Voronoi diagram (2-D) — a consumer of the Delaunay triangulation.
 *
 * The Voronoi diagram is the dual of the Delaunay triangulation: each Delaunay
 * triangle contributes one Voronoi vertex (its circumcenter), and two Voronoi
 * vertices are joined by a ridge when their triangles share an edge. `voronoi`
 * returns the (unbounded) Voronoi vertices, the Delaunay triangle each one came
 * from, and the region (set of incident Voronoi vertices) of every generator.
 *
 * Pinned via implementation-independent invariants (Voronoi vertices are the
 * Delaunay circumcenters; each vertex's three generators are its nearest
 * generators — the dual empty-circumcircle property) in
 * `functions/tests/geometry-consumers-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { delaunay } from './delaunay.js';

/** Structured Voronoi result (dual of the Delaunay triangulation). */
export interface VoronoiResult {
  /** Voronoi vertices — the circumcenters of the Delaunay triangles. */
  vertices: number[][];
  /**
   * The Delaunay triangle (triple of input-point indices) that produced each
   * Voronoi vertex, parallel to {@link VoronoiResult.vertices}.
   */
  simplices: number[][];
  /**
   * Per input point: the indices (into `vertices`) of the Voronoi vertices on
   * the boundary of that point's Voronoi cell (unordered). Bounded cells of
   * interior points are closed; unbounded cells of hull points are open.
   */
  regions: number[][];
}

/** Circumcenter of triangle (a, b, c). Returns null for a degenerate triangle. */
function circumcenter(a: number[], b: number[], c: number[]): number[] | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-15) return null;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return [ux, uy];
}

/**
 * Voronoi diagram of a set of 2-D points (the dual of {@link delaunay}).
 *
 * @param points - Array of `[x, y]` points (at least 3, not all collinear).
 * @returns A {@link VoronoiResult}.
 * @throws When given fewer than 3 points or a non-2-D point set.
 *
 * @example
 * voronoi([[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]).vertices.length // == triangle count
 */
export function voronoi(points: number[][]): VoronoiResult {
  const { simplices: tris } = delaunay(points);
  const vertices: number[][] = [];
  const simplices: number[][] = [];
  const regions: number[][] = Array.from({ length: points.length }, () => []);
  for (const t of tris) {
    const cc = circumcenter(points[t[0]], points[t[1]], points[t[2]]);
    if (cc === null) continue;
    const vIdx = vertices.length;
    vertices.push(cc);
    simplices.push([...t]);
    for (const p of t) regions[p].push(vIdx);
  }
  return { vertices, simplices, regions };
}
