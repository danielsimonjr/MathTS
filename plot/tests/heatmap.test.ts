import { describe, it, expect } from 'vitest';
import { heatmap } from '../src/heatmap.js';

describe('heatmap', () => {
  it('emits one rect per grid cell', () => {
    const z = [
      [0, 1],
      [2, 3],
    ];
    const svg = heatmap(z);
    // 4 cells + 1 background rect
    expect((svg.match(/<rect/g) ?? []).length).toBe(5);
  });
  it('empty grid → no data', () => {
    expect(heatmap([])).toContain('no data');
  });
});
