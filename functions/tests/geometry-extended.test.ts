/**
 * Extended Geometry Functions Tests
 *
 * Tests for 10 new geometry functions: area, centroid, coordinate transforms,
 * polygon perimeter, distance metrics, Delaunay, Voronoi, k-d tree.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  area,
  centroid,
  coordinateTransform,
  polygonPerimeter,
  manhattanDistance,
  chebyshevDistance,
  minkowskiDistance,
  delaunayTriangulation,
  voronoiDiagram,
  kdTree,
  kdTreeNearest,
  nearestNeighbor,
  distanceMatrix,
} from '../src/typed/geometry.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

const EPSILON = 1e-6;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// =============================================================================
// Area
// =============================================================================

describe('area', () => {
  it('should compute circle area', () => {
    expectClose(area({ type: 'circle', radius: 1 }), Math.PI);
  });

  it('should compute rectangle area', () => {
    expectClose(area({ type: 'rectangle', width: 3, height: 4 }), 12);
  });

  it('should compute triangle area', () => {
    const a = area({
      type: 'triangle',
      vertices: [[0, 0], [4, 0], [0, 3]],
    });
    expectClose(a, 6);
  });

  it('should compute polygon area', () => {
    const a = area({
      type: 'polygon',
      vertices: [[0, 0], [1, 0], [1, 1], [0, 1]],
    });
    expectClose(a, 1);
  });
});

// =============================================================================
// Centroid
// =============================================================================

describe('centroid', () => {
  it('should compute centroid of a square', () => {
    const c = centroid([[0, 0], [4, 0], [4, 4], [0, 4]]);
    expectClose(c[0], 2);
    expectClose(c[1], 2);
  });

  it('should compute centroid of a triangle', () => {
    const c = centroid([[0, 0], [3, 0], [0, 3]]);
    expectClose(c[0], 1, 0.1);
    expectClose(c[1], 1, 0.1);
  });
});

// =============================================================================
// Coordinate Transform
// =============================================================================

describe('coordinateTransform', () => {
  it('should convert cartesian to polar', () => {
    const polar = coordinateTransform([1, 0], 'cartesian', 'polar');
    expectClose(polar[0], 1);
    expectClose(polar[1], 0);
  });

  it('should convert polar to cartesian', () => {
    const cart = coordinateTransform([1, Math.PI / 2], 'polar', 'cartesian');
    expectClose(cart[0], 0, 1e-10);
    expectClose(cart[1], 1, 1e-10);
  });

  it('should round-trip cartesian -> spherical -> cartesian', () => {
    const original = [1, 2, 3];
    const sph = coordinateTransform(original, 'cartesian', 'spherical');
    const back = coordinateTransform(sph, 'spherical', 'cartesian');
    expectClose(back[0], 1, 1e-10);
    expectClose(back[1], 2, 1e-10);
    expectClose(back[2], 3, 1e-10);
  });

  it('should round-trip cartesian -> cylindrical -> cartesian', () => {
    const original = [1, 2, 3];
    const cyl = coordinateTransform(original, 'cartesian', 'cylindrical');
    const back = coordinateTransform(cyl, 'cylindrical', 'cartesian');
    expectClose(back[0], 1, 1e-10);
    expectClose(back[1], 2, 1e-10);
    expectClose(back[2], 3, 1e-10);
  });
});

// =============================================================================
// Polygon Perimeter
// =============================================================================

describe('polygonPerimeter', () => {
  it('should compute perimeter of a unit square', () => {
    const p = polygonPerimeter([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expectClose(p, 4);
  });

  it('should compute perimeter of a triangle', () => {
    const p = polygonPerimeter([[0, 0], [3, 0], [0, 4]]);
    expectClose(p, 12);
  });
});

// =============================================================================
// Distance Metrics
// =============================================================================

describe('manhattanDistance', () => {
  it('should compute L1 distance', () => {
    expectClose(manhattanDistance([0, 0], [3, 4]), 7);
  });

  it('should return 0 for same point', () => {
    expectClose(manhattanDistance([1, 2], [1, 2]), 0);
  });
});

describe('chebyshevDistance', () => {
  it('should compute L-infinity distance', () => {
    expectClose(chebyshevDistance([0, 0], [3, 7]), 7);
  });
});

describe('minkowskiDistance', () => {
  it('should match L1 for p=1', () => {
    expectClose(minkowskiDistance([0, 0], [3, 4], 1), 7);
  });

  it('should match L2 for p=2', () => {
    expectClose(minkowskiDistance([0, 0], [3, 4], 2), 5);
  });

  it('should match L-inf for p=Infinity', () => {
    expectClose(minkowskiDistance([0, 0], [3, 4], Infinity), 4);
  });

  it('should throw for p < 1', () => {
    expect(() => minkowskiDistance([0, 0], [1, 1], 0.5)).toThrow();
  });
});

// =============================================================================
// Delaunay Triangulation
// =============================================================================

describe('delaunayTriangulation', () => {
  it('should triangulate 3 points into 1 triangle', () => {
    const tris = delaunayTriangulation([[0, 0], [1, 0], [0.5, 1]]);
    expect(tris.length).toBe(1);
    expect(tris[0].length).toBe(3);
  });

  it('should triangulate 4 points into 2 triangles', () => {
    const tris = delaunayTriangulation([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(tris.length).toBe(2);
  });

  it('should handle fewer than 3 points', () => {
    expect(delaunayTriangulation([[0, 0], [1, 1]])).toEqual([]);
    expect(delaunayTriangulation([[0, 0]])).toEqual([]);
  });
});

// =============================================================================
// Voronoi Diagram
// =============================================================================

describe('voronoiDiagram', () => {
  it('should produce vertices and regions', () => {
    const result = voronoiDiagram(
      [[0, 0], [1, 0], [0.5, 1]],
      [-1, -1, 2, 2],
    );
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.regions.length).toBe(3);
  });
});

// =============================================================================
// K-D Tree
// =============================================================================

describe('kdTree', () => {
  it('should build a tree', () => {
    const tree = kdTree([[0, 0], [1, 1], [2, 2], [3, 3]]);
    expect(tree).not.toBeNull();
    expect(tree!.point.length).toBe(2);
  });

  it('should return null for empty input', () => {
    expect(kdTree([])).toBeNull();
  });
});

describe('kdTreeNearest', () => {
  it('should find nearest neighbor', () => {
    const tree = kdTree([[0, 0], [3, 3], [1, 1], [5, 5]]);
    const result = kdTreeNearest(tree, [0.9, 0.9]);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual([1, 1]);
    expect(result!.distance).toBeLessThan(0.2);
  });

  it('should find exact match', () => {
    const tree = kdTree([[0, 0], [1, 1], [2, 2]]);
    const result = kdTreeNearest(tree, [1, 1]);
    expect(result!.point).toEqual([1, 1]);
    expectClose(result!.distance, 0);
  });
});

// =============================================================================
// nearestNeighbor (one-shot convenience, WASM-accelerated)
// =============================================================================

describe('nearestNeighbor', () => {
  it('should find nearest neighbor in small set', () => {
    const result = nearestNeighbor(
      [[0, 0], [3, 3], [1, 1], [5, 5]],
      [0.9, 0.9],
    );
    expect(result).not.toBeNull();
    expect(result!.point).toEqual([1, 1]);
    expect(result!.distance).toBeLessThan(0.2);
  });

  it('should find exact match', () => {
    const result = nearestNeighbor(
      [[0, 0], [1, 1], [2, 2]],
      [1, 1],
    );
    expect(result!.index).toBe(1);
    expectClose(result!.distance, 0);
  });

  it('should return null for empty input', () => {
    expect(nearestNeighbor([], [1, 2])).toBeNull();
  });

  it('should work with 3D points', () => {
    const points = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [10, 10, 10]];
    const result = nearestNeighbor(points, [1.1, 1.1, 1.1]);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual([1, 1, 1]);
  });

  it('should handle larger point sets (>= 32 points)', () => {
    // Generate a grid of 64 points
    const points: number[][] = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        points.push([i, j]);
      }
    }
    const result = nearestNeighbor(points, [3.1, 4.9]);
    expect(result).not.toBeNull();
    expect(result!.point).toEqual([3, 5]);
  });
});

describe('distanceMatrix', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000 });
    await computePool.terminate();
  });

  it('computes the all-pairs Euclidean distance matrix', async () => {
    // 3-4-5 right triangle.
    const dm = await distanceMatrix([[0, 0], [3, 0], [0, 4]]);
    expect(dm).toEqual([
      [0, 3, 4],
      [3, 0, 5],
      [4, 5, 0],
    ]);
  });

  it('returns an empty result for no points', async () => {
    expect(await distanceMatrix([])).toEqual([]);
  });

  it('is symmetric with a zero diagonal', async () => {
    const pts = Array.from({ length: 20 }, (_, i) => [i, i * 0.5, -i]);
    const dm = await distanceMatrix(pts);
    for (let i = 0; i < pts.length; i++) {
      expect(dm[i][i]).toBe(0);
      for (let j = 0; j < pts.length; j++) {
        expect(dm[i][j]).toBeCloseTo(dm[j][i], 12);
      }
    }
  });

  it('parallel result matches the sequential result', async () => {
    const n = 256;
    const dim = 5;
    const pts = Array.from({ length: n }, (_, i) =>
      Array.from({ length: dim }, (_, k) => Math.sin(i * 0.3 + k * 1.7)),
    );

    computePool.updateConfig({ thresholdElements: 1_000_000 });
    const seq = await distanceMatrix(pts);

    computePool.updateConfig({ thresholdElements: 64 });
    const par = await distanceMatrix(pts);
    computePool.updateConfig({ thresholdElements: 1_000_000 });

    for (let i = 0; i < n; i += 31) {
      for (let j = 0; j < n; j += 17) {
        expect(par[i][j]).toBeCloseTo(seq[i][j], 12);
      }
    }
  });
});
