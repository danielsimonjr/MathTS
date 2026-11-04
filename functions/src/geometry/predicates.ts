/**
 * Geometric predicates (Gap-analysis 2026-11-04 Batch E9).
 *
 * Floating-point sign tests: orientation, in-circle, point-in-triangle,
 * barycentric coordinates and convexity of a polygon.
 */

/** A point as [x, y] (2D) or [x, y, z] (3D). */
export type Pt = readonly number[];

const sign = (x: number): -1 | 0 | 1 => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Sign of the signed area of triangle (a, b, c): +1 counter-clockwise, -1 clockwise, 0 collinear. */
export function orient2D(a: Pt, b: Pt, c: Pt): -1 | 0 | 1 {
  return sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

/**
 * Sign of the determinant of (b - a, c - a, d - a): the orientation of the
 * tetrahedron (a, b, c, d).
 */
export function orient3D(a: Pt, b: Pt, c: Pt, d: Pt): -1 | 0 | 1 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const wx = d[0] - a[0];
  const wy = d[1] - a[1];
  const wz = d[2] - a[2];
  return sign(ux * (vy * wz - vz * wy) - uy * (vx * wz - vz * wx) + uz * (vx * wy - vy * wx));
}

/**
 * In-circle test for the triangle (a, b, c) taken counter-clockwise.
 * Returns +1 if d lies strictly inside the circumcircle, -1 if outside, 0 on it.
 */
export function inCircle(a: Pt, b: Pt, c: Pt, d: Pt): -1 | 0 | 1 {
  const adx = a[0] - d[0];
  const ady = a[1] - d[1];
  const bdx = b[0] - d[0];
  const bdy = b[1] - d[1];
  const cdx = c[0] - d[0];
  const cdy = c[1] - d[1];
  const al = adx * adx + ady * ady;
  const bl = bdx * bdx + bdy * bdy;
  const cl = cdx * cdx + cdy * cdy;
  const det =
    adx * (bdy * cl - bl * cdy) - ady * (bdx * cl - bl * cdx) + al * (bdx * cdy - bdy * cdx);
  return sign(det);
}

/**
 * Barycentric coordinates (u, v, w) of p with respect to triangle (a, b, c), so that
 * p = u a + v b + w c and u + v + w = 1.
 *
 * @throws RangeError if the triangle is degenerate
 */
export function barycentricCoordinates(p: Pt, a: Pt, b: Pt, c: Pt): [number, number, number] {
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (det === 0) throw new RangeError('barycentricCoordinates: degenerate triangle');
  const u = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / det;
  const v = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / det;
  return [u, v, 1 - u - v];
}

/**
 * True if p lies inside or on the boundary of triangle (a, b, c), in either
 * orientation. A degenerate (collinear) triangle contains no points.
 */
export function pointInTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  const o = orient2D(a, b, c);
  if (o === 0) return false;
  const d1 = orient2D(a, b, p);
  const d2 = orient2D(b, c, p);
  const d3 = orient2D(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * True if the polygon is convex: all non-zero turns share one sign, and it has at
 * least three vertices. Collinear vertices are allowed.
 */
export function polygonIsConvex(poly: readonly Pt[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let pos = false;
  let neg = false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const c = poly[(i + 2) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross > 0) pos = true;
    else if (cross < 0) neg = true;
    if (pos && neg) return false;
  }
  return true;
}
