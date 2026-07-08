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
  it('scatter3d depth-cues opacity and paints far points before near (painter’s order)', () => {
    // azim0/elev0: depth = world-y. Two points with equal x,z but y=0 vs y=1 → same screen pos, different depth.
    const svg = scatter3d([0, 0], [0, 1], [0, 0], { azim: 0, elev: 0 });
    const circles = [...svg.matchAll(/<circle[^>]*\/>/g)].map((m) => m[0]);
    expect(circles.length).toBe(2);
    const op = (c: string): number => {
      const m = c.match(/fill-opacity="([\d.]+)"/);
      return m ? Number(m[1]) : 1;
    };
    // far point emitted FIRST (lower opacity ~0.4); near point SECOND (opacity 1.0, no attr)
    expect(op(circles[0])).toBeLessThan(op(circles[1]));
  });
});
