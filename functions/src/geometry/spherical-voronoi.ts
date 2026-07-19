/**
 * Spherical Voronoi diagram — a consumer of the 3-D convex hull.
 *
 * For points on a sphere, the convex hull of the points IS the spherical
 * Delaunay triangulation; the Voronoi vertices are the circumcenters of the
 * hull facets projected onto the sphere (equivalently, the facet normals scaled
 * to the sphere radius). `sphericalVoronoi` returns those vertices, each
 * generator's region (as an ordered ring of vertex indices), and the geodesic
 * area of each region.
 *
 * Pinned against `scipy.spatial.SphericalVoronoi` (vertex count `= 2N − 4` and
 * region areas summing to `4πr²`) in
 * `functions/tests/geometry-consumers-oracle.test.ts`.
 *
 * @packageDocumentation
 */

import { convexHull3D } from '../typed/geometry.js';

/** Structured spherical-Voronoi result (mirrors `scipy.spatial.SphericalVoronoi`). */
export interface SphericalVoronoiResult {
  /** Voronoi vertices on the sphere (the hull facets' circumcenters). */
  vertices: number[][];
  /**
   * Per input point: the ordered ring of vertex indices (into
   * {@link SphericalVoronoiResult.vertices}) bounding that generator's cell.
   */
  regions: number[][];
  /** Per input point: the geodesic (surface) area of its Voronoi cell. */
  areas: number[];
}

function sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: number[]): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize(a: number[]): number[] {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** Geodesic (great-circle) angle between two unit vectors, numerically robust. */
function geodesicAngle(u: number[], v: number[]): number {
  return Math.atan2(norm(cross(u, v)), dot(u, v));
}

/**
 * Area of a spherical triangle on the unit sphere given its three (unit)
 * vertices, via l'Huilier's theorem (the spherical excess E).
 */
function sphericalTriangleArea(a: number[], b: number[], c: number[]): number {
  const A = geodesicAngle(b, c);
  const B = geodesicAngle(a, c);
  const C = geodesicAngle(a, b);
  const s = (A + B + C) / 2;
  const t = Math.tan(s / 2) * Math.tan((s - A) / 2) * Math.tan((s - B) / 2) * Math.tan((s - C) / 2);
  return 4 * Math.atan(Math.sqrt(Math.max(0, t)));
}

/**
 * Spherical Voronoi diagram of points on a sphere.
 *
 * @param points - Array of `[x, y, z]` points on (or near) the sphere. At least
 *   4 points, not all coplanar with the centre.
 * @param radius - Sphere radius (default `1`).
 * @param center - Sphere centre (default origin).
 * @returns A {@link SphericalVoronoiResult}.
 * @throws When given fewer than 4 points or a non-3-D point set.
 */
export function sphericalVoronoi(
  points: number[][],
  radius = 1,
  center: number[] = [0, 0, 0]
): SphericalVoronoiResult {
  if (!Array.isArray(points) || points.length < 4) {
    throw new Error('sphericalVoronoi: requires at least 4 points');
  }
  if (points[0].length !== 3) {
    throw new Error('sphericalVoronoi: only 3-D point sets are supported');
  }

  // Unit directions of the generators from the centre.
  const gen = points.map((p) => normalize(sub(p, center)));
  const faces = convexHull3D(points);

  // One Voronoi vertex per hull facet: the outward facet normal, scaled to the
  // sphere. Record, per generator, the incident facets (→ its region ring).
  const vertices: number[][] = [];
  const vertDir: number[][] = []; // unit direction of each vertex from centre
  const incident: number[][] = Array.from({ length: points.length }, () => []);
  faces.forEach((f, fi) => {
    const a = gen[f[0]];
    const b = gen[f[1]];
    const c = gen[f[2]];
    let nrm = cross(sub(b, a), sub(c, a));
    // Orient outward (away from the sphere centre).
    if (dot(nrm, a) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
    const dir = normalize(nrm);
    vertDir.push(dir);
    vertices.push([
      center[0] + radius * dir[0],
      center[1] + radius * dir[1],
      center[2] + radius * dir[2],
    ]);
    for (const p of f) incident[p].push(fi);
  });

  const regions: number[][] = [];
  const areas: number[] = [];
  for (let g = 0; g < points.length; g++) {
    const gdir = gen[g];
    const facs = incident[g];
    // Order the incident facets (→ ring of Voronoi vertices) by azimuth in the
    // tangent plane at the generator.
    let ref: number[] | null = null;
    const withAngle = facs.map((fi) => {
      const d = vertDir[fi];
      const tang = normalize(
        sub(d, [gdir[0] * dot(d, gdir), gdir[1] * dot(d, gdir), gdir[2] * dot(d, gdir)])
      );
      if (ref === null) {
        ref = tang;
        return { fi, ang: 0 };
      }
      const x = dot(tang, ref);
      const y = dot(cross(gdir, ref), tang);
      let ang = Math.atan2(y, x);
      if (ang < 0) ang += 2 * Math.PI;
      return { fi, ang };
    });
    withAngle.sort((p, q) => p.ang - q.ang);
    const ring = withAngle.map((w) => w.fi);
    regions.push(ring);

    // Geodesic area: fan of spherical triangles (generator, v_k, v_{k+1}).
    let area = 0;
    for (let k = 0; k < ring.length; k++) {
      const v1 = vertDir[ring[k]];
      const v2 = vertDir[ring[(k + 1) % ring.length]];
      area += sphericalTriangleArea(gdir, v1, v2);
    }
    areas.push(area * radius * radius);
  }

  return { vertices, regions, areas };
}
