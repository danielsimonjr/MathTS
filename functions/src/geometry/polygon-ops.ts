/**
 * Polygon operations (Gap-analysis 2026-11-04 Batch E9): Sutherland-Hodgman
 * clipping, Minkowski sum of convex polygons and ear-clipping triangulation.
 */
import { convexHull2D } from '../typed/geometry.js';
import { orient2D, type Pt } from './predicates.js';

/** Signed shoelace area; positive for counter-clockwise order. */
function signedArea(poly: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/**
 * Clip the subject polygon by a convex clip polygon (Sutherland-Hodgman). The
 * clip polygon may be given in either orientation.
 */
export function polygonClip(subject: readonly Pt[], clipConvex: readonly Pt[]): Pt[] {
  const clip = signedArea(clipConvex) < 0 ? clipConvex.slice().reverse() : clipConvex.slice();
  let output: Pt[] = subject.map((p) => [p[0], p[1]]);
  for (let e = 0; e < clip.length && output.length > 0; e++) {
    const A = clip[e];
    const B = clip[(e + 1) % clip.length];
    const input = output;
    output = [];
    const inside = (p: Pt): boolean => orient2D(A, B, p) >= 0;
    const intersect = (P: Pt, Q: Pt): Pt => {
      const x1 = A[0];
      const y1 = A[1];
      const x2 = B[0];
      const y2 = B[1];
      const dxc = x1 - x2;
      const dyc = y1 - y2;
      const dxp = P[0] - Q[0];
      const dyp = P[1] - Q[1];
      const n1 = x1 * y2 - y1 * x2;
      const n2 = P[0] * Q[1] - P[1] * Q[0];
      const den = dxc * dyp - dyc * dxp;
      return [(n1 * dxp - n2 * dxc) / den, (n1 * dyp - n2 * dyc) / den];
    };
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) output.push(intersect(prev, cur));
        output.push([cur[0], cur[1]]);
      } else if (inside(prev)) {
        output.push(intersect(prev, cur));
      }
    }
  }
  return output;
}

/**
 * Minkowski sum of two convex polygons, returned as the convex hull (CCW) of all
 * pairwise vertex sums.
 */
export function minkowskiSum(a: readonly Pt[], b: readonly Pt[]): Pt[] {
  const sums: number[][] = [];
  for (const p of a) for (const q of b) sums.push([p[0] + q[0], p[1] + q[1]]);
  return convexHull2D(sums);
}

/**
 * Triangulate a simple polygon by ear clipping. Returns triangles as vertex
 * index triples into the input array, oriented like the input polygon.
 *
 * @throws Error if no ear can be found (non-simple or degenerate input)
 */
export function earClipping(poly: readonly Pt[]): Array<[number, number, number]> {
  const n = poly.length;
  const ccw = signedArea(poly) >= 0;
  const idx: number[] = Array.from({ length: n }, (_, i) => i);
  const tris: Array<[number, number, number]> = [];
  const cross = (o: Pt, a: Pt, b: Pt): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const coincides = (p: Pt, q: Pt): boolean => p[0] === q[0] && p[1] === q[1];
  // Closed-triangle test: a reflex vertex lying on a candidate diagonal blocks the ear.
  const pointIn = (p: Pt, a: Pt, b: Pt, c: Pt): boolean =>
    !coincides(p, a) &&
    !coincides(p, b) &&
    !coincides(p, c) &&
    cross(a, b, p) >= 0 &&
    cross(b, c, p) >= 0 &&
    cross(c, a, p) >= 0;

  while (idx.length > 3) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const pi = idx[(k + idx.length - 1) % idx.length];
      const ci = idx[k];
      const ni = idx[(k + 1) % idx.length];
      const P = poly[pi];
      const C = poly[ci];
      const N = poly[ni];
      if (cross(P, C, N) <= 0) continue; // reflex or flat in CCW sense
      let blocked = false;
      for (const j of idx) {
        if (j === pi || j === ci || j === ni) continue;
        if (pointIn(poly[j], P, C, N)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      tris.push(ccw ? [pi, ci, ni] : [ni, ci, pi]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error('earClipping: no ear found; polygon may not be simple');
  }
  if (idx.length === 3 && cross(poly[idx[0]], poly[idx[1]], poly[idx[2]]) !== 0) {
    tris.push(ccw ? [idx[0], idx[1], idx[2]] : [idx[2], idx[1], idx[0]]);
  }
  return tris;
}
