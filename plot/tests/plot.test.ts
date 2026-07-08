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

describe('plot (expression form)', () => {
  it('plots a 1-var expression as a line', () => {
    const svg = plot('sin(x)', { from: 0, to: Math.PI, samples: 50 });
    expect(svg).toContain('<polyline');
  });
  it('plots a 2-var expression as a contour by default', () => {
    const svg = plot('x^2 + y^2', { from: -2, to: 2, samples: 15 });
    expect(svg).toMatch(/<line|<polygon/); // contour segments (or surface if kind set)
  });
  it('plots a 2-var expression as a surface when kind is 3d', () => {
    const svg = plot('x^2 + y^2', { from: -2, to: 2, samples: 10, kind: 'surface' });
    expect(svg).toContain('<polygon');
  });
  it('plots a 1-var expression using a non-allowlisted function (tanh) as a line', () => {
    const svg = plot('tanh(x)', { from: -3, to: 3, samples: 40 });
    expect(svg).toContain('<polyline'); // was blank before the freeVars fix (tanh mistaken for a 2nd var)
  });
});
