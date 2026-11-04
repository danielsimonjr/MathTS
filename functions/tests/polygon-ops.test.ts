import { describe, it, expect } from 'vitest';
import { polygonArea, convexHull2D } from '../src/typed/geometry.js';
import { polygonClip, minkowskiSum, earClipping } from '../src/geometry/polygon-ops.js';

const square = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const Lshape = [
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
];
const triArea = (
  poly: readonly (readonly number[])[],
  tris: Array<[number, number, number]>
): number =>
  tris.reduce((s, [a, b, c]) => {
    const A = poly[a];
    const B = poly[b];
    const C = poly[c];
    return s + Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  }, 0);

describe('polygon ops', () => {
  it('polygonClip of two overlapping unit-offset squares has area 1', () => {
    const sq02 = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    const sq13 = [
      [1, 1],
      [3, 1],
      [3, 3],
      [1, 3],
    ];
    const clipped = polygonClip(sq02, sq13);
    expect(polygonArea(clipped.map((p) => [...p]))).toBeCloseTo(1, 12);
  });

  it('polygonClip with a disjoint clip returns empty', () => {
    const far = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
    ];
    expect(polygonClip(square, far)).toEqual([]);
  });

  it('minkowskiSum of the unit square with itself has area 4', () => {
    const M = minkowskiSum(square, square);
    expect(polygonArea(convexHull2D(M.map((p) => [...p])).map((p) => [...p]))).toBeCloseTo(4, 12);
  });

  it('earClipping of the square gives 2 triangles of total area 1', () => {
    const tris = earClipping(square);
    expect(tris.length).toBe(2);
    expect(triArea(square, tris)).toBeCloseTo(1, 12);
  });

  it('earClipping of the L-shape gives 4 triangles covering its area', () => {
    const tris = earClipping(Lshape);
    expect(tris.length).toBe(4);
    expect(triArea(Lshape, tris)).toBeCloseTo(polygonArea(Lshape), 12);
  });
});
