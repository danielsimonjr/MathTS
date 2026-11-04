/**
 * Curves, point-set distances and enclosing shapes (Gap-analysis 2026-11-04 Batch E10).
 *
 * Douglas-Peucker simplification, Hausdorff and discrete Fréchet distances,
 * closest pair (divide and conquer), minimum enclosing circle (Welzl), Catmull-Rom
 * splines, arc length and curvature of parametric planar curves.
 */
import { distance2D, distancePointToLine2D } from '../typed/geometry.js';
import { quad } from '../numeric/adaptive-quad.js';

/** A planar point [x, y]. */
import type { Pt } from './predicates.js';
export type { Pt };

const dist = (a: Pt, b: Pt): number => distance2D([a[0], a[1]], [b[0], b[1]]);
const segDist = (p: Pt, a: Pt, b: Pt): number =>
  distancePointToLine2D([p[0], p[1]], [a[0], a[1]], [b[0], b[1]]);

/**
 * Ramer-Douglas-Peucker polyline simplification: keeps the first and last points
 * and recursively keeps the point farthest from the current chord while it is
 * farther than epsilon.
 */
export function douglasPeucker(points: readonly Pt[], epsilon: number): Pt[] {
  const n = points.length;
  if (n <= 2) return points.map((p) => [p[0], p[1]]);
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop() as [number, number];
    let worst = -1;
    let worstD = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist(points[i], points[lo], points[hi]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0 && worstD > epsilon) {
      keep[worst] = true;
      stack.push([lo, worst], [worst, hi]);
    }
  }
  return points.filter((_, i) => keep[i]).map((p) => [p[0], p[1]]);
}

/** Directed Hausdorff distance: max over a of the distance to the nearest point of b. */
function directedHausdorff(a: readonly Pt[], b: readonly Pt[]): number {
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) best = Math.min(best, dist(p, q));
    worst = Math.max(worst, best);
  }
  return worst;
}

/** Symmetric Hausdorff distance between two finite point sets. */
export function hausdorffDistance(a: readonly Pt[], b: readonly Pt[]): number {
  if (a.length === 0 || b.length === 0) throw new RangeError('hausdorffDistance: empty set');
  return Math.max(directedHausdorff(a, b), directedHausdorff(b, a));
}

/** Discrete Fréchet distance between two polylines (Eiter & Mannila dynamic program). */
export function frechetDistance(p: readonly Pt[], q: readonly Pt[]): number {
  const n = p.length;
  const m = q.length;
  if (n === 0 || m === 0) throw new RangeError('frechetDistance: empty curve');
  const ca: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const d = dist(p[i], q[j]);
      if (i === 0 && j === 0) ca[i][j] = d;
      else if (i === 0) ca[i][j] = Math.max(ca[0][j - 1], d);
      else if (j === 0) ca[i][j] = Math.max(ca[i - 1][0], d);
      else ca[i][j] = Math.max(Math.min(ca[i - 1][j], ca[i - 1][j - 1], ca[i][j - 1]), d);
    }
  }
  return ca[n - 1][m - 1];
}

/**
 * Closest pair of points by divide and conquer, O(n log n). Returns the indices
 * (i < j) into `points` and their distance.
 *
 * @throws RangeError if fewer than two points are given
 */
export function closestPair(points: readonly Pt[]): { i: number; j: number; distance: number } {
  const n = points.length;
  if (n < 2) throw new RangeError('closestPair: need at least two points');
  // Work on indices sorted by x; `order` maps sorted position -> original index.
  const order = Array.from({ length: n }, (_, k) => k).sort(
    (a, b) => points[a][0] - points[b][0] || points[a][1] - points[b][1]
  );
  type Best = { i: number; j: number; d: number };
  const pairDist = (a: number, b: number): Best => {
    const i = Math.min(order[a], order[b]);
    const j = Math.max(order[a], order[b]);
    return { i, j, d: dist(points[i], points[j]) };
  };
  const better = (x: Best, y: Best): Best => (y.d < x.d ? y : x);

  // Returns the best pair in [lo, hi) and the sorted-by-y positions of that range.
  const rec = (lo: number, hi: number): { best: Best; ys: number[] } => {
    if (hi - lo <= 3) {
      let best: Best = { i: -1, j: -1, d: Infinity };
      for (let a = lo; a < hi; a++)
        for (let b = a + 1; b < hi; b++) best = better(best, pairDist(a, b));
      const ys = Array.from({ length: hi - lo }, (_, k) => lo + k).sort(
        (a, b) => points[order[a]][1] - points[order[b]][1]
      );
      return { best, ys };
    }
    const mid = (lo + hi) >> 1;
    const L = rec(lo, mid);
    const R = rec(mid, hi);
    let best = better(L.best, R.best);
    // Merge the two y-sorted halves.
    const ys: number[] = [];
    let x = 0;
    let y = 0;
    while (x < L.ys.length || y < R.ys.length) {
      if (
        y >= R.ys.length ||
        (x < L.ys.length && points[order[L.ys[x]]][1] <= points[order[R.ys[y]]][1])
      )
        ys.push(L.ys[x++]);
      else ys.push(R.ys[y++]);
    }
    const midX = points[order[mid]][0];
    const strip = ys.filter((p) => Math.abs(points[order[p]][0] - midX) < best.d);
    for (let a = 0; a < strip.length; a++) {
      for (let b = a + 1; b < strip.length; b++) {
        if (points[order[strip[b]]][1] - points[order[strip[a]]][1] >= best.d) break;
        best = better(best, pairDist(strip[a], strip[b]));
      }
    }
    return { best, ys };
  };
  const { best } = rec(0, n);
  return { i: best.i, j: best.j, distance: best.d };
}

/** Circle through two points (diameter) or three points (circumcircle). */
type Circle = { cx: number; cy: number; r: number };
const circleFrom2 = (a: Pt, b: Pt): Circle => ({
  cx: (a[0] + b[0]) / 2,
  cy: (a[1] + b[1]) / 2,
  r: dist(a, b) / 2,
});
function circleFrom3(a: Pt, b: Pt, c: Pt): Circle {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const cx = c[0] - a[0];
  const cy = c[1] - a[1];
  const d = 2 * (bx * cy - by * cx);
  if (d === 0) {
    // Collinear: the enclosing circle is the one on the two farthest points.
    const pairs: Array<[Pt, Pt]> = [
      [a, b],
      [a, c],
      [b, c],
    ];
    let best = circleFrom2(pairs[0][0], pairs[0][1]);
    for (const [p, q] of pairs) {
      const cand = circleFrom2(p, q);
      if (cand.r > best.r) best = cand;
    }
    return best;
  }
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d;
  const uy = (bx * c2 - cx * b2) / d;
  return { cx: a[0] + ux, cy: a[1] + uy, r: Math.hypot(ux, uy) };
}
const inside = (c: Circle, p: Pt): boolean =>
  Math.hypot(p[0] - c.cx, p[1] - c.cy) <= c.r * (1 + 1e-12) + 1e-12;

/**
 * Smallest enclosing circle of a planar point set (Welzl's algorithm, iterative
 * form with the move-to-front-free triple loop).
 */
export function minimumEnclosingCircle(points: readonly Pt[]): { center: Pt; radius: number } {
  if (points.length === 0) throw new RangeError('minimumEnclosingCircle: empty point set');
  const P = points.map((p) => [p[0], p[1]]);
  let c: Circle = { cx: P[0][0], cy: P[0][1], r: 0 };
  for (let i = 1; i < P.length; i++) {
    if (inside(c, P[i])) continue;
    c = { cx: P[i][0], cy: P[i][1], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inside(c, P[j])) continue;
      c = circleFrom2(P[i], P[j]);
      for (let k = 0; k < j; k++) {
        if (inside(c, P[k])) continue;
        c = circleFrom3(P[i], P[j], P[k]);
      }
    }
  }
  return { center: [c.cx, c.cy], radius: c.r };
}

/**
 * Centripetal (alpha = 0.5 by default) Catmull-Rom segment between p1 and p2,
 * evaluated at t in [0, 1] by the Barry-Goldman pyramid. alpha = 0 is uniform.
 */
export function catmullRom(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number, alpha = 0.5): Pt {
  const knot = (ti: number, a: Pt, b: Pt): number => {
    const d = dist(a, b);
    return ti + (d === 0 && alpha > 0 ? 1e-12 : Math.pow(d, alpha));
  };
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  const u = t1 + t * (t2 - t1);
  const lerp = (ta: number, tb: number, a: Pt, b: Pt, w: number): [number, number] => {
    const s = (w - ta) / (tb - ta);
    return [(1 - s) * a[0] + s * b[0], (1 - s) * a[1] + s * b[1]];
  };
  const A1 = lerp(t0, t1, p0, p1, u);
  const A2 = lerp(t1, t2, p1, p2, u);
  const A3 = lerp(t2, t3, p2, p3, u);
  const B1 = lerp(t0, t2, A1, A2, u);
  const B2 = lerp(t1, t3, A2, A3, u);
  return lerp(t1, t2, B1, B2, u);
}

/** Arc length of a parametric planar curve over [a, b], integrating |r'(t)| by adaptive quadrature. */
export function arcLength(curve: (t: number) => Pt, a: number, b: number): number {
  const h = 1e-6;
  const speed = (t: number): number => {
    const p = curve(t + h);
    const m = curve(t - h);
    return Math.hypot((p[0] - m[0]) / (2 * h), (p[1] - m[1]) / (2 * h));
  };
  return quad(speed, a, b, { tol: 1e-12 }).value;
}

/**
 * Signed-magnitude curvature kappa = |x'y'' - y'x''| / (x'^2 + y'^2)^(3/2) at t,
 * with derivatives by central differences of step h.
 */
export function curvature(curve: (t: number) => Pt, t: number, h = 1e-4): number {
  const p2 = curve(t + h);
  const p1 = curve(t - h);
  const p0 = curve(t);
  const x1 = (p2[0] - p1[0]) / (2 * h);
  const y1 = (p2[1] - p1[1]) / (2 * h);
  const x2 = (p2[0] - 2 * p0[0] + p1[0]) / (h * h);
  const y2 = (p2[1] - 2 * p0[1] + p1[1]) / (h * h);
  const speed2 = x1 * x1 + y1 * y1;
  if (speed2 === 0) return NaN;
  return Math.abs(x1 * y2 - y1 * x2) / Math.pow(speed2, 1.5);
}
