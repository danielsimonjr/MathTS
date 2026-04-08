/**
 * Typed Geometry Functions
 *
 * Pure TypeScript implementations of geometric operations including
 * angles, products, areas, spatial queries, transforms, distances,
 * and intersections.
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Aliases
// =============================================================================

type f64 = number;
type i32 = number;

// =============================================================================
// Angle Functions
// =============================================================================

/**
 * Compute the angle (in radians) between two 2D vectors.
 *
 * @param v1 - First 2D vector
 * @param v2 - Second 2D vector
 * @returns Angle in radians [0, pi]
 */
export function angle2D(v1: number[], v2: number[]): f64 {
  const dot: f64 = v1[0] * v2[0] + v1[1] * v2[1];
  const mag1: f64 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
  const mag2: f64 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
  if (mag1 === 0 || mag2 === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
}

/**
 * Compute the angle (in radians) between two 3D vectors.
 *
 * @param v1 - First 3D vector
 * @param v2 - Second 3D vector
 * @returns Angle in radians [0, pi]
 */
export function angle3D(v1: number[], v2: number[]): f64 {
  const dot: f64 = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag1: f64 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const mag2: f64 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);
  if (mag1 === 0 || mag2 === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
}

// =============================================================================
// Products
// =============================================================================

/**
 * Compute the cross product of two 3D vectors.
 *
 * @param a - First 3D vector
 * @param b - Second 3D vector
 * @returns Cross product vector
 */
export function cross3D(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Compute the dot product of two 3D vectors.
 *
 * @param a - First 3D vector
 * @param b - Second 3D vector
 * @returns Dot product scalar
 */
export function dot3D(a: number[], b: number[]): f64 {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// =============================================================================
// Areas
// =============================================================================

/**
 * Compute the area of a triangle given three 2D vertices using the shoelace formula.
 *
 * @param a - First vertex [x, y]
 * @param b - Second vertex [x, y]
 * @param c - Third vertex [x, y]
 * @returns Unsigned area of the triangle
 */
export function triangleArea(a: number[], b: number[], c: number[]): f64 {
  return Math.abs(
    (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) / 2
  );
}

/**
 * Compute the area of a simple polygon given its vertices (2D) using the shoelace formula.
 * Vertices should be ordered (clockwise or counter-clockwise).
 *
 * @param vertices - Array of [x, y] vertices
 * @returns Unsigned area of the polygon
 */
export function polygonArea(vertices: number[][]): f64 {
  const n: i32 = vertices.length;
  if (n < 3) return 0;
  let area: f64 = 0;
  for (let i: i32 = 0; i < n; i++) {
    const j: i32 = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  return Math.abs(area) / 2;
}

// =============================================================================
// Spatial Queries
// =============================================================================

/**
 * Compute the convex hull of a set of 2D points using Andrew's monotone chain algorithm.
 * Returns vertices in counter-clockwise order.
 *
 * @param points - Array of [x, y] points
 * @returns Convex hull vertices in CCW order
 */
export function convexHull(points: number[][]): number[][] {
  const n: i32 = points.length;
  if (n <= 1) return points.slice();
  if (n === 2) return points.slice();

  // Sort by x then by y
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Cross product of OA and OB vectors
  function cross(o: number[], a: number[], b: number[]): f64 {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }

  // Build lower hull
  const lower: number[][] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: number[][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it is repeated
  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

/**
 * Determine if a 2D point lies inside a polygon using the ray casting algorithm.
 *
 * @param point - The test point [x, y]
 * @param polygon - Array of polygon vertices [x, y]
 * @returns true if point is inside the polygon
 */
export function pointInPolygon(point: number[], polygon: number[][]): boolean {
  const x: f64 = point[0];
  const y: f64 = point[1];
  const n: i32 = polygon.length;
  let inside = false;

  for (let i: i32 = 0, j: i32 = n - 1; i < n; j = i++) {
    const xi: f64 = polygon[i][0];
    const yi: f64 = polygon[i][1];
    const xj: f64 = polygon[j][0];
    const yj: f64 = polygon[j][1];

    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Rotate a 2D vector by a given angle (radians).
 *
 * @param v - The 2D vector [x, y]
 * @param angle - Rotation angle in radians
 * @returns Rotated vector
 */
export function rotateVector2D(v: number[], angle: f64): number[] {
  const cos: f64 = Math.cos(angle);
  const sin: f64 = Math.sin(angle);
  return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos];
}

/**
 * Rotate a 3D vector around an arbitrary axis by a given angle (Rodrigues' formula).
 *
 * @param v - The 3D vector
 * @param axis - The rotation axis (will be normalized)
 * @param angle - Rotation angle in radians
 * @returns Rotated vector
 */
export function rotateVector3D(
  v: number[],
  axis: number[],
  angle: f64
): number[] {
  const mag: f64 = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  if (mag === 0) return v.slice();
  const k = [axis[0] / mag, axis[1] / mag, axis[2] / mag];
  const cos: f64 = Math.cos(angle);
  const sin: f64 = Math.sin(angle);
  const dotKV: f64 = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const crossKV = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  return [
    v[0] * cos + crossKV[0] * sin + k[0] * dotKV * (1 - cos),
    v[1] * cos + crossKV[1] * sin + k[1] * dotKV * (1 - cos),
    v[2] * cos + crossKV[2] * sin + k[2] * dotKV * (1 - cos),
  ];
}

/**
 * Reflect a vector across a plane defined by its normal.
 *
 * @param v - The vector to reflect
 * @param normal - The normal of the reflection plane (will be normalized)
 * @returns Reflected vector
 */
export function reflectVector(v: number[], normal: number[]): number[] {
  const mag: f64 = Math.sqrt(normal.reduce((s, c) => s + c * c, 0));
  if (mag === 0) return v.slice();
  const n = normal.map((c) => c / mag);
  const dot: f64 = v.reduce((s, c, i) => s + c * n[i], 0);
  return v.map((c, i) => c - 2 * dot * n[i]);
}

/**
 * Project vector v onto vector onto.
 *
 * @param v - The vector to project
 * @param onto - The vector to project onto
 * @returns Projected vector
 */
export function projectVector(v: number[], onto: number[]): number[] {
  const dot: f64 = v.reduce((s, c, i) => s + c * onto[i], 0);
  const magSq: f64 = onto.reduce((s, c) => s + c * c, 0);
  if (magSq === 0) return onto.map(() => 0);
  const scale: f64 = dot / magSq;
  return onto.map((c) => c * scale);
}

// =============================================================================
// Distance Functions
// =============================================================================

/**
 * Euclidean distance between two 2D points.
 */
export function distance2D(a: number[], b: number[]): f64 {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
}

/**
 * Euclidean distance between two 3D points.
 */
export function distance3D(a: number[], b: number[]): f64 {
  return Math.sqrt(
    (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2
  );
}

/**
 * Euclidean distance between two N-dimensional points.
 */
export function distanceND(a: number[], b: number[]): f64 {
  let sum: f64 = 0;
  const n: i32 = Math.min(a.length, b.length);
  for (let i: i32 = 0; i < n; i++) {
    sum += (b[i] - a[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Shortest distance from a point to a line segment in 2D.
 *
 * @param point - The point [x, y]
 * @param lineStart - Start of the line segment [x, y]
 * @param lineEnd - End of the line segment [x, y]
 * @returns Distance from point to the line segment
 */
export function distancePointToLine2D(
  point: number[],
  lineStart: number[],
  lineEnd: number[]
): f64 {
  const dx: f64 = lineEnd[0] - lineStart[0];
  const dy: f64 = lineEnd[1] - lineStart[1];
  const lenSq: f64 = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (point)
    return distance2D(point, lineStart);
  }

  // Parameter t of the projection onto the line
  let t: f64 = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = [lineStart[0] + t * dx, lineStart[1] + t * dy];
  return distance2D(point, proj);
}

// =============================================================================
// Intersection Functions
// =============================================================================

/**
 * Find the intersection point of two infinite 2D lines.
 * Each line is defined by a point and a direction vector.
 *
 * @param p1 - Point on line 1
 * @param d1 - Direction of line 1
 * @param p2 - Point on line 2
 * @param d2 - Direction of line 2
 * @returns Intersection point [x, y] or null if parallel
 */
export function intersectLines2D(
  p1: number[],
  d1: number[],
  p2: number[],
  d2: number[]
): number[] | null {
  const denom: f64 = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(denom) < 1e-12) return null; // parallel or coincident

  const t: f64 =
    ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / denom;

  return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

/**
 * Find the intersection point of two 2D line segments.
 *
 * @param a1 - Start of segment A
 * @param a2 - End of segment A
 * @param b1 - Start of segment B
 * @param b2 - End of segment B
 * @returns Intersection point [x, y] or null if segments do not intersect
 */
export function intersectSegments2D(
  a1: number[],
  a2: number[],
  b1: number[],
  b2: number[]
): number[] | null {
  const dAx: f64 = a2[0] - a1[0];
  const dAy: f64 = a2[1] - a1[1];
  const dBx: f64 = b2[0] - b1[0];
  const dBy: f64 = b2[1] - b1[1];

  const denom: f64 = dAx * dBy - dAy * dBx;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t: f64 = ((b1[0] - a1[0]) * dBy - (b1[1] - a1[1]) * dBx) / denom;
  const u: f64 = ((b1[0] - a1[0]) * dAy - (b1[1] - a1[1]) * dAx) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return [a1[0] + t * dAx, a1[1] + t * dAy];
  }

  return null; // no intersection within segments
}
