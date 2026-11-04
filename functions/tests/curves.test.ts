import { describe, it, expect } from 'vitest';
import {
  douglasPeucker,
  hausdorffDistance,
  frechetDistance,
  closestPair,
  minimumEnclosingCircle,
  catmullRom,
  arcLength,
  curvature,
} from '../src/geometry/curves.js';

describe('geometry curves', () => {
  it('douglasPeucker simplifies the reference polyline', () => {
    const pts = [
      [0, 0],
      [1, 0.1],
      [2, -0.1],
      [3, 5],
      [4, 6],
      [5, 7],
      [6, 8.1],
      [7, 9],
      [8, 9],
      [9, 9],
    ];
    expect(douglasPeucker(pts, 1)).toEqual([
      [0, 0],
      [2, -0.1],
      [3, 5],
      [7, 9],
      [9, 9],
    ]);
  });

  it('hausdorffDistance of two parallel segments', () => {
    expect(
      hausdorffDistance(
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ]
      )
    ).toBeCloseTo(1, 12);
  });

  it('frechetDistance of the reference polylines', () => {
    expect(
      frechetDistance(
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
          [2, 1],
        ]
      )
    ).toBeCloseTo(1.4142135623730951, 12);
  });

  it('closestPair of four points', () => {
    const r = closestPair([
      [0, 0],
      [5, 5],
      [1, 1],
      [10, 10],
    ]);
    expect(r.distance).toBeCloseTo(1.4142135623730951, 12);
    expect([r.i, r.j]).toEqual([0, 2]);
  });

  it('closestPair agrees with brute force on a larger set', () => {
    const pts: number[][] = [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 200; k++) pts.push([rnd() * 100, rnd() * 100]);
    let best = Infinity;
    for (let a = 0; a < pts.length; a++)
      for (let b = a + 1; b < pts.length; b++)
        best = Math.min(best, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
    expect(closestPair(pts).distance).toBeCloseTo(best, 12);
  });

  it('minimumEnclosingCircle of a square', () => {
    const mec = minimumEnclosingCircle([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    expect(mec.center[0]).toBeCloseTo(1, 9);
    expect(mec.center[1]).toBeCloseTo(1, 9);
    expect(mec.radius).toBeCloseTo(1.4142135623730951, 9);
  });

  it('minimumEnclosingCircle of collinear points is the segment circle', () => {
    const mec = minimumEnclosingCircle([
      [0, 0],
      [1, 0],
      [4, 0],
    ]);
    expect(mec.radius).toBeCloseTo(2, 9);
    expect(mec.center[0]).toBeCloseTo(2, 9);
  });

  it('catmullRom passes through the midpoint of collinear uniform points', () => {
    const p = catmullRom([0, 0], [1, 1], [2, 2], [3, 3], 0.5);
    expect(p[0]).toBeCloseTo(1.5, 12);
    expect(p[1]).toBeCloseTo(1.5, 12);
  });

  it('catmullRom interpolates its end points', () => {
    const p = catmullRom([0, 0], [1, 0], [2, 1], [3, 1], 0);
    expect(p[0]).toBeCloseTo(1, 12);
    expect(p[1]).toBeCloseTo(0, 12);
    const q = catmullRom([0, 0], [1, 0], [2, 1], [3, 1], 1);
    expect(q[0]).toBeCloseTo(2, 12);
    expect(q[1]).toBeCloseTo(1, 12);
  });

  it('arcLength of the unit circle is 2*pi', () => {
    const L = arcLength((t) => [Math.cos(t), Math.sin(t)], 0, 2 * Math.PI);
    expect(L).toBeCloseTo(2 * Math.PI, 8);
  });

  it('curvature of a circle of radius 2 is 1/2', () => {
    expect(curvature((t) => [2 * Math.cos(t), 2 * Math.sin(t)], 1)).toBeCloseTo(0.5, 6);
  });
});

describe('arcLength reversed bounds', () => {
  it('is non-negative for a > b', async () => {
    const { arcLength } = await import('../src/geometry/curves.js');
    expect(arcLength((t) => [t, 0], 1, 0)).toBeCloseTo(1, 8);
  });
});
