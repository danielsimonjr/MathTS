/**
 * 3-D ray/segment intersection tests (geometry breadth follow-up): ray↔triangle
 * (Möller–Trumbore), ray↔plane, and closest-points-between-two-segments.
 *
 * Points/vectors are plain `number[]` of length 3, matching the convention
 * used throughout `../typed/geometry.ts` and `intersect.ts`.
 *
 * @packageDocumentation
 */

const EPS = 1e-12;

function sub(a: readonly number[], b: readonly number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: readonly number[], b: readonly number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: readonly number[], s: number): number[] {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: readonly number[], b: readonly number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Result of {@link rayTriangleIntersect} / {@link rayPlaneIntersect}: the hit point and ray parameter `t`. */
export interface RayHit {
  /** Point of intersection: `origin + t·dir`. */
  point: number[];
  /** Ray parameter at the hit (distance along `dir`, when `dir` is unit length). */
  t: number;
}

/**
 * Ray↔triangle intersection via the Möller–Trumbore algorithm. Returns the
 * hit point and ray parameter `t`, or `null` if the ray misses the triangle,
 * is parallel to its plane, or the hit is behind the ray origin (`t < 0`).
 *
 * @example
 * rayTriangleIntersect([0.25, 0.25, -1], [0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0])
 * // { point: [0.25, 0.25, 0], t: 1 }
 */
export function rayTriangleIntersect(
  origin: readonly number[],
  dir: readonly number[],
  v0: readonly number[],
  v1: readonly number[],
  v2: readonly number[]
): RayHit | null {
  const e1 = sub(v1, v0);
  const e2 = sub(v2, v0);
  const pvec = cross(dir, e2);
  const det = dot(e1, pvec);
  if (Math.abs(det) < EPS) return null; // ray parallel to the triangle's plane

  const invDet = 1 / det;
  const tvec = sub(origin, v0);
  const u = dot(tvec, pvec) * invDet;
  if (u < 0 || u > 1) return null;

  const qvec = cross(tvec, e1);
  const v = dot(dir, qvec) * invDet;
  if (v < 0 || u + v > 1) return null;

  const t = dot(e2, qvec) * invDet;
  if (t < 0) return null; // triangle is behind the ray origin

  return { point: add(origin, scale(dir, t)), t };
}

/**
 * Ray↔plane intersection. The plane is given by a point on it and its normal.
 * Returns the hit point and ray parameter `t`, or `null` if the ray is
 * parallel to the plane.
 *
 * @example
 * rayPlaneIntersect([0, 0, -1], [0, 0, 1], [0, 0, 0], [0, 0, 1])
 * // { point: [0, 0, 0], t: 1 }
 */
export function rayPlaneIntersect(
  origin: readonly number[],
  dir: readonly number[],
  planePoint: readonly number[],
  planeNormal: readonly number[]
): RayHit | null {
  const denom = dot(dir, planeNormal);
  if (Math.abs(denom) < EPS) return null; // ray parallel to the plane
  const t = dot(sub(planePoint, origin), planeNormal) / denom;
  return { point: add(origin, scale(dir, t)), t };
}

/** Result of {@link segmentSegmentClosest}: the closest point on each segment and their distance. */
export interface SegmentClosestResult {
  /** Closest point on segment `[p1, p2]`. */
  point1: number[];
  /** Closest point on segment `[q1, q2]`. */
  point2: number[];
  /** Euclidean distance between `point1` and `point2`. */
  distance: number;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Closest points between two 3-D line segments `[p1, p2]` and `[q1, q2]`
 * (Ericson, *Real-Time Collision Detection*, `ClosestPtSegmentSegment`).
 * Returns the closest point on each segment and the distance between them
 * (`0` when the segments intersect).
 *
 * @example
 * segmentSegmentClosest([0,0,0], [1,1,0], [0,1,0], [1,0,0])
 * // { point1: [0.5, 0.5, 0], point2: [0.5, 0.5, 0], distance: 0 }
 */
export function segmentSegmentClosest(
  p1: readonly number[],
  p2: readonly number[],
  q1: readonly number[],
  q2: readonly number[]
): SegmentClosestResult {
  const d1 = sub(p2, p1); // direction of segment 1
  const d2 = sub(q2, q1); // direction of segment 2
  const r = sub(p1, q1);

  const a = dot(d1, d1); // squared length of segment 1
  const e = dot(d2, d2); // squared length of segment 2
  const f = dot(d2, r);

  let s: number;
  let t: number;

  if (a <= EPS && e <= EPS) {
    // Both segments degenerate to points.
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    // Segment 1 degenerates to a point.
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      // Segment 2 degenerates to a point.
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const point1 = add(p1, scale(d1, s));
  const point2 = add(q1, scale(d2, t));
  const distance = Math.sqrt(dot(sub(point1, point2), sub(point1, point2)));
  return { point1, point2, distance };
}
