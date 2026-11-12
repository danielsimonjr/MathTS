import { describe, it, expect } from 'vitest';
import { heatmap } from '../src/heatmap.js';

describe('heatmap', () => {
  it('emits one rect per grid cell', () => {
    const z = [
      [0, 1],
      [2, 3],
    ];
    const svg = heatmap(z);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(svg).toContain('<text');
  });
  it('empty grid → no data', () => {
    expect(heatmap([])).toContain('no data');
  });
});
