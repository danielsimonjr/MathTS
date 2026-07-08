import { describe, it, expect } from 'vitest';
import { contour } from '../src/contour.js';

describe('contour', () => {
  it('draws contour segments for a bowl z=x^2+y^2 (geometry oracle: non-empty)', () => {
    const n = 21;
    const z: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const x = (j - 10) / 5;
        const y = (i - 10) / 5;
        row.push(x * x + y * y);
      }
      z.push(row);
    }
    const svg = contour(z, { levels: 5 });
    expect((svg.match(/<line/g) ?? []).length).toBeGreaterThan(20); // closed rings → many segments
  });
  it('flat field → no interior contours, still returns an svg', () => {
    const svg = contour(
      [
        [1, 1],
        [1, 1],
      ],
      { levels: 3 }
    );
    expect(svg).toMatch(/^<svg/);
  });
});
