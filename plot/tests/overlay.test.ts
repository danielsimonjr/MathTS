import { describe, it, expect } from 'vitest';
import { overlay } from '../src/overlay.js';

describe('overlay', () => {
  it('renders line + scatter on shared axes with a legend', () => {
    const svg = overlay(
      [
        { type: 'line', x: [0, 1, 2], y: [0, 1, 2], label: 'model' },
        { type: 'scatter', x: [0, 1, 2], y: [0.1, 1.2, 1.8], label: 'data' },
      ],
      { legend: true }
    );
    expect(svg).toContain('<polyline');
    expect(svg).toContain('<circle');
    expect(svg).toContain('model');
    expect(svg).toContain('data');
  });
});
