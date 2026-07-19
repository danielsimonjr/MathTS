/**
 * Coverage tests for functions/src/typed/geometry.ts.
 *
 * These exercise the pure-TypeScript branches that the existing
 * geometry / geometry-extended / typed-geometry suites leave uncovered:
 *   - intersectSegments2D: the "intersection lies outside the segments" null path
 *   - area: the default (unsupported-shape) throw
 *   - centroid: the degenerate n<=2 average path
 *   - coordinateTransform: the unknown-source / unknown-target throws
 *   - convexHull3D (JS fallback): the all-same-x and all-collinear degenerate throws
 *
 * NOTE ON THE WASM CEILING: a large block of geometry.ts (the WASM
 * dispatch paths inside delaunayTriangulation, voronoiDiagram, nearestNeighbor
 * and convexHull3D) is unreachable in this environment. Those branches only run
 * when `wasmLoader.getModule()` returns a compiled WASM kernel exporting
 * `delaunay_wasm` / `voronoi_wasm` / `kdtree_*_wasm` / `convex_hull_3d_wasm`.
 * No `lib/wasm/mathts.wasm` is built here (no WASM artifact present), so
 * every call falls through to the JS path. Those ~86 lines therefore cannot be
 * covered without first building that WASM artifact. The tests below cover
 * the remaining JS-reachable branches.
 */

import { describe, it, expect } from 'vitest';
import {
  intersectSegments2D,
  area,
  centroid,
  coordinateTransform,
  convexHull2D,
  convexHull3D,
  type Shape,
} from '../src/typed/geometry.js';

describe('convexHull2D — large input uses the argsort dispatch (>= WASM_SORT_THRESHOLD)', () => {
  it('hull of a dense disc with >= 16384 points is the bounding square corners', () => {
    // WASM_SORT_THRESHOLD is 16384; argsortF64Dispatch falls back to pure-JS
    // argsort here (no WASM), exercising the large-n sort branch and the
    // stable secondary-key tie-break loop in convexHull2D.
    const N = 16400;
    const pts: number[][] = [];
    // A grid clustered inside [0,10]^2 with the 4 explicit corners present.
    for (let i = 0; i < N - 4; i++) {
      pts.push([(i % 127) / 13, (Math.floor(i / 127) % 100) / 13]);
    }
    pts.push([0, 0], [10, 0], [10, 10], [0, 10]);
    const hull = convexHull2D(pts);
    // The four extreme corners must be hull vertices.
    const has = (x: number, y: number) => hull.some((p) => p[0] === x && p[1] === y);
    expect(has(0, 0)).toBe(true);
    expect(has(10, 0)).toBe(true);
    expect(has(10, 10)).toBe(true);
    expect(has(0, 10)).toBe(true);
    // A convex hull of points within [0,10]^2 cannot exceed that bounding box.
    for (const [x, y] of hull) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(10);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(10);
    }
  });
});

describe('intersectSegments2D — no intersection within segments', () => {
  it('returns null when the infinite lines cross outside both segments', () => {
    // Lines y=0 and x=0 cross at the origin, but these short segments are far
    // from it, so t/u fall outside [0,1] and the function returns null.
    const result = intersectSegments2D([5, 0], [10, 0], [0, 5], [0, 10]);
    expect(result).toBeNull();
  });

  it('still finds a valid crossing for overlapping segments (control)', () => {
    const result = intersectSegments2D([-1, 0], [1, 0], [0, -1], [0, 1]);
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(0, 10);
    expect(result![1]).toBeCloseTo(0, 10);
  });
});

describe('area — unsupported shape throws', () => {
  it('throws for an unknown shape type', () => {
    // Force an out-of-union value to reach the default branch.
    const bad = { type: 'hexagon' } as unknown as Shape;
    expect(() => area(bad)).toThrow(/unsupported shape type/);
  });

  it('computes known shapes (control)', () => {
    expect(area({ type: 'circle', radius: 2 })).toBeCloseTo(Math.PI * 4, 10);
    expect(area({ type: 'rectangle', width: 3, height: 5 })).toBe(15);
  });
});

describe('centroid — degenerate n<=2 average path', () => {
  it('returns the single point for a one-vertex polygon', () => {
    expect(centroid([[2, 7]])).toEqual([2, 7]);
  });

  it('returns the midpoint for a two-vertex polygon', () => {
    expect(
      centroid([
        [0, 0],
        [4, 6],
      ])
    ).toEqual([2, 3]);
  });

  it('throws for an empty polygon', () => {
    expect(() => centroid([])).toThrow(/empty polygon/);
  });
});

describe('coordinateTransform — unknown system throws', () => {
  it('throws for an unknown source system', () => {
    const bad = 'galactic' as unknown as 'cartesian';
    expect(() => coordinateTransform([1, 2], bad, 'polar')).toThrow(/unknown source/);
  });

  it('throws for an unknown target system', () => {
    const bad = 'galactic' as unknown as 'polar';
    expect(() => coordinateTransform([1, 2], 'cartesian', bad)).toThrow(/unknown target/);
  });

  it('spherical source with rho=0 maps to origin (acos guard)', () => {
    const result = coordinateTransform([0, 0, 0], 'spherical', 'spherical');
    expect(result[0]).toBe(0);
    // phi guard: rho === 0 ? 0 : acos(...) → 0
    expect(result[2]).toBe(0);
  });
});

describe('convexHull3D (JS fallback) — degenerate inputs', () => {
  it('throws when all points share the same x-coordinate', () => {
    // i0 and i1 (min/max x) coincide → |x1 - x0| < 1e-12 branch.
    const pts = [
      [1, 0, 0],
      [1, 1, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 2, 2],
    ];
    expect(() => convexHull3D(pts)).toThrow(/same the same x|same x-coordinate|degenerate/);
  });

  it('throws when all points are collinear', () => {
    // Points along the line x=y=z; spread in x so the same-x guard passes,
    // but the area-of-triangle (i2) test fails → collinear throw.
    const pts = [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
      [4, 4, 4],
    ];
    expect(() => convexHull3D(pts)).toThrow(/collinear|degenerate/);
  });

  it('builds a valid tetrahedron hull (control, JS path)', () => {
    const faces = convexHull3D([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(faces.length).toBe(4);
  });
});
