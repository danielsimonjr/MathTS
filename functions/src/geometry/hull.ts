/**
 * Convex hull — the foundation of the computational-geometry engine.
 *
 * `convexHull` accepts a set of 2-D or 3-D points and returns a structured
 * result (`vertices`, `simplices`, `area`, `volume`) whose fields mirror
 * `scipy.spatial.ConvexHull`:
 *
 * - **2-D:** Andrew's monotone-chain algorithm (O(n log n)). `vertices` are the
 *   indices of the hull points in counter-clockwise order; `simplices` are the
 *   boundary edges (index pairs); `area` is the **perimeter** and `volume` is
 *   the **enclosed area** (matching SciPy's `.area` / `.volume` convention in
 *   2-D).
 * - **3-D:** incremental QuickHull (reusing the package's `convexHull3D`
 *   kernel). `simplices` are the triangular facets (index triples, oriented CCW
 *   as seen from outside); `area` is the **surface area** and `volume` the
 *   enclosed **volume**.
 *
 * Pinned against `scipy.spatial.ConvexHull` (vertex set + area/volume) in
 * `functions/tests/geometry-hull-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { convexHull3D } from '../typed/geometry.js';

/** Structured convex-hull result (mirrors `scipy.spatial.ConvexHull`). */
export interface ConvexHullResult {
  /**
   * Indices of the input points that lie on the hull. In 2-D these are in
   * counter-clockwise order; in 3-D they are sorted ascending.
   */
  vertices: number[];
  /**
   * Hull facets as arrays of point indices: edges `[i, j]` in 2-D, triangles
   * `[i, j, k]` in 3-D (CCW from outside).
   */
  simplices: number[][];
  /** SciPy `.area`: **perimeter** in 2-D, **surface area** in 3-D. */
  area: number;
  /** SciPy `.volume`: **enclosed area** in 2-D, **enclosed volume** in 3-D. */
  volume: number;
}

/**
 * 2-D convex hull via Andrew's monotone chain. Returns hull vertex **indices**
 * in CCW order. Collinear points on hull edges are dropped (minimal hull),
 * matching SciPy.
 */
function hull2DIndices(points: number[][]): number[] {
  const n = points.length;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => points[a][0] - points[b][0] || points[a][1] - points[b][1]
  );

  const cross = (o: number, a: number, b: number): number =>
    (points[a][0] - points[o][0]) * (points[b][1] - points[o][1]) -
    (points[a][1] - points[o][1]) * (points[b][0] - points[o][0]);

  const lower: number[] = [];
  for (const i of order) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) {
      lower.pop();
    }
    lower.push(i);
  }

  const upper: number[] = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) {
      upper.pop();
    }
    upper.push(i);
  }

  // Drop the last point of each run (it is the first point of the other run).
  lower.pop();
  upper.pop();
  return lower.concat(upper); // CCW
}

function convexHull2D(points: number[][]): ConvexHullResult {
  const vertices = hull2DIndices(points);
  const m = vertices.length;
  const simplices: number[][] = [];
  let signedArea = 0;
  let perimeter = 0;
  for (let k = 0; k < m; k++) {
    const i = vertices[k];
    const j = vertices[(k + 1) % m];
    simplices.push([i, j]);
    const a = points[i];
    const b = points[j];
    signedArea += a[0] * b[1] - b[0] * a[1];
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { vertices, simplices, area: perimeter, volume: Math.abs(signedArea) / 2 };
}

function convexHull3DResult(points: number[][]): ConvexHullResult {
  const faces = convexHull3D(points);
  const vertexSet = new Set<number>();
  let volume6 = 0; // 6× the signed volume
  let surface = 0;
  for (const [ia, ib, ic] of faces) {
    vertexSet.add(ia);
    vertexSet.add(ib);
    vertexSet.add(ic);
    const a = points[ia];
    const b = points[ib];
    const c = points[ic];
    // Signed volume of tetrahedron (origin, a, b, c) = a · (b × c) / 6.
    volume6 +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
    // Triangle area = ½‖(b−a) × (c−a)‖.
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    surface += Math.hypot(cx, cy, cz) / 2;
  }
  return {
    vertices: Array.from(vertexSet).sort((a, b) => a - b),
    simplices: faces.map((f) => [...f]),
    area: surface,
    volume: Math.abs(volume6) / 6,
  };
}

/**
 * Convex hull of a set of 2-D or 3-D points.
 *
 * @param points - Array of points, all `[x, y]` (2-D) or all `[x, y, z]` (3-D).
 * @returns A {@link ConvexHullResult}.
 * @throws When fewer than 3 (2-D) / 4 (3-D) points are given, or the points are
 *   not 2- or 3-dimensional.
 *
 * @example
 * convexHull([[0,0],[2,0],[2,2],[0,2],[1,1]])
 * // { vertices: [0,1,2,3], simplices: [[0,1],[1,2],[2,3],[3,0]], area: 8, volume: 4 }
 */
export function convexHull(points: number[][]): ConvexHullResult {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('convexHull: requires a non-empty array of points');
  }
  const dim = points[0].length;
  if (dim === 2) {
    if (points.length < 3) throw new Error('convexHull: 2-D hull requires at least 3 points');
    return convexHull2D(points);
  }
  if (dim === 3) {
    if (points.length < 4) throw new Error('convexHull: 3-D hull requires at least 4 points');
    return convexHull3DResult(points);
  }
  throw new Error(`convexHull: only 2-D and 3-D point sets are supported (got dimension ${dim})`);
}
