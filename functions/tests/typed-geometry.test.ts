/**
 * Tests for convexHull3D — incremental QuickHull-3D (Slice 6.3).
 *
 * Covers:
 *   1. Tetrahedron (4 points, all on hull)
 *   2. Cube vertices (8 points, all on hull)
 *   3. Cube vertices + interior centroid (9 points, 8 on hull)
 *   4. Random points on a sphere (~50 points, all on hull)
 *   5. Large random cluster (≥ 1024 points → WASM path) — sanity checks
 *   6. Co-planar input → clean error
 */

import { describe, it, expect } from 'vitest';
import { convexHull3D } from '../src/typed/geometry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Signed volume of tetrahedron (o, a, b, c) — positive when a,b,c are CCW from o. */
function signedVol(
  o: number[],
  a: number[],
  b: number[],
  c: number[],
): number {
  const bax = a[0] - o[0]; const bay = a[1] - o[1]; const baz = a[2] - o[2];
  const cax = b[0] - o[0]; const cay = b[1] - o[1]; const caz = b[2] - o[2];
  const dax = c[0] - o[0]; const day = c[1] - o[1]; const daz = c[2] - o[2];
  return (
    bax * (cay * daz - caz * day) -
    bay * (cax * daz - caz * dax) +
    baz * (cax * day - cay * dax)
  );
}

/**
 * Signed distance of point `p` to the plane of triangle (a, b, c).
 * Positive = same side as the outward normal (b-a)×(c-a).
 */
function planeDist(a: number[], b: number[], c: number[], p: number[]): number {
  return signedVol(a, b, c, p);
}

/**
 * Check that every face of the hull has its outward normal pointing away from
 * the interior.  We use the centroid of the hull vertices as an interior proxy.
 */
function allFacesOutward(pts: number[][], faces: [number, number, number][]): boolean {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  for (const [a, b, c] of faces) {
    const d = planeDist(pts[a], pts[b], pts[c], [cx, cy, cz]);
    // centroid should be on the negative (interior) side.
    if (d > 1e-9) return false;
  }
  return true;
}

/**
 * Check that every point in `pts` is on or inside the hull (non-positive
 * signed distance to every face).
 */
function allPointsInside(pts: number[][], faces: [number, number, number][]): boolean {
  for (let pi = 0; pi < pts.length; pi++) {
    for (const [a, b, c] of faces) {
      const d = planeDist(pts[a], pts[b], pts[c], pts[pi]);
      if (d > 1e-9) return false;
    }
  }
  return true;
}

/** Simple seeded pseudo-random generator (xorshift32). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Test 1: Tetrahedron — 4 points, all on hull
// ---------------------------------------------------------------------------

describe('convexHull3D — tetrahedron (4 points)', () => {
  it('returns exactly 4 faces', () => {
    const pts = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(faces.length).toBe(4);
  });

  it('all faces are outward-oriented', () => {
    const pts = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(allFacesOutward(pts, faces)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Cube vertices — 8 points, all on hull
// ---------------------------------------------------------------------------

describe('convexHull3D — cube (8 vertices)', () => {
  const cube = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];

  it('returns 12 triangular faces (6 quad faces × 2 triangles)', () => {
    const faces = convexHull3D(cube) as [number, number, number][];
    expect(faces.length).toBe(12);
  });

  it('all faces are outward-oriented', () => {
    const faces = convexHull3D(cube) as [number, number, number][];
    expect(allFacesOutward(cube, faces)).toBe(true);
  });

  it('all 8 vertices appear at least once in the face list', () => {
    const faces = convexHull3D(cube) as [number, number, number][];
    const used = new Set<number>();
    for (const [a, b, c] of faces) {
      used.add(a); used.add(b); used.add(c);
    }
    expect(used.size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Cube + interior centroid — 9 points, 8 on hull
// ---------------------------------------------------------------------------

describe('convexHull3D — cube with interior centroid (9 points)', () => {
  const pts = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    [0.5, 0.5, 0.5], // interior centroid — index 8
  ];

  it('hull has 12 faces (centroid is interior, not hull vertex)', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(faces.length).toBe(12);
  });

  it('index 8 (centroid) does not appear in any face', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    for (const [a, b, c] of faces) {
      expect(a).not.toBe(8);
      expect(b).not.toBe(8);
      expect(c).not.toBe(8);
    }
  });

  it('all points are inside the hull', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(allPointsInside(pts, faces)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Random points on a sphere (~50 points, all on hull)
// ---------------------------------------------------------------------------

describe('convexHull3D — points on unit sphere (50 points)', () => {
  function spherePoints(n: number, seed: number): number[][] {
    const rng = makeRng(seed);
    const pts: number[][] = [];
    for (let i = 0; i < n; i++) {
      // Use the Marsaglia rejection method for uniform sphere sampling.
      let x: number, y: number, s: number;
      do {
        x = rng() * 2 - 1;
        y = rng() * 2 - 1;
        s = x * x + y * y;
      } while (s >= 1.0);
      const factor = 2 * Math.sqrt(1 - s);
      pts.push([x * factor, y * factor, 1 - 2 * s]);
    }
    return pts;
  }

  const pts = spherePoints(50, 7);

  it('returns a non-empty hull', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(faces.length).toBeGreaterThan(0);
  });

  it('all faces are outward-oriented', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(allFacesOutward(pts, faces)).toBe(true);
  });

  it('all points are inside or on the hull (sphere points ≡ hull vertices)', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    expect(allPointsInside(pts, faces)).toBe(true);
  });

  it('Euler characteristic: V - E + F = 2 (closed convex polyhedron)', () => {
    const faces = convexHull3D(pts) as [number, number, number][];
    const verts = new Set<number>();
    const edgeSet = new Set<string>();
    for (const [a, b, c] of faces) {
      verts.add(a); verts.add(b); verts.add(c);
      const edges: [number, number][] = [[a, b], [b, c], [c, a]];
      for (const [u, v] of edges) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        edgeSet.add(key);
      }
    }
    const V = verts.size;
    const E = edgeSet.size;
    const F = faces.length;
    expect(V - E + F).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Large random cluster (≥ 1024 points → WASM path)
// ---------------------------------------------------------------------------

describe('convexHull3D — large random cluster (1024 points, WASM path)', () => {
  function randomPoints3D(n: number, seed: number): number[][] {
    const rng = makeRng(seed);
    return Array.from({ length: n }, () => [rng(), rng(), rng()]);
  }

  const pts = randomPoints3D(1024, 42);
  let faces: [number, number, number][];

  it('returns a non-empty hull without error', () => {
    faces = convexHull3D(pts) as [number, number, number][];
    expect(faces.length).toBeGreaterThan(0);
  });

  it('all faces are outward-oriented (no inward normals)', () => {
    if (!faces) faces = convexHull3D(pts) as [number, number, number][];
    expect(allFacesOutward(pts, faces)).toBe(true);
  });

  it('every input point is inside or on the hull', () => {
    if (!faces) faces = convexHull3D(pts) as [number, number, number][];
    expect(allPointsInside(pts, faces)).toBe(true);
  });

  it('Euler characteristic V - E + F = 2', () => {
    if (!faces) faces = convexHull3D(pts) as [number, number, number][];
    const verts = new Set<number>();
    const edgeSet = new Set<string>();
    for (const [a, b, c] of faces) {
      verts.add(a); verts.add(b); verts.add(c);
      for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
        edgeSet.add(u < v ? `${u},${v}` : `${v},${u}`);
      }
    }
    expect(verts.size - edgeSet.size + faces.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Degenerate co-planar input → clean error
// ---------------------------------------------------------------------------

describe('convexHull3D — degenerate co-planar input', () => {
  it('throws a descriptive error for all-z=0 points', () => {
    const coplanar = [
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
      [0.5, 0.5, 0], [0.25, 0.75, 0],
    ];
    expect(() => convexHull3D(coplanar)).toThrowError(/degenerate/i);
  });

  it('throws for fewer than 4 points', () => {
    expect(() => convexHull3D([[0, 0, 0], [1, 0, 0], [0, 1, 0]])).toThrowError(
      /at least 4/i,
    );
  });
});
