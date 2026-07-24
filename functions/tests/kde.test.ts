import { describe, it, expect } from 'vitest';
import { gaussianKDE } from '../src/index.js';

describe('gaussianKDE', () => {
  it('integrates to ~1 and peaks near the sample center', () => {
    const samples = [-2, -1.5, -1, -0.5, -0.5, 0, 0, 0, 0.5, 0.5, 1, 1.5, 2];
    const kde = gaussianKDE(samples);
    const grid: number[] = [];
    for (let x = -6; x <= 6; x += 0.05) grid.push(x);
    const dens = kde.evaluate(grid);
    const integral = dens.reduce((s, d) => s + d * 0.05, 0);
    expect(integral).toBeCloseTo(1, 1);
    expect(kde.evaluate([0])[0]).toBeGreaterThan(kde.evaluate([5])[0]);
    expect(kde.bandwidth).toBeGreaterThan(0);
  });
  it('respects an explicit bandwidth', () => {
    const kde = gaussianKDE([0, 1, 2, 3], { bandwidth: 0.5 });
    expect(kde.bandwidth).toBe(0.5);
    expect(kde.evaluate([1.5])[0]).toBeGreaterThan(0);
  });
});
