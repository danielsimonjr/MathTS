import { describe, it, expect } from 'vitest';
import {
  orient2D,
  orient3D,
  inCircle,
  pointInTriangle,
  barycentricCoordinates,
  polygonIsConvex,
} from '../src/geometry/predicates.js';

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

describe('geometry predicates', () => {
  it('orient2D signs', () => {
    expect(orient2D([0, 0], [1, 0], [0, 1])).toBe(1);
    expect(orient2D([0, 0], [0, 1], [1, 0])).toBe(-1);
    expect(orient2D([0, 0], [1, 1], [2, 2])).toBe(0);
  });

  it('orient3D signs', () => {
    expect(orient3D([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(1);
    expect(orient3D([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1])).toBe(-1);
    expect(orient3D([0, 0, 0], [1, 0, 0], [0, 1, 0], [5, 5, 0])).toBe(0);
  });

  it('inCircle: inside, outside and on the circle', () => {
    expect(inCircle([0, 0], [1, 0], [0, 1], [0.2, 0.2])).toBe(1);
    expect(inCircle([0, 0], [1, 0], [0, 1], [2, 2])).toBe(-1);
    expect(inCircle([0, 0], [1, 0], [0, 1], [1, 1])).toBe(0);
  });

  it('pointInTriangle in both orientations', () => {
    expect(pointInTriangle([0.2, 0.2], [0, 0], [1, 0], [0, 1])).toBe(true);
    expect(pointInTriangle([0.2, 0.2], [0, 1], [1, 0], [0, 0])).toBe(true);
    expect(pointInTriangle([1, 1], [0, 0], [1, 0], [0, 1])).toBe(false);
    expect(pointInTriangle([0.5, 0.5], [0, 0], [1, 0], [0, 1])).toBe(true);
  });

  it('barycentricCoordinates of the centroid', () => {
    const [u, v, w] = barycentricCoordinates([1 / 3, 1 / 3], [0, 0], [1, 0], [0, 1]);
    expect(u).toBeCloseTo(1 / 3, 12);
    expect(v).toBeCloseTo(1 / 3, 12);
    expect(w).toBeCloseTo(1 / 3, 12);
  });

  it('barycentricCoordinates throws on a degenerate triangle', () => {
    expect(() => barycentricCoordinates([0, 0], [0, 0], [1, 1], [2, 2])).toThrow(RangeError);
  });

  it('polygonIsConvex: square convex, L-shape not', () => {
    expect(polygonIsConvex(square)).toBe(true);
    expect(polygonIsConvex(Lshape)).toBe(false);
    expect(polygonIsConvex([[0, 0]])).toBe(false);
  });
});
