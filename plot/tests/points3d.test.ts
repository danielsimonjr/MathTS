import { describe, it, expect } from 'vitest';
import { scatter3d, curve3d } from '../src/three/points3d.js';

describe('scatter3d + curve3d', () => {
  it('scatter3d emits one circle per point', () => {
    const svg = scatter3d([0, 1, 2], [0, 1, 0], [1, 0, 1]);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });
  it('curve3d emits a projected polyline', () => {
    const t = Array.from({ length: 20 }, (_, i) => i / 3);
    const svg = curve3d(t.map(Math.cos), t.map(Math.sin), t);
    expect(svg).toContain('<polyline');
  });
  it('mismatched lengths still render (truncate), no throw', () => {
    expect(scatter3d([0, 1], [0], [1, 2, 3])).toMatch(/^<svg/);
  });
});
