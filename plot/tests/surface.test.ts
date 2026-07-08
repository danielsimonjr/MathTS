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
});
