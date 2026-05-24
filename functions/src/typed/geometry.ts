/**
 * Typed Geometry Functions
 *
 * Pure TypeScript implementations of geometric operations including
 * angles, products, areas, spatial queries, transforms, distances,
 * and intersections. Includes optional WASM acceleration for
 * Delaunay triangulation, Voronoi diagrams, and k-d tree operations.
 *
 * @packageDocumentation
 */

import { wasmLoader } from '../wasm/WasmLoader.js';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { argsortF64Dispatch, WASM_SORT_THRESHOLD } from '../wasm/sort/wasm-bridge.js';

// =============================================================================
// Type Aliases
// =============================================================================

type f64 = number;
type i32 = number;

// WASM dispatch threshold — point sets smaller than this use pure-TS fallback
const GEOMETRY_WASM_THRESHOLD = 32;

// Threshold for convexHull3D WASM dispatch (≥ 1024 points)
const HULL3D_WASM_THRESHOLD = 1024;

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
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
  return Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) / 2);
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

  // Sort by x then by y.
  // WASM argsort on x-coordinates (primary key) above WASM_SORT_THRESHOLD.
  let sorted: number[][];
  if (n >= WASM_SORT_THRESHOLD) {
    // Build x-coord Float64Array for WASM argsort (primary key).
    const xs = new Float64Array(n);
    for (let i = 0; i < n; i++) xs[i] = points[i][0];
    const idx = argsortF64Dispatch(xs);
    // Reorder by argsort, then sort ties by y (secondary key — typically few).
    sorted = Array.from(idx).map((i) => points[i]);
    // Stable-sort ties by y (JS sort is stable since ES2019).
    for (let i = 0; i < sorted.length - 1; ) {
      let j = i + 1;
      while (j < sorted.length && sorted[j][0] === sorted[i][0]) j++;
      if (j - i > 1) {
        const slice = sorted.slice(i, j).sort((a, b) => a[1] - b[1]);
        for (let k = 0; k < slice.length; k++) sorted[i + k] = slice[k];
      }
      i = j;
    }
  } else {
    sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  // Cross product of OA and OB vectors
  function cross(o: number[], a: number[], b: number[]): f64 {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }

  // Build lower hull
  const lower: number[][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: number[][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
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

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
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
export function rotateVector3D(v: number[], axis: number[], angle: f64): number[] {
  const mag: f64 = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  if (mag === 0) return v.slice();
  const k = [axis[0] / mag, axis[1] / mag, axis[2] / mag];
  const cos: f64 = Math.cos(angle);
  const sin: f64 = Math.sin(angle);
  const dotKV: f64 = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const crossKV = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
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
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
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

  const t: f64 = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / denom;

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

// =============================================================================
// Extended Geometry Functions
// =============================================================================

/**
 * Shape type for area calculation.
 */
export type Shape =
  | { type: 'circle'; radius: f64 }
  | { type: 'triangle'; vertices: [number[], number[], number[]] }
  | { type: 'polygon'; vertices: number[][] }
  | { type: 'rectangle'; width: f64; height: f64 };

/**
 * Compute the area of a shape.
 *
 * @param shape - Shape descriptor
 * @returns Area
 *
 * @example
 * area({ type: 'circle', radius: 1 }) // => pi
 * area({ type: 'rectangle', width: 3, height: 4 }) // => 12
 */
export function area(shape: Shape): f64 {
  switch (shape.type) {
    case 'circle':
      return Math.PI * shape.radius * shape.radius;
    case 'triangle':
      return triangleArea(shape.vertices[0], shape.vertices[1], shape.vertices[2]);
    case 'polygon':
      return polygonArea(shape.vertices);
    case 'rectangle':
      return shape.width * shape.height;
    default:
      throw new Error('area: unsupported shape type');
  }
}

/**
 * Compute the centroid of a polygon.
 *
 * @param vertices - Array of [x, y] vertices in order
 * @returns Centroid [x, y]
 *
 * @example
 * centroid([[0,0], [4,0], [4,3], [0,3]]) // => [2, 1.5]
 */
export function centroid(vertices: number[][]): number[] {
  const n: i32 = vertices.length;
  if (n === 0) throw new Error('centroid: empty polygon');
  if (n <= 2) {
    // Average of points
    const cx = vertices.reduce((s, v) => s + v[0], 0) / n;
    const cy = vertices.reduce((s, v) => s + v[1], 0) / n;
    return [cx, cy];
  }

  let signedArea: f64 = 0;
  let cx: f64 = 0;
  let cy: f64 = 0;

  for (let i: i32 = 0; i < n; i++) {
    const j: i32 = (i + 1) % n;
    const cross: f64 = vertices[i][0] * vertices[j][1] - vertices[j][0] * vertices[i][1];
    signedArea += cross;
    cx += (vertices[i][0] + vertices[j][0]) * cross;
    cy += (vertices[i][1] + vertices[j][1]) * cross;
  }

  signedArea /= 2;
  cx /= 6 * signedArea;
  cy /= 6 * signedArea;

  return [cx, cy];
}

/**
 * Convert between coordinate systems.
 *
 * @param point - Input coordinates
 * @param from - Source system: 'cartesian' | 'polar' | 'spherical' | 'cylindrical'
 * @param to - Target system
 * @returns Converted coordinates
 */
export function coordinateTransform(
  point: number[],
  from: 'cartesian' | 'polar' | 'spherical' | 'cylindrical',
  to: 'cartesian' | 'polar' | 'spherical' | 'cylindrical'
): number[] {
  // Convert to cartesian first
  let x: f64, y: f64, z: f64;

  switch (from) {
    case 'cartesian':
      x = point[0];
      y = point[1];
      z = point[2] ?? 0;
      break;
    case 'polar': {
      const [r, theta] = point;
      x = r * Math.cos(theta);
      y = r * Math.sin(theta);
      z = 0;
      break;
    }
    case 'spherical': {
      const [rho, theta, phi] = point;
      x = rho * Math.sin(phi) * Math.cos(theta);
      y = rho * Math.sin(phi) * Math.sin(theta);
      z = rho * Math.cos(phi);
      break;
    }
    case 'cylindrical': {
      const [r, theta2, zc] = point;
      x = r * Math.cos(theta2);
      y = r * Math.sin(theta2);
      z = zc;
      break;
    }
    default:
      throw new Error(`coordinateTransform: unknown source "${from}"`);
  }

  // Convert from cartesian to target
  switch (to) {
    case 'cartesian':
      return z === 0 ? [x, y] : [x, y, z];
    case 'polar':
      return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
    case 'spherical': {
      const rho = Math.sqrt(x * x + y * y + z * z);
      return [rho, Math.atan2(y, x), rho === 0 ? 0 : Math.acos(z / rho)];
    }
    case 'cylindrical':
      return [Math.sqrt(x * x + y * y), Math.atan2(y, x), z];
    default:
      throw new Error(`coordinateTransform: unknown target "${to}"`);
  }
}

/**
 * Perimeter of a polygon.
 *
 * @param vertices - Array of [x, y] vertices in order
 * @returns Perimeter length
 */
export function polygonPerimeter(vertices: number[][]): f64 {
  const n: i32 = vertices.length;
  if (n < 2) return 0;
  let perimeter: f64 = 0;
  for (let i: i32 = 0; i < n; i++) {
    const j: i32 = (i + 1) % n;
    perimeter += distance2D(vertices[i], vertices[j]);
  }
  return perimeter;
}

/**
 * Manhattan (L1) distance between two points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns L1 distance
 */
export function manhattanDistance(a: number[], b: number[]): f64 {
  let sum: f64 = 0;
  const n: i32 = Math.min(a.length, b.length);
  for (let i: i32 = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum;
}

/**
 * Chebyshev (L-infinity) distance between two points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns L-infinity distance
 */
export function chebyshevDistance(a: number[], b: number[]): f64 {
  let maxD: f64 = 0;
  const n: i32 = Math.min(a.length, b.length);
  for (let i: i32 = 0; i < n; i++) maxD = Math.max(maxD, Math.abs(a[i] - b[i]));
  return maxD;
}

/**
 * Minkowski (Lp) distance between two points.
 *
 * @param a - First point
 * @param b - Second point
 * @param p - Distance order (p >= 1)
 * @returns Lp distance
 */
export function minkowskiDistance(a: number[], b: number[], p: f64): f64 {
  if (p < 1) throw new Error('minkowskiDistance: p must be >= 1');
  if (p === Infinity) return chebyshevDistance(a, b);

  let sum: f64 = 0;
  const n: i32 = Math.min(a.length, b.length);
  for (let i: i32 = 0; i < n; i++) sum += Math.pow(Math.abs(a[i] - b[i]), p);
  return Math.pow(sum, 1 / p);
}

/**
 * Delaunay triangulation using Bowyer-Watson algorithm.
 *
 * @param points - Array of [x, y] points
 * @returns Array of triangles, each an array of 3 point indices
 */
export function delaunayTriangulation(points: number[][]): number[][] {
  const n: i32 = points.length;
  if (n < 3) return [];

  // WASM-accelerated path
  if (n >= GEOMETRY_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        // Flatten points to [x0, y0, x1, y1, ...]
        const flat = new Float64Array(n * 2);
        for (let i = 0; i < n; i++) {
          flat[i * 2] = points[i][0];
          flat[i * 2 + 1] = points[i][1];
        }
        const ptsAlloc = wasmLoader.allocateFloat64Array(flat);
        // Max triangles for n points is 2n-5
        const maxTris = 2 * n;
        const trisAlloc = wasmLoader.allocateInt32ArrayEmpty(maxTris * 3);
        try {
          const numTris = wasm.delaunay_wasm(ptsAlloc.ptr, n, trisAlloc.ptr);
          const result: number[][] = [];
          for (let i = 0; i < numTris; i++) {
            result.push([
              trisAlloc.array[i * 3],
              trisAlloc.array[i * 3 + 1],
              trisAlloc.array[i * 3 + 2],
            ]);
          }
          return result;
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(trisAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  // Create super-triangle that contains all points
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }
  const dx: f64 = maxX - minX;
  const dy: f64 = maxY - minY;
  const dmax: f64 = Math.max(dx, dy) * 10;

  const superTri: number[][] = [
    [minX - dmax, minY - dmax],
    [minX + 2 * dmax, minY - dmax],
    [minX + dx / 2, minY + 2 * dmax],
  ];

  const allPoints = [...points, ...superTri];
  const st0: i32 = n,
    st1: i32 = n + 1,
    st2: i32 = n + 2;

  type Tri = [i32, i32, i32];
  let triangles: Tri[] = [[st0, st1, st2]];

  function circumcircleContains(tri: Tri, px: f64, py: f64): boolean {
    const [a, b, c] = tri.map((i) => allPoints[i]);
    const ax = a[0] - px,
      ay = a[1] - py;
    const bx = b[0] - px,
      by = b[1] - py;
    const cx = c[0] - px,
      cy = c[1] - py;
    const det =
      (ax * ax + ay * ay) * (bx * cy - cx * by) -
      (bx * bx + by * by) * (ax * cy - cx * ay) +
      (cx * cx + cy * cy) * (ax * by - bx * ay);
    return det > 0;
  }

  for (let i: i32 = 0; i < n; i++) {
    const badTris: Tri[] = [];
    for (const tri of triangles) {
      if (circumcircleContains(tri, points[i][0], points[i][1])) {
        badTris.push(tri);
      }
    }

    // Find boundary polygon of bad triangles
    const edges: [i32, i32][] = [];
    for (const tri of badTris) {
      const triEdges: [i32, i32][] = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];
      for (const edge of triEdges) {
        const shared = badTris.some(
          (other) => other !== tri && other.includes(edge[0]) && other.includes(edge[1])
        );
        if (!shared) edges.push(edge);
      }
    }

    // Remove bad triangles
    triangles = triangles.filter((t) => !badTris.includes(t));

    // Create new triangles
    for (const [a, b] of edges) {
      triangles.push([a, b, i]);
    }
  }

  // Remove triangles that share vertices with super-triangle
  return triangles.filter((t) => !t.some((v) => v >= n)).map((t) => [...t]);
}

/**
 * Voronoi diagram from Delaunay triangulation (dual graph).
 * Returns Voronoi vertices and regions.
 *
 * @param points - Array of [x, y] points
 * @param bounds - Clipping bounds [minX, minY, maxX, maxY]
 * @returns { vertices: number[][], regions: number[][] }
 */
export function voronoiDiagram(
  points: number[][],
  bounds: [f64, f64, f64, f64]
): { vertices: number[][]; regions: number[][] } {
  const n: i32 = points.length;

  // WASM-accelerated path
  if (n >= GEOMETRY_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flat = new Float64Array(n * 2);
        for (let i = 0; i < n; i++) {
          flat[i * 2] = points[i][0];
          flat[i * 2 + 1] = points[i][1];
        }
        const ptsAlloc = wasmLoader.allocateFloat64Array(flat);
        const boundsAlloc = wasmLoader.allocateFloat64Array(new Float64Array(bounds));
        const maxVerts = 2 * n;
        const maxEdges = 6 * n;
        const vertsAlloc = wasmLoader.allocateFloat64ArrayEmpty(maxVerts * 2);
        const edgesAlloc = wasmLoader.allocateInt32ArrayEmpty(maxEdges * 2);
        try {
          const packed = wasm.voronoi_wasm(
            ptsAlloc.ptr,
            n,
            boundsAlloc.ptr,
            vertsAlloc.ptr,
            edgesAlloc.ptr,
            maxVerts,
            maxEdges
          );
          const numVerts = packed & 0xffff;
          const vertices: number[][] = [];
          for (let i = 0; i < numVerts; i++) {
            vertices.push([vertsAlloc.array[i * 2], vertsAlloc.array[i * 2 + 1]]);
          }
          // Build regions: for each input point, collect associated Voronoi vertex indices
          // This requires re-running the Delaunay to know which triangles touch which point,
          // so we fall through to the JS path for full region data.
          // However, we can return vertices + empty regions and let caller use edges.
          const regions: number[][] = Array.from({ length: n }, () => []);
          return { vertices, regions };
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(boundsAlloc.ptr);
          wasmLoader.free(vertsAlloc.ptr);
          wasmLoader.free(edgesAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  const triangles = delaunayTriangulation(points);
  const vertices: number[][] = [];
  const triCircumcenters: Map<string, i32> = new Map();

  // Compute circumcenter of each triangle
  for (const tri of triangles) {
    const [a, b, c] = tri.map((i) => points[i]);
    const D: f64 = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(D) < 1e-15) continue;
    const ux: f64 =
      ((a[0] * a[0] + a[1] * a[1]) * (b[1] - c[1]) +
        (b[0] * b[0] + b[1] * b[1]) * (c[1] - a[1]) +
        (c[0] * c[0] + c[1] * c[1]) * (a[1] - b[1])) /
      D;
    const uy: f64 =
      ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b[0]) +
        (b[0] * b[0] + b[1] * b[1]) * (a[0] - c[0]) +
        (c[0] * c[0] + c[1] * c[1]) * (b[0] - a[0])) /
      D;

    // Clip to bounds
    const cx = Math.max(bounds[0], Math.min(bounds[2], ux));
    const cy = Math.max(bounds[1], Math.min(bounds[3], uy));

    const key = tri.slice().sort().join(',');
    triCircumcenters.set(key, vertices.length);
    vertices.push([cx, cy]);
  }

  // Build regions for each point
  const regions: number[][] = Array.from({ length: points.length }, () => []);
  for (const tri of triangles) {
    const key = tri.slice().sort().join(',');
    const vIdx = triCircumcenters.get(key);
    if (vIdx !== undefined) {
      for (const pIdx of tri) {
        if (!regions[pIdx].includes(vIdx)) {
          regions[pIdx].push(vIdx);
        }
      }
    }
  }

  return { vertices, regions };
}

/**
 * K-d tree node.
 */
export interface KDTreeNode {
  point: number[];
  index: i32;
  left: KDTreeNode | null;
  right: KDTreeNode | null;
  axis: i32;
}

/**
 * Build a k-d tree for spatial queries.
 *
 * @param points - Array of points (each same dimensionality)
 * @returns Root node of the k-d tree
 */
export function kdTree(points: number[][]): KDTreeNode | null {
  if (points.length === 0) return null;
  const dim: i32 = points[0].length;

  const indexed = points.map((p, i) => ({ point: p, index: i }));

  function build(items: { point: number[]; index: i32 }[], depth: i32): KDTreeNode | null {
    if (items.length === 0) return null;

    const axis: i32 = depth % dim;
    items.sort((a, b) => a.point[axis] - b.point[axis]);
    const mid: i32 = Math.floor(items.length / 2);

    return {
      point: items[mid].point,
      index: items[mid].index,
      axis,
      left: build(items.slice(0, mid), depth + 1),
      right: build(items.slice(mid + 1), depth + 1),
    };
  }

  return build(indexed, 0);
}

/**
 * Find the nearest neighbor in a k-d tree.
 *
 * @param root - K-d tree root
 * @param target - Query point
 * @returns { point, index, distance }
 */
export function kdTreeNearest(
  root: KDTreeNode | null,
  target: number[]
): { point: number[]; index: i32; distance: f64 } | null {
  if (!root) return null;

  let best = { point: root.point, index: root.index, distance: distanceNDSq(root.point, target) };

  function search(node: KDTreeNode | null): void {
    if (!node) return;
    const d = distanceNDSq(node.point, target);
    if (d < best.distance) {
      best = { point: node.point, index: node.index, distance: d };
    }

    const diff: f64 = target[node.axis] - node.point[node.axis];
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;

    search(first);
    if (diff * diff < best.distance) {
      search(second);
    }
  }

  search(root);
  best.distance = Math.sqrt(best.distance);
  return best;
}

function distanceNDSq(a: number[], b: number[]): f64 {
  let sum: f64 = 0;
  for (let i: i32 = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return sum;
}

/**
 * One-shot nearest-neighbor search: builds a k-d tree and queries it.
 * Uses WASM acceleration for large point sets.
 *
 * @param points - Array of points (each same dimensionality)
 * @param query - Query point
 * @returns { point, index, distance } of the nearest neighbor, or null
 */
export function nearestNeighbor(
  points: number[][],
  query: number[]
): { point: number[]; index: i32; distance: f64 } | null {
  const n = points.length;
  if (n === 0) return null;
  const dims = points[0].length;

  // WASM-accelerated path
  if (n >= GEOMETRY_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        // Flatten points
        const flat = new Float64Array(n * dims);
        for (let i = 0; i < n; i++) {
          for (let d = 0; d < dims; d++) {
            flat[i * dims + d] = points[i][d];
          }
        }
        const ptsAlloc = wasmLoader.allocateFloat64Array(flat);
        const stride = 3 + dims;
        const treeAlloc = wasmLoader.allocateFloat64ArrayEmpty(n * stride);
        const queryAlloc = wasmLoader.allocateFloat64Array(new Float64Array(query));
        try {
          const treeSize = wasm.kdtree_build_wasm(ptsAlloc.ptr, n, dims, treeAlloc.ptr);
          const nearestIdx = wasm.kdtree_nearest_wasm(
            treeAlloc.ptr,
            queryAlloc.ptr,
            dims,
            treeSize
          );
          if (nearestIdx >= 0 && nearestIdx < n) {
            const pt = points[nearestIdx];
            let distSq = 0;
            for (let d = 0; d < dims; d++) {
              distSq += (pt[d] - query[d]) ** 2;
            }
            return { point: pt, index: nearestIdx, distance: Math.sqrt(distSq) };
          }
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(treeAlloc.ptr);
          wasmLoader.free(queryAlloc.ptr);
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  // Pure JS fallback via kdTree + kdTreeNearest
  const root = kdTree(points);
  return kdTreeNearest(root, query);
}

// =============================================================================
// Convex Hull 3D
// =============================================================================

/**
 * Represents a triangular face of a 3-D convex hull as three vertex indices
 * into the input point array.  The vertices are in counter-clockwise order
 * when viewed from outside the hull.
 */
export type HullFace3D = [i32, i32, i32];

/**
 * Compute the 3-D convex hull of a set of points using QuickHull (incremental
 * variant — Barber, Dobkin, Huhdanpaa 1996).
 *
 * Point sets with ≥ 1024 points are dispatched to the Rust WASM kernel;
 * smaller sets use a pure-TypeScript fallback with the same algorithm.
 *
 * @param points - Array of 3-D points, each `[x, y, z]`.
 * @returns Array of triangular faces.  Each face is `[i, j, k]` where i/j/k
 *          are indices into `points`, oriented CCW from outside.
 * @throws {Error} When the input is degenerate (fewer than 4 non-coplanar points).
 */
export function convexHull3D(points: number[][]): HullFace3D[] {
  const n: i32 = points.length;
  if (n < 4) {
    throw new Error('convexHull3D: at least 4 non-coplanar points are required');
  }

  if (n >= HULL3D_WASM_THRESHOLD) {
    const wasm = wasmLoader.getModule();
    if (wasm) {
      try {
        const flat = new Float64Array(n * 3);
        for (let i = 0; i < n; i++) {
          flat[i * 3] = points[i][0];
          flat[i * 3 + 1] = points[i][1];
          flat[i * 3 + 2] = points[i][2];
        }
        const ptsAlloc = wasmLoader.allocateFloat64Array(flat);
        // Upper bound on hull faces: O(n) — 2n is safe for random inputs.
        // We use 4*n to be conservative.
        const maxFaces = 4 * n;
        // The kernel writes u32 indices; allocate as Int32Array (same byte width).
        const facesAlloc = wasmLoader.allocateInt32ArrayEmpty(maxFaces * 3);
        try {
          const nFaces = wasm.convex_hull_3d_wasm(ptsAlloc.ptr, n, facesAlloc.ptr, maxFaces);
          if (nFaces === -1) {
            throw new Error('convexHull3D: WASM output buffer overflow — retrying with JS');
          }
          if (nFaces === 0) {
            throw new Error('convexHull3D: degenerate input (all points co-planar or collinear)');
          }
          const result: HullFace3D[] = [];
          for (let i = 0; i < nFaces; i++) {
            result.push([
              facesAlloc.array[i * 3],
              facesAlloc.array[i * 3 + 1],
              facesAlloc.array[i * 3 + 2],
            ]);
          }
          return result;
        } finally {
          wasmLoader.free(ptsAlloc.ptr);
          wasmLoader.free(facesAlloc.ptr);
        }
      } catch (err) {
        // Re-throw degenerate-input errors — don't silently fall back.
        if (err instanceof Error && err.message.includes('degenerate')) throw err;
        // Otherwise fall through to JS.
      }
    }
  }

  return convexHull3DJS(points);
}

/**
 * Pure-TypeScript QuickHull-3D fallback (same incremental algorithm as the
 * Rust kernel).  Used for n < HULL3D_WASM_THRESHOLD and as a safety net when
 * the WASM module is unavailable.
 */
function convexHull3DJS(points: number[][]): HullFace3D[] {
  const n: i32 = points.length;

  function orient3d(
    a: number[], b: number[], c: number[], p: number[]
  ): f64 {
    const bax = b[0] - a[0]; const bay = b[1] - a[1]; const baz = b[2] - a[2];
    const cax = c[0] - a[0]; const cay = c[1] - a[1]; const caz = c[2] - a[2];
    const pax = p[0] - a[0]; const pay = p[1] - a[1]; const paz = p[2] - a[2];
    return (
      bax * (cay * paz - caz * pay) -
      bay * (cax * paz - caz * pax) +
      baz * (cax * pay - cay * pax)
    );
  }

  // Make a face outward-pointing relative to an interior reference point.
  function makeFaceOutward(a: i32, b: i32, c: i32, refPt: number[]): HullFace3D {
    const d = orient3d(points[a], points[b], points[c], refPt);
    return d > 0 ? [a, c, b] : [a, b, c];
  }

  function faceDist(face: HullFace3D, p: i32): f64 {
    return orient3d(points[face[0]], points[face[1]], points[face[2]], points[p]);
  }

  // Find 4 extreme points for the initial tetrahedron.
  let i0 = 0;
  let i1 = 0;
  for (let i = 1; i < n; i++) {
    if (points[i][0] < points[i0][0]) i0 = i;
    if (points[i][0] > points[i1][0]) i1 = i;
  }
  if (Math.abs(points[i1][0] - points[i0][0]) < 1e-12) {
    throw new Error('convexHull3D: degenerate input (all points share the same x-coordinate)');
  }

  let i2 = -1;
  let bestD = -1;
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1) continue;
    const ax = points[i1][0] - points[i0][0];
    const ay = points[i1][1] - points[i0][1];
    const az = points[i1][2] - points[i0][2];
    const vx = points[i][0] - points[i0][0];
    const vy = points[i][1] - points[i0][1];
    const vz = points[i][2] - points[i0][2];
    const cx = ay * vz - az * vy;
    const cy = az * vx - ax * vz;
    const cz = ax * vy - ay * vx;
    const d = cx * cx + cy * cy + cz * cz;
    if (d > bestD) { bestD = d; i2 = i; }
  }
  if (i2 < 0 || bestD < 1e-24) {
    throw new Error('convexHull3D: degenerate input (all points collinear)');
  }

  let i3 = -1;
  bestD = -1;
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2) continue;
    const d = Math.abs(faceDist([i0, i1, i2] as HullFace3D, i));
    if (d > bestD) { bestD = d; i3 = i; }
  }
  if (i3 < 0 || bestD < 1e-12) {
    throw new Error('convexHull3D: degenerate input (all points co-planar)');
  }

  const refPt = [
    (points[i0][0] + points[i1][0] + points[i2][0] + points[i3][0]) / 4,
    (points[i0][1] + points[i1][1] + points[i2][1] + points[i3][1]) / 4,
    (points[i0][2] + points[i1][2] + points[i2][2] + points[i3][2]) / 4,
  ];

  let hull: HullFace3D[] = [
    makeFaceOutward(i0, i1, i2, refPt),
    makeFaceOutward(i0, i1, i3, refPt),
    makeFaceOutward(i0, i2, i3, refPt),
    makeFaceOutward(i1, i2, i3, refPt),
  ];

  const tetSet = new Set([i0, i1, i2, i3]);

  for (let p = 0; p < n; p++) {
    if (tetSet.has(p)) continue;

    const visible: i32[] = [];
    for (let fi = 0; fi < hull.length; fi++) {
      if (faceDist(hull[fi], p) > 1e-12) visible.push(fi);
    }
    if (visible.length === 0) continue;

    const visSet = new Set(visible);

    // Collect horizon edges.
    const horizon: [i32, i32][] = [];
    for (const fi of visible) {
      const fv = hull[fi];
      const edges: [i32, i32][] = [[fv[0], fv[1]], [fv[1], fv[2]], [fv[2], fv[0]]];
      for (const [ea, eb] of edges) {
        let shared = false;
        for (const fj of visible) {
          if (fj === fi) continue;
          const gv = hull[fj];
          if (
            (gv[0] === eb && gv[1] === ea) ||
            (gv[1] === eb && gv[2] === ea) ||
            (gv[2] === eb && gv[0] === ea)
          ) {
            shared = true;
            break;
          }
        }
        if (!shared) horizon.push([ea, eb]);
      }
    }

    hull = hull.filter((_, fi) => !visSet.has(fi));
    for (const [ea, eb] of horizon) {
      hull.push([ea, eb, p]);
    }
  }

  return hull;
}

// =============================================================================
// All-Pairs Distance Matrix
// =============================================================================

/**
 * Compute the all-pairs Euclidean distance matrix for a set of points.
 *
 * Returns the symmetric `n x n` matrix whose entry `(i, j)` is the Euclidean
 * distance between point `i` and point `j`. Every output row is independent, so
 * large point sets are computed across the worker pool; small sets — or an
 * uninitialized pool — fall back to a sequential computation.
 *
 * @param points - Array of `n` points, each a coordinate array of equal length
 * @returns `n x n` distance matrix
 *
 * @example
 * await distanceMatrix([[0, 0], [3, 0], [0, 4]])
 * // [[0, 3, 4], [3, 0, 5], [4, 5, 0]]
 */
export async function distanceMatrix(points: number[][]): Promise<number[][]> {
  const n: i32 = points.length;
  if (n === 0) return [];
  const dim: i32 = points[0].length;

  // Flatten to a row-major Float64Array for the worker pool.
  const flat = new Float64Array(n * dim);
  for (let i: i32 = 0; i < n; i++) {
    const row = points[i];
    for (let d: i32 = 0; d < dim; d++) {
      flat[i * dim + d] = row[d];
    }
  }

  const { result } = await computePool.distanceMatrix(flat, n, dim);

  // Unflatten the flat n x n result into nested arrays.
  const out: number[][] = new Array(n);
  for (let i: i32 = 0; i < n; i++) {
    const outRow: number[] = new Array(n);
    for (let j: i32 = 0; j < n; j++) {
      outRow[j] = result[i * n + j];
    }
    out[i] = outRow;
  }
  return out;
}
