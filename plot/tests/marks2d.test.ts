import { describe, it, expect } from 'vitest';
import { line, scatter, bar, area, step } from '../src/marks2d.js';

describe('line', () => {
  it('renders a polyline through N points and returns an svg', () => {
    const svg = line([0, 1, 2, 3], [0, 1, 4, 9], { title: 'sq' });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('<polyline');
    expect(svg).toContain('sq');
  });
  it('maps the first/last x to the inner plot edges (geometry oracle)', () => {
    // width 520, left margin 64, right 20 → inner x spans [64, 500]
    const svg = line([0, 10], [0, 0], { width: 520, height: 320 });
    const m = svg.match(/points="([^"]+)"/);
    expect(m).toBeTruthy();
    const pts = m![1].split(' ').map((p) => p.split(',').map(Number));
    expect(pts[0][0]).toBeCloseTo(64, 0);
    expect(pts[1][0]).toBeCloseTo(500, 0);
  });
  it('returns a no-data svg for empty input, never throws', () => {
    expect(line([], [])).toContain('no data');
  });
  it('keeps x/y aligned across a NaN gap (drop the gap point, not shift the rest)', () => {
    const svg = line([0, 1, 2, 3], [0, 1, NaN, 9], { width: 520, height: 320 });
    const m = svg.match(/points="([^"]+)"/);
    expect(m).toBeTruthy();
    const pts = m![1].split(' ').map((p) => p.split(',').map(Number));
    // 3 finite points: (0,0),(1,1),(3,9). The x=2 (gap) point is dropped; x=3 stays with y=9.
    expect(pts.length).toBe(3);
    // last point's x must map to data-x=3 → inner-right edge px 500 (width520,left64,right20)
    expect(pts[2][0]).toBeCloseTo(500, 0);
  });
});

describe('scatter + bar', () => {
  it('scatter emits one circle per finite point', () => {
    const svg = scatter([0, 1, 2], [1, 2, 3]);
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });
  it('bar emits one rect per bar', () => {
    const svg = bar([0, 1, 2], [3, 1, 2]);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(3); // + bg rect
  });
});

describe('area + step', () => {
  it('area emits a filled polygon', () => {
    expect(area([0, 1, 2], [1, 2, 1])).toContain('<polygon');
  });
  it('step emits a polyline with 2N-1 vertices', () => {
    const svg = step([0, 1, 2], [1, 2, 3]);
    const m = svg.match(/points="([^"]+)"/);
    expect(m![1].trim().split(' ').length).toBe(5); // 2*3-1
  });
});
