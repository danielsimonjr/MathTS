import { describe, it, expect } from 'vitest';
import {
  line,
  scatter,
  bar,
  area,
  step,
  histogram,
  errorbar,
  quiver,
  contour,
  heatmap,
  overlay,
  surface,
  scatter3d,
  curve3d,
} from '../src/index.js';

// Fixed inputs → deterministic output. Exercises every mark + legend + xLabel + yLabel
// (the rotated-text bypass) + the alpha area fill + scatter3d depth opacity + no-data.
const grid = [
  [0, 1, 0],
  [1, 2, 1],
  [0, 1, 0],
];

describe('golden SVG output (behavior lock — must not change across the scene refactor)', () => {
  it('line', () =>
    expect(
      line([0, 1, 2, 3], [0, 1, 4, 9], { title: 'sq', xLabel: 'x', yLabel: 'y' })
    ).toMatchSnapshot());
  it('scatter', () => expect(scatter([0, 1, 2], [1, 2, 3])).toMatchSnapshot());
  it('bar', () => expect(bar([0, 1, 2], [3, 1, 2])).toMatchSnapshot());
  it('area', () => expect(area([0, 1, 2], [1, 2, 1])).toMatchSnapshot());
  it('step', () => expect(step([0, 1, 2], [1, 2, 3])).toMatchSnapshot());
  it('histogram', () =>
    expect(histogram([1, 2, 2, 3, 3, 3, 4, 4, 4, 4], { bins: 4 })).toMatchSnapshot());
  it('errorbar', () => expect(errorbar([0, 1, 2], [1, 2, 3], [0.2, 0.2, 0.2])).toMatchSnapshot());
  it('quiver', () => expect(quiver([0, 1], [0, 0], [1, 1], [1, -1])).toMatchSnapshot());
  it('overlay+legend+ylabel', () =>
    expect(
      overlay(
        [
          { type: 'line', x: [0, 1, 2], y: [0, 1, 2], label: 'model' },
          { type: 'scatter', x: [0, 1, 2], y: [0.1, 1.2, 1.8], label: 'data' },
        ],
        { legend: true, xLabel: 'x', yLabel: 'y' }
      )
    ).toMatchSnapshot());
  it('contour', () => expect(contour(grid, { levels: 5 })).toMatchSnapshot());
  it('heatmap', () => expect(heatmap(grid)).toMatchSnapshot());
  it('surface', () =>
    expect(surface(grid, { kind: 'filled', azim: 45, elev: 25 })).toMatchSnapshot());
  it('scatter3d', () => expect(scatter3d([0, 1, 2], [0, 1, 0], [1, 0, 1])).toMatchSnapshot());
  it('curve3d', () => expect(curve3d([0, 1, 2], [0, 1, 0], [0, 0.5, 1])).toMatchSnapshot());
  it('no-data', () => expect(line([], [])).toMatchSnapshot());
});
