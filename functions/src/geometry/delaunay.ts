/**
 * Delaunay triangulation (2-D) — part of the computational-geometry engine.
 *
 * `delaunay` triangulates a 2-D point set so that no point lies strictly inside
 * the circumcircle of any triangle (the empty-circumcircle / Delaunay
 * property). It reuses the package's Bowyer–Watson kernel and returns a
 * structured result whose `simplices` mirror `scipy.spatial.Delaunay.simplices`
 * (triangles as triples of point indices).
 *
 * The triangulation is not unique on cocircular points, so it is pinned by
 * implementation-independent invariants (every input point is a vertex, the
 * triangles partition the convex hull, and the empty-circumcircle property) —
 * see `functions/tests/geometry-delaunay-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { delaunayTriangulation } from '../typed/geometry.js';

/** Structured Delaunay result (mirrors `scipy.spatial.Delaunay`). */
export interface DelaunayResult {
  /** Triangles as triples of indices into the input `points`. */
  simplices: number[][];
}

/**
 * Delaunay triangulation of a set of 2-D points.
 *
 * @param points - Array of `[x, y]` points (at least 3, not all collinear).
 * @returns A {@link DelaunayResult}.
 * @throws When given fewer than 3 points or a non-2-D point set.
 *
 * @example
 * delaunay([[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]).simplices.length // 4
 */
export function delaunay(points: number[][]): DelaunayResult {
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error('delaunay: requires at least 3 points');
  }
  if (points[0].length !== 2) {
    throw new Error('delaunay: only 2-D point sets are supported');
  }
  return { simplices: delaunayTriangulation(points).map((t) => [...t]) };
}
