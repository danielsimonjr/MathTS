import { describe, it, expect } from 'vitest';
import { scatter3d, curve3d } from '../src/three/points3d.js';

describe('scatter3d + curve3d', () => {
  it('scatter3d emits one circle per point', () => {
    const svg = scatter3d([0, 1, 2], [0, 1, 0], [1, 0, 1]);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });
  it('curve3d emits depth-cued per-segment lines, not a single polyline', () => {
    const svg = curve3d([0, 1, 2], [0, 1, 0], [0, 0.5, 1]);
    expect(svg).not.toContain('<polyline');
    const lines = [...svg.matchAll(/<line[^>]*\/>/g)].map((m) => m[0]);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const opacities = lines
      .map((l) => l.match(/stroke-opacity="([\d.]+)"/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(opacities.length).toBeGreaterThanOrEqual(1);
    const eps = 1e-9;
    for (const op of opacities) {
      expect(op).toBeGreaterThanOrEqual(0.4 - eps);
      expect(op).toBeLessThanOrEqual(1.0 + eps);
    }
    expect(Math.min(...opacities)).toBeLessThan(Math.max(...opacities));
  });
  it('curve3d TikZ path emits draw opacity per segment', () => {
    const tex = curve3d([0, 1, 2], [0, 1, 0], [0, 0.5, 1], { format: 'tikz' });
    expect(tex).toContain('draw opacity=');
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
  it('does not throw on a very large series (no Math.min/max spread overflow)', () => {
    const n = 200000;
    const xs = Array.from({ length: n }, (_, i) => Math.cos(i / 100));
    const ys = Array.from({ length: n }, (_, i) => Math.sin(i / 100));
    const zs = Array.from({ length: n }, (_, i) => i / n);
    // curve3d now renders per-segment depth-cued lines (one <line> per point pair,
    // vs a single compact polyline), so this genuinely does more work than before —
    // extended timeout, not a regression. Shares projectAll's min/max path either way.
    expect(() => curve3d(xs, ys, zs)).not.toThrow();
    expect(curve3d(xs, ys, zs)).toMatch(/^<svg/);
  }, 60_000); // 200k-point series; the inline cap must clear the concurrent-gate contention (see vitest.config.ts)
});
