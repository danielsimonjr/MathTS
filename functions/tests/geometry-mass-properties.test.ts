import { describe, expect, it } from 'vitest';
import { massProperties, MASS_PROPERTY_SHAPES } from '../src/index.js';

const PI = Math.PI;
const close = (a: number, b: number, rel = 1e-12) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));
const closeMat = (a: number[][], b: number[][], rel = 1e-12) =>
  a.forEach((r, i) => r.forEach((x, j) => close(x, b[i]![j]!, rel)));
const diag = (x: number, y: number, z: number) => [
  [x, 0, 0],
  [0, y, 0],
  [0, 0, z],
];

/** Box as a polyhedron: 8 vertices, 6 quad faces (outward CCW). */
const boxPoly = (a: number, b: number, c: number, o = [0, 0, 0]) => ({
  vertices: [
    [-a, -b, -c],
    [a, -b, -c],
    [a, b, -c],
    [-a, b, -c],
    [-a, -b, c],
    [a, -b, c],
    [a, b, c],
    [-a, b, c],
  ].map((p) => p.map((x, i) => x + o[i]!)),
  faces: [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [1, 2, 6, 5],
    [0, 4, 7, 3],
  ],
});

describe('massProperties: closed forms', () => {
  it('sphere', () => {
    const m = massProperties({ type: 'sphere', radius: 2 }, 3);
    close(m.volume, (32 / 3) * PI);
    close(m.mass, 32 * PI);
    closeMat(m.inertia, diag(0.4 * m.mass * 4, 0.4 * m.mass * 4, 0.4 * m.mass * 4));
    expect(m.centroid).toEqual([0, 0, 0]);
  });

  it('box', () => {
    const m = massProperties({ type: 'box', halfExtents: [1, 2, 3] }, 1000);
    expect(m.volume).toBe(48);
    expect(m.mass).toBe(48000);
    // m (h^2 + d^2) / 12 with full sizes 2, 4, 6.
    closeMat(
      m.inertia,
      diag((48000 * (16 + 36)) / 12, (48000 * (4 + 36)) / 12, (48000 * (4 + 16)) / 12)
    );
  });

  it('capsule: volume, and reduces to a sphere at halfHeight -> 0', () => {
    const m = massProperties({ type: 'capsule', radius: 1, halfHeight: 2 });
    close(m.volume, PI * 4 + (4 / 3) * PI);
    const s = massProperties({ type: 'capsule', radius: 1.5, halfHeight: 1e-300 });
    const sp = massProperties({ type: 'sphere', radius: 1.5 });
    closeMat(s.inertia, sp.inertia);
  });

  it('capsule matches a fine convex-hull approximation', () => {
    const r = 0.7,
      h = 1.3,
      pts: number[][] = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const th = (PI * i) / n;
      for (let j = 0; j < n; j++) {
        const ph = (2 * PI * j) / n;
        const x = r * Math.sin(th) * Math.cos(ph),
          z = r * Math.sin(th) * Math.sin(ph),
          y = r * Math.cos(th);
        pts.push([x, y + (y >= 0 ? h : -h), z]);
        if (i === n / 2) pts.push([x, y - h, z]);
      }
    }
    const exact = massProperties({ type: 'capsule', radius: r, halfHeight: h });
    const hull = massProperties({ type: 'convexPolyhedron', vertices: pts });
    close(hull.volume, exact.volume, 5e-3);
    closeMat(hull.inertia, exact.inertia, 1e-2);
  });

  it('circle, rectangle, 2-D capsule', () => {
    const c = massProperties({ type: 'circle', radius: 2 }, 5);
    close(c.volume, 4 * PI);
    close(c.inertia, (c.mass * 4) / 2);
    const r = massProperties({ type: 'rectangle', halfExtents: [1, 2] }, 2);
    expect(r.volume).toBe(8);
    close(r.inertia, (16 * (4 + 16)) / 12);
    const k = massProperties({ type: 'capsule2d', radius: 1, halfHeight: 2 });
    close(k.volume, 8 + PI);
    const k0 = massProperties({ type: 'capsule2d', radius: 1, halfHeight: 1e-300 });
    close(k0.inertia, massProperties({ type: 'circle', radius: 1 }).inertia);
  });
});

describe('massProperties: polygons (exact)', () => {
  it('a square polygon equals the rectangle, in either winding and offset', () => {
    const ccw = [
      [1, 0],
      [3, 0],
      [3, 4],
      [1, 4],
    ];
    const rect = massProperties({ type: 'rectangle', halfExtents: [1, 2] });
    for (const v of [ccw, [...ccw].reverse()]) {
      const p = massProperties({ type: 'polygon', vertices: v });
      close(p.volume, rect.volume);
      close(p.inertia, rect.inertia);
      expect(p.centroid).toEqual([2, 2]);
    }
  });

  it('right triangle: area, centroid and polar moment', () => {
    // Legs b along x and h along y: Izz about centroid = A (b^2 + h^2) / 18.
    const p = massProperties({
      type: 'polygon',
      vertices: [
        [0, 0],
        [3, 0],
        [0, 6],
      ],
    });
    close(p.volume, 9);
    close(p.centroid[0], 1);
    close(p.centroid[1], 2);
    close(p.inertia, (9 * (9 + 36)) / 18);
  });

  it('a regular n-gon converges to the circle', () => {
    const n = 4096;
    const v = Array.from({ length: n }, (_, i) => [
      Math.cos((2 * PI * i) / n),
      Math.sin((2 * PI * i) / n),
    ]);
    const p = massProperties({ type: 'polygon', vertices: v });
    close(p.inertia, PI / 2, 1e-5);
  });
});

describe('massProperties: polyhedra (exact)', () => {
  it('a box polyhedron equals the box, with faces, without faces, flipped and offset', () => {
    const box = massProperties({ type: 'box', halfExtents: [1, 2, 3] }, 7);
    const poly = boxPoly(1, 2, 3, [5, -1, 2]);
    const variants = [
      poly,
      { vertices: poly.vertices },
      { vertices: poly.vertices, faces: poly.faces.map((f) => [...f].reverse()) },
    ];
    for (const v of variants) {
      const m = massProperties({ type: 'convexPolyhedron', ...v }, 7);
      close(m.volume, box.volume);
      closeMat(m.inertia, box.inertia);
      m.centroid.forEach((x, i) => close(x, [5, -1, 2][i]!));
    }
  });

  it('unit right tetrahedron: known tensor', () => {
    // Vertices 0, e1, e2, e3. V = 1/6, centroid 1/4. About the origin
    // ∫x^2 = 1/60, ∫xy = 1/120, so about the centroid Ixx = 2(1/60 - V/16), Ixy = -(1/120 - V/16).
    const m = massProperties({
      type: 'convexPolyhedron',
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    });
    close(m.volume, 1 / 6);
    m.centroid.forEach((x) => close(x, 0.25));
    const d = 2 * (1 / 60 - 1 / 96),
      o = -(1 / 120 - 1 / 96);
    closeMat(m.inertia, [
      [d, o, o],
      [o, d, o],
      [o, o, d],
    ]);
  });
});

describe('massProperties: validation', () => {
  it('rejects unknown types, bad parameters and degenerate shapes', () => {
    expect(() => massProperties({ type: 'torus' } as never)).toThrow(RangeError);
    expect(() => massProperties({ type: 'sphere', radius: -1 })).toThrow(/radius/);
    expect(() => massProperties({ type: 'box', halfExtents: [1, 2] })).toThrow(/halfExtents/);
    expect(() => massProperties({ type: 'sphere', radius: 1 }, 0)).toThrow(/density/);
    expect(() =>
      massProperties({
        type: 'polygon',
        vertices: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      })
    ).toThrow(/degenerate/);
  });

  it('every catalog row has a unique type', () => {
    const types = MASS_PROPERTY_SHAPES.map((r) => r.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
