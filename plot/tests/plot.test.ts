import { describe, it, expect } from 'vitest';
import { plot } from '../src/plot.js';

describe('plot (data forms)', () => {
  it('plot(y) draws a line using indices for x', () => {
    expect(plot([1, 4, 9])).toContain('<polyline');
  });
  it('plot(x, y) draws a line', () => {
    expect(plot([0, 1, 2], [0, 1, 4])).toContain('<polyline');
  });
  it('plot(layers) overlays', () => {
    const svg = plot(
      [
        { type: 'line', x: [0, 1], y: [0, 1], label: 'a' },
        { type: 'scatter', x: [0, 1], y: [1, 0], label: 'b' },
      ],
      { legend: true }
    );
    expect(svg).toContain('<polyline');
    expect(svg).toContain('<circle');
  });
});
