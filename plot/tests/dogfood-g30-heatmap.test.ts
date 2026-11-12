import { describe, it, expect } from 'vitest';
import { heatmap } from '../src/heatmap.js';

describe('G30 #784 heatmap colorbar, ticks, and title', () => {
  const z = [
    [1, 2],
    [3, 4],
  ];

  it('renders title and colorbar tick text in SVG', () => {
    const svg = heatmap(z, { title: 'C' });
    expect(svg).toContain('C');
    expect((svg.match(/<text/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('#fde725');
  });

  it('custom tick labels appear in SVG', () => {
    const svg = heatmap(z, {
      title: 'Correlation',
      xTickLabels: ['a', 'b'],
      yTickLabels: ['r1', 'r2'],
    });
    expect(svg).toContain('a');
    expect(svg).toContain('b');
    expect(svg).toContain('r1');
    expect(svg).toContain('Correlation');
  });
});
