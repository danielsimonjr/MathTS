import { describe, it, expect } from 'vitest';
import { surface } from '../src/three/surface.js';

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
});
