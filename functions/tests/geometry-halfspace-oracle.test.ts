/**
 * Halfspace intersection / vertex enumeration — oracle tests pinned against
 * `scipy.spatial.HalfspaceIntersection`.
 *
 * Reference vertex sets were generated with SciPy 1.17.1 / NumPy 2.3.4 using the
 * SAME halfspace convention this module adopts: each row `[a_1..a_d, b]` denotes
 * `a·x + b ≤ 0` (SciPy's stacked `[A | b]`, `Ax + b ≤ 0`). The oracles are the
 * vertex SET (order-independent: both sides are sorted and matched to ~1e-9) —
 * plus the implementation-independent invariant that every returned vertex
 * satisfies all halfspaces and is tight (equality) on at least `d` of them.
 */

import { describe, it, expect } from 'vitest';
import { halfspaceIntersection } from '../src/geometry/halfspace-intersection.js';

/** Sort a vertex list into a canonical order for set comparison. */
function sortVerts(v: number[][]): number[][] {
  // Sort on a COARSE key (1e-6 granularity — far above float noise, far below any real
  // vertex separation in these fixtures) so coordinates that are mathematically equal but
  // differ in their last bits (e.g. -0.5 vs -0.5000000000001) land in the same tie group and
  // break consistently on the next axis. Sorting on the raw values made the tie order depend
  // on float noise, which swapped the ±0.866 pair of the hexagon between actual and expected.
  // The returned values are the ORIGINALS (unrounded) so the 1e-9 comparison stays exact.
  const key = (x: number): number => Math.round((Math.abs(x) < 1e-12 ? 0 : x) * 1e6) / 1e6;
  return [...v]
    .map((p) => p.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)))
    .sort(
      (a, b) => key(a[0]) - key(b[0]) || key(a[1]) - key(b[1]) || key(a[2] ?? 0) - key(b[2] ?? 0)
    );
}

/** Assert two vertex sets match to `tol`, order-independent. */
function expectVertexSet(actual: number[][], expected: number[][], tol = 1e-9): void {
  expect(actual.length).toBe(expected.length);
  const a = sortVerts(actual);
  const e = sortVerts(expected);
  for (let i = 0; i < e.length; i++) {
    for (let j = 0; j < e[i].length; j++) {
      // Honour the caller's `tol` explicitly — toBeCloseTo(_, 9) would pin the
      // tolerance to 5e-10 regardless of what the caller asked for.
      expect(Math.abs(a[i][j] - e[i][j])).toBeLessThanOrEqual(tol);
    }
  }
}

/**
 * Implementation-independent invariant: every vertex satisfies all halfspaces
 * (`a·v + b ≤ tol`) and is tight (`= 0`) on at least `d` of them.
 */
function expectTrueVertices(
  halfspaces: number[][],
  result: { vertices: number[][]; incidences: number[][] },
  dim: number
): void {
  for (let k = 0; k < result.vertices.length; k++) {
    const v = result.vertices[k];
    let tightCount = 0;
    for (const hs of halfspaces) {
      let s = hs[dim];
      for (let j = 0; j < dim; j++) s += hs[j] * v[j];
      expect(s).toBeLessThanOrEqual(1e-7); // satisfies the halfspace
      if (Math.abs(s) <= 1e-9) tightCount++;
    }
    expect(tightCount).toBeGreaterThanOrEqual(dim);
    // Reported incidence must contain at least d halfspaces.
    expect(result.incidences[k].length).toBeGreaterThanOrEqual(dim);
  }
}

describe('halfspaceIntersection — 2-D (scipy.spatial.HalfspaceIntersection oracle)', () => {
  it('square [0,2]² from four edge halfspaces', () => {
    const hs = [
      [-1, 0, 0],
      [1, 0, -2],
      [0, -1, 0],
      [0, 1, -2],
    ];
    const r = halfspaceIntersection(hs, [1, 1]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('triangle (0,0)-(4,0)-(0,3) from edge halfspaces', () => {
    const hs = [
      [0, -1, 0],
      [-1, 0, 0],
      [3, 4, -12],
    ];
    const r = halfspaceIntersection(hs, [1, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 3],
      [4, 0],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('regular hexagon (circumradius 1) from six edge halfspaces', () => {
    const apothem = Math.cos(Math.PI / 6);
    const hs: number[][] = [];
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 180) * (60 * k + 30);
      hs.push([Math.cos(ang), Math.sin(ang), -apothem]);
    }
    const r = halfspaceIntersection(hs, [0, 0]);
    expectVertexSet(r.vertices, [
      [-1, 0],
      [-0.5, -0.866025403784],
      [-0.5, 0.866025403784],
      [0.5, -0.866025403784],
      [0.5, 0.866025403784],
      [1, 0],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('irregular bounded polytope (box + two diagonal cuts)', () => {
    const hs = [
      [-1, 0, -0.0],
      [1, 0, -3],
      [0, -1, 0],
      [0, 1, -2],
      [1, 1, -4],
      [-1, 1, -1.5],
    ];
    const r = halfspaceIntersection(hs, [1, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 1.5],
      [0.5, 2],
      [2, 2],
      [3, 0],
      [3, 1],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('orders 2-D vertices counter-clockwise (polygon traversal)', () => {
    const hs = [
      [-1, 0, 0],
      [1, 0, -2],
      [0, -1, 0],
      [0, 1, -2],
    ];
    const v = halfspaceIntersection(hs, [1, 1]).vertices;
    // Signed area from the traversal must be positive (CCW).
    let signed = 0;
    for (let k = 0; k < v.length; k++) {
      const a = v[k];
      const b = v[(k + 1) % v.length];
      signed += a[0] * b[1] - b[0] * a[1];
    }
    expect(signed).toBeGreaterThan(0);
  });
});

describe('halfspaceIntersection — 3-D (scipy.spatial.HalfspaceIntersection oracle)', () => {
  it('unit cube [0,1]³ from six face halfspaces', () => {
    const hs = [
      [-1, 0, 0, 0],
      [1, 0, 0, -1],
      [0, -1, 0, 0],
      [0, 1, 0, -1],
      [0, 0, -1, 0],
      [0, 0, 1, -1],
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 1, 1],
    ]);
    expectTrueVertices(hs, r, 3);
  });

  it('tetrahedron (0,0,0)-(1,0,0)-(0,1,0)-(0,0,1) from four face halfspaces', () => {
    const hs = [
      [-1, 0, 0, 0],
      [0, -1, 0, 0],
      [0, 0, -1, 0],
      [1, 1, 1, -1],
    ];
    const r = halfspaceIntersection(hs, [0.25, 0.25, 0.25]);
    expectVertexSet(r.vertices, [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ]);
    expectTrueVertices(hs, r, 3);
  });

  it('irregular bounded polytope (unit cube with a truncated corner)', () => {
    const hs = [
      [-1, 0, 0, 0],
      [1, 0, 0, -1],
      [0, -1, 0, 0],
      [0, 1, 0, -1],
      [0, 0, -1, 0],
      [0, 0, 1, -1],
      [1, 1, 1, -2.5], // cuts the (1,1,1) corner
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [0.5, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 0.5, 1],
      [1, 1, 0],
      [1, 1, 0.5],
    ]);
    expectTrueVertices(hs, r, 3);
  });
});

describe('halfspaceIntersection — scale invariance', () => {
  // A halfspace row [a, b] may be multiplied by ANY positive constant without
  // changing the inequality a·x + b ≤ 0, and polytope coordinates carry units.
  // Neither may alter the result — these pin against absolute-epsilon regressions.

  it('is invariant to uniform rescaling of the halfspace rows', () => {
    const base = [
      [-1, 0, 0],
      [1, 0, -2],
      [0, -1, 0],
      [0, 1, -2],
    ];
    const expected = [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ];
    for (const k of [1e-8, 1e-3, 1, 1e3, 1e8]) {
      const scaled = base.map((row) => row.map((x) => x * k));
      const r = halfspaceIntersection(scaled, [1, 1]);
      expect(r.vertices.length, `row scale ${k}`).toBe(4);
      expectVertexSet(r.vertices, expected);
    }
  });

  it('handles 2-D polytopes across coordinate magnitudes', () => {
    for (const s of [1e-4, 1, 1e4, 1e6]) {
      const hs = [
        [-1, 0, 0],
        [1, 0, -s],
        [0, -1, 0],
        [0, 1, -s],
      ];
      const r = halfspaceIntersection(hs, [s / 2, s / 2]);
      expect(r.vertices.length, `coord scale ${s}`).toBe(4);
      expectVertexSet(
        r.vertices,
        [
          [0, 0],
          [0, s],
          [s, 0],
          [s, s],
        ],
        s * 1e-9
      );
    }
  });

  it('handles 3-D polytopes across coordinate magnitudes', () => {
    for (const s of [1e-4, 1, 1e4, 1e6]) {
      const hs = [
        [-1, 0, 0, 0],
        [1, 0, 0, -s],
        [0, -1, 0, 0],
        [0, 1, 0, -s],
        [0, 0, -1, 0],
        [0, 0, 1, -s],
      ];
      const r = halfspaceIntersection(hs, [s / 2, s / 2, s / 2]);
      expect(r.vertices.length, `coord scale ${s}`).toBe(8);
      expectTrueVertices(hs, r, 3);
    }
  });
});

describe('halfspaceIntersection — redundant & duplicate halfspaces', () => {
  it('discards a non-binding redundant halfspace (as scipy does)', () => {
    // The 5th halfspace x ≤ 10 never touches the unit square — it must
    // contribute no vertex and appear in no incidence list.
    const hs = [
      [-1, 0, 0],
      [1, 0, -1],
      [0, -1, 0],
      [0, 1, -1],
      [1, 0, -10],
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    expect(r.incidences.flat()).not.toContain(4);
    expectTrueVertices(hs, r, 2);
  });

  it('handles a halfspace tight at exactly one vertex without cutting', () => {
    // x + y ≤ 2 touches the unit square only at (1,1).
    const hs = [
      [-1, 0, 0],
      [1, 0, -1],
      [0, -1, 0],
      [0, 1, -1],
      [1, 1, -2],
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('handles duplicate halfspace rows without spurious vertices', () => {
    const hs = [
      [-1, 0, 0],
      [1, 0, -1],
      [0, -1, 0],
      [0, 1, -1],
      [0, 1, -1], // exact duplicate
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5]);
    expectVertexSet(r.vertices, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    expectTrueVertices(hs, r, 2);
  });

  it('handles a 3-D vertex where more than d halfspaces meet', () => {
    // x+y+z ≤ 3 is tight only at the cube corner (1,1,1).
    const hs = [
      [-1, 0, 0, 0],
      [1, 0, 0, -1],
      [0, -1, 0, 0],
      [0, 1, 0, -1],
      [0, 0, -1, 0],
      [0, 0, 1, -1],
      [1, 1, 1, -3],
    ];
    const r = halfspaceIntersection(hs, [0.5, 0.5, 0.5]);
    expect(r.vertices.length).toBe(8);
    const corner = r.vertices.findIndex(
      (v) => Math.abs(v[0] - 1) < 1e-9 && Math.abs(v[1] - 1) < 1e-9 && Math.abs(v[2] - 1) < 1e-9
    );
    expect(corner).toBeGreaterThanOrEqual(0);
    expect(r.incidences[corner].length).toBe(4); // 3 faces + the touching plane
    expectTrueVertices(hs, r, 3);
  });
});

describe('halfspaceIntersection — validation & error handling', () => {
  it('throws when the interior point is not strictly interior (on boundary)', () => {
    const hs = [
      [-1, 0, 0],
      [1, 0, -2],
      [0, -1, 0],
      [0, 1, -2],
    ];
    expect(() => halfspaceIntersection(hs, [0, 1])).toThrow(/not strictly interior/);
  });

  it('throws when the interior point is outside the polytope', () => {
    const hs = [
      [-1, 0, 0],
      [1, 0, -2],
      [0, -1, 0],
      [0, 1, -2],
    ];
    expect(() => halfspaceIntersection(hs, [3, 3])).toThrow(/not strictly interior/);
  });

  it('throws on an unbounded polytope (a 2-D wedge)', () => {
    // Only x≥0 and y≥0 — unbounded to the upper-right (scipy raises QhullError).
    const hs = [
      [-1, 0, 0],
      [0, -1, 0],
    ];
    expect(() => halfspaceIntersection(hs, [1, 1])).toThrow(/unbounded/);
  });

  it('throws on an unbounded 3-D polytope (an open box missing a face)', () => {
    // Cube missing its z≤1 face → unbounded in +z.
    const hs = [
      [-1, 0, 0, 0],
      [1, 0, 0, -1],
      [0, -1, 0, 0],
      [0, 1, 0, -1],
      [0, 0, -1, 0],
    ];
    expect(() => halfspaceIntersection(hs, [0.5, 0.5, 0.5])).toThrow(/unbounded/);
  });

  it('throws for dimensions above 3 (n-D not supported)', () => {
    const hs = [
      [-1, 0, 0, 0, 0],
      [1, 0, 0, 0, -1],
      [0, -1, 0, 0, 0],
      [0, 1, 0, 0, -1],
      [0, 0, -1, 0, 0],
    ];
    expect(() => halfspaceIntersection(hs, [0.5, 0.5, 0.5, 0.5])).toThrow(/only 2-D and 3-D/);
  });

  it('throws on malformed halfspace rows', () => {
    expect(() =>
      halfspaceIntersection(
        [
          [1, 0],
          [0, 1, -1],
        ],
        [0.5, 0.5]
      )
    ).toThrow(/length 3/);
  });
});
