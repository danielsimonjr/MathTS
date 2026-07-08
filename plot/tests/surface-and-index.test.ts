import { describe, it, expect } from 'vitest';
import * as P from '../src/index.js';

describe('public surface', () => {
  it('exports every documented function', () => {
    for (const n of [
      'plot',
      'line',
      'scatter',
      'bar',
      'area',
      'step',
      'histogram',
      'errorbar',
      'quiver',
      'contour',
      'heatmap',
      'overlay',
      'surface',
      'scatter3d',
      'curve3d',
    ]) {
      expect(typeof (P as Record<string, unknown>)[n]).toBe('function');
    }
  });
});
