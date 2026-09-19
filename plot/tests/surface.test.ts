import { describe, it, expect } from 'vitest';
import { surface, compareDepth, DEPTH_EPS } from '../src/three/surface.js';

describe('surface', () => {
  it('filled surface emits one polygon per grid quad', () => {
    const z = [
      [0, 1, 0],
      [1, 2, 1],
      [0, 1, 0],
    ]; // 3x3 → 2x2 = 4 quads
    const svg = surface(z, { kind: 'filled' });
    expect((svg.match(/<polygon/g) ?? []).length).toBe(4);
  });
  it('wireframe emits polylines, no fill polygons', () => {
    const z = [
      [0, 1],
      [1, 2],
    ];
    const svg = surface(z, { kind: 'wireframe' });
    expect(svg).toContain('<polyline');
  });
  it('degenerate grid → no data', () => {
    expect(surface([[1]])).toContain('no data');
  });
  it("paints far quads before near quads (painter's-algorithm z-order oracle)", () => {
    // azim0/elev0 → depth = world-y = row. rows 1-2 are far (depth +0.5), rows 0-1 near (depth -0.5).
    // z chosen so far quad meanZ=5 → viridis(0.5)=#26828e, near quad meanZ=0 → viridis(0)=#440154.
    const z = [
      [0, 0],
      [0, 0],
      [10, 10],
    ];
    const svg = surface(z, { kind: 'filled', azim: 0, elev: 0 });
    const farIdx = svg.indexOf('#26828e'); // far quad (rows 1-2)
    const nearIdx = svg.indexOf('#440154'); // near quad (rows 0-1)
    expect(farIdx).toBeGreaterThan(-1);
    expect(nearIdx).toBeGreaterThan(-1);
    expect(farIdx).toBeLessThan(nearIdx); // far painted first (earlier in the document)
  });

  describe('compareDepth: ties within DEPTH_EPS resolve by face index', () => {
    // Math.sin(PI/4) is 0.7071067811865475 in Node and 0.7071067811865476 in Bun, so two
    // geometrically equal depths can differ by 1 ulp. The order must not depend on that bit.
    const d = Math.SQRT1_2;
    const up = d + Number.EPSILON / 2; // the next double above SQRT1_2 (1 ulp in [0.5, 1))
    it('the test depths really differ by exactly 1 ulp', () => {
      expect(up).toBeGreaterThan(d);
      expect((up + d) / 2 === d || (up + d) / 2 === up).toBe(true);
      expect(up - d).toBeLessThan(DEPTH_EPS);
    });
    it('lower index first when the LOWER index has the 1-ulp-larger depth', () => {
      const q = [
        { depth: d, index: 1 },
        { depth: up, index: 0 },
      ];
      expect(q.sort(compareDepth).map((x) => x.index)).toEqual([0, 1]);
    });
    it('lower index first when the LOWER index has the 1-ulp-smaller depth', () => {
      const q = [
        { depth: up, index: 1 },
        { depth: d, index: 0 },
      ];
      expect(q.sort(compareDepth).map((x) => x.index)).toEqual([0, 1]);
    });
    it('a real depth difference still wins over the index (far first)', () => {
      const q = [
        { depth: 0.1, index: 0 },
        { depth: 0.2, index: 1 },
      ];
      expect(q.sort(compareDepth).map((x) => x.index)).toEqual([1, 0]);
    });
  });
});
