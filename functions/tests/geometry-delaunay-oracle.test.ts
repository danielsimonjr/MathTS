/**
 * Delaunay triangulation — oracle tests.
 *
 * The Delaunay triangulation is not unique on cocircular points, so these tests
 * use implementation-independent invariants (per the oracle-tests memory) plus
 * a triangle-count cross-check against scipy.spatial.Delaunay on a
 * general-position point set (SciPy 1.17.1).
 */

import { describe, it, expect } from 'vitest';
import { delaunay } from '../src/geometry/delaunay.js';
import { convexHull } from '../src/geometry/hull.js';

const RANDOM20_2D = [
  [0.08564916714362436, 0.2368105065960997],
  [0.8012744652063969, 0.5821620360643678],
  [0.09412864224039919, 0.4331269402364738],
  [0.479051298140834, 0.15973891463707857],
  [0.7345771514092145, 0.11367201992140341],
  [0.39122819049566204, 0.5167401826213637],
  [0.4306280204141778, 0.5867985714381407],
  [0.7378377872921602, 0.9562672548360985],
  [0.28420116374879145, 0.648547207079825],
  [0.6962159966701554, 0.2927207490124871],
  [0.0014900835088361708, 0.9734602747664127],
  [0.29840122301687566, 0.3139860020343368],
  [0.8917110704451572, 0.5851629398909081],
  [0.47130966518183137, 0.7732770096488164],
  [0.030346007662471197, 0.7069650956556235],
  [0.3742438334784708, 0.09085271350425783],
  [0.6605000674278948, 0.9314638547413545],
  [0.20719116808100124, 0.630090199785343],
  [0.29816309065742475, 0.7417566800693304],
  [0.7221648081421175, 0.21871542456880455],
];

function triArea(p: number[][], t: number[]): number {
  const [a, b, c] = t.map((i) => p[i]);
  return Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) / 2);
}

/** Circumcenter + squared radius of triangle (a,b,c). */
function circum(a: number[], b: number[], c: number[]): { cx: number; cy: number; r2: number } {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const cx = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const cy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  const r2 = (a[0] - cx) ** 2 + (a[1] - cy) ** 2;
  return { cx, cy, r2 };
}

describe('delaunay — invariants', () => {
  it('small 5-point set produces 4 triangles (matches scipy)', () => {
    const d = delaunay([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0.5, 0.5],
    ]);
    expect(d.simplices.length).toBe(4);
  });

  it('every input point is a triangle vertex (random 20, seed 3)', () => {
    const d = delaunay(RANDOM20_2D);
    const used = new Set<number>();
    for (const t of d.simplices) for (const v of t) used.add(v);
    expect(used.size).toBe(RANDOM20_2D.length);
  });

  it('triangles partition the convex hull (total area == hull area)', () => {
    const d = delaunay(RANDOM20_2D);
    const total = d.simplices.reduce((s, t) => s + triArea(RANDOM20_2D, t), 0);
    const hullArea = convexHull(RANDOM20_2D).volume; // enclosed area (2-D)
    expect(total).toBeCloseTo(hullArea, 10);
    expect(hullArea).toBeCloseTo(0.6396908755098627, 10); // scipy ConvexHull.volume
  });

  it('empty-circumcircle (Delaunay) property holds for every triangle', () => {
    const d = delaunay(RANDOM20_2D);
    const EPS = 1e-9;
    for (const t of d.simplices) {
      const [a, b, c] = t.map((i) => RANDOM20_2D[i]);
      const { cx, cy, r2 } = circum(a, b, c);
      for (let i = 0; i < RANDOM20_2D.length; i++) {
        if (t.includes(i)) continue;
        const p = RANDOM20_2D[i];
        const dist2 = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
        // No point strictly inside the circumcircle.
        expect(dist2).toBeGreaterThan(r2 - EPS);
      }
    }
  });

  it('triangle count matches scipy on the general-position set (31)', () => {
    expect(delaunay(RANDOM20_2D).simplices.length).toBe(31);
  });

  it('throws on fewer than 3 points and on 3-D input', () => {
    expect(() => delaunay([[0, 0]])).toThrow(/at least 3/);
    expect(() =>
      delaunay([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ])
    ).toThrow(/2-D/);
  });
});
