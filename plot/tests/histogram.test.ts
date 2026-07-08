import { describe, it, expect } from 'vitest';
import { histogram } from '../src/histogram.js';

describe('histogram', () => {
  it('bins data (via functions.histogram) and draws bars', () => {
    const svg = histogram([1, 2, 2, 3, 3, 3, 4, 4, 4, 4], { bins: 4, title: 'h' });
    expect(svg).toMatch(/^<svg/);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
  it('no data → no-data svg', () => {
    expect(histogram([])).toContain('no data');
  });
});
