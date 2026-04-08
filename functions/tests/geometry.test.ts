/**
 * Geometry Functions Tests
 *
 * Tests for all 18 geometry functions: angles, products, areas,
 * spatial queries, transforms, distances, and intersections.
 */

import { describe, it, expect } from 'vitest';
import {
  angle2D,
  angle3D,
  cross3D,
  dot3D,
  triangleArea,
  polygonArea,
  convexHull,
  pointInPolygon,
  rotateVector2D,
  rotateVector3D,
  reflectVector,
  projectVector,
  distance2D,
  distance3D,
  distanceND,
  distancePointToLine2D,
  intersectLines2D,
  intersectSegments2D,
} from '../src/typed/geometry.js';

const EPSILON = 1e-10;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

function expectVecClose(actual: number[], expected: number[], tol = EPSILON) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expectClose(actual[i], expected[i], tol);
  }
}

// =============================================================================
// Angle Functions
// =============================================================================

describe('angle2D', () => {
  it('should return pi/2 for perpendicular vectors', () => {
    expectClose(angle2D([1, 0], [0, 1]), Math.PI / 2);
  });

  it('should return 0 for parallel vectors', () => {
    expectClose(angle2D([1, 0], [2, 0]), 0);
  });

  it('should return pi for anti-parallel vectors', () => {
    expectClose(angle2D([1, 0], [-1, 0]), Math.PI);
  });

  it('should return pi/4 for 45-degree angle', () => {
    expectClose(angle2D([1, 0], [1, 1]), Math.PI / 4);
  });

  it('should return NaN for zero vector', () => {
    expect(angle2D([0, 0], [1, 0])).toBeNaN();
  });
});

describe('angle3D', () => {
  it('should return pi/2 for perpendicular 3D vectors', () => {
    expectClose(angle3D([1, 0, 0], [0, 1, 0]), Math.PI / 2);
  });

  it('should return 0 for parallel 3D vectors', () => {
    expectClose(angle3D([1, 0, 0], [3, 0, 0]), 0);
  });

  it('should return pi for anti-parallel 3D vectors', () => {
    expectClose(angle3D([0, 0, 1], [0, 0, -1]), Math.PI);
  });
});

// =============================================================================
// Products
// =============================================================================

describe('cross3D', () => {
  it('should compute cross product of unit vectors', () => {
    expectVecClose(cross3D([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });

  it('should return zero vector for parallel vectors', () => {
    expectVecClose(cross3D([1, 0, 0], [2, 0, 0]), [0, 0, 0]);
  });

  it('should be anti-commutative', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const ab = cross3D(a, b);
    const ba = cross3D(b, a);
    expectVecClose(ab, ba.map((v) => -v));
  });
});

describe('dot3D', () => {
  it('should compute dot product', () => {
    expect(dot3D([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('should compute dot product of same vector', () => {
    expect(dot3D([1, 2, 3], [1, 2, 3])).toBe(14);
  });
});

// =============================================================================
// Areas
// =============================================================================

describe('triangleArea', () => {
  it('should compute area of right triangle', () => {
    expectClose(triangleArea([0, 0], [1, 0], [0, 1]), 0.5);
  });

  it('should return 0 for degenerate triangle', () => {
    expectClose(triangleArea([0, 0], [1, 0], [2, 0]), 0);
  });

  it('should compute area of larger triangle', () => {
    expectClose(triangleArea([0, 0], [4, 0], [0, 3]), 6);
  });
});

describe('polygonArea', () => {
  it('should compute area of unit square', () => {
    expectClose(
      polygonArea([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
      1
    );
  });

  it('should compute area of rectangle', () => {
    expectClose(
      polygonArea([
        [0, 0],
        [3, 0],
        [3, 2],
        [0, 2],
      ]),
      6
    );
  });

  it('should return 0 for fewer than 3 vertices', () => {
    expect(
      polygonArea([
        [0, 0],
        [1, 0],
      ])
    ).toBe(0);
  });
});

// =============================================================================
// Spatial Queries
// =============================================================================

describe('convexHull', () => {
  it('should compute hull of square with interior point', () => {
    const points = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ];
    const hull = convexHull(points);
    expect(hull.length).toBe(4);
  });

  it('should handle collinear points', () => {
    const points = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const hull = convexHull(points);
    expect(hull.length).toBe(2); // only endpoints
  });

  it('should handle single point', () => {
    const hull = convexHull([[1, 2]]);
    expect(hull.length).toBe(1);
  });

  it('should handle triangle', () => {
    const points = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    const hull = convexHull(points);
    expect(hull.length).toBe(3);
  });
});

describe('pointInPolygon', () => {
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  it('should detect point inside polygon', () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
  });

  it('should detect point outside polygon', () => {
    expect(pointInPolygon([2, 2], square)).toBe(false);
  });

  it('should detect point outside (negative)', () => {
    expect(pointInPolygon([-1, 0.5], square)).toBe(false);
  });
});

// =============================================================================
// Transform Functions
// =============================================================================

describe('rotateVector2D', () => {
  it('should rotate by pi/2', () => {
    expectVecClose(rotateVector2D([1, 0], Math.PI / 2), [0, 1]);
  });

  it('should rotate by pi', () => {
    expectVecClose(rotateVector2D([1, 0], Math.PI), [-1, 0]);
  });

  it('should rotate by 0 (identity)', () => {
    expectVecClose(rotateVector2D([3, 4], 0), [3, 4]);
  });
});

describe('rotateVector3D', () => {
  it('should rotate around z-axis by pi/2', () => {
    expectVecClose(rotateVector3D([1, 0, 0], [0, 0, 1], Math.PI / 2), [0, 1, 0]);
  });

  it('should rotate around x-axis by pi/2', () => {
    expectVecClose(rotateVector3D([0, 1, 0], [1, 0, 0], Math.PI / 2), [0, 0, 1]);
  });

  it('should handle zero axis gracefully', () => {
    const result = rotateVector3D([1, 2, 3], [0, 0, 0], Math.PI);
    expectVecClose(result, [1, 2, 3]);
  });
});

describe('reflectVector', () => {
  it('should reflect across x-axis normal', () => {
    expectVecClose(reflectVector([1, 1], [0, 1]), [1, -1]);
  });

  it('should reflect 3D vector', () => {
    expectVecClose(reflectVector([1, 1, 0], [0, 1, 0]), [1, -1, 0]);
  });
});

describe('projectVector', () => {
  it('should project onto x-axis', () => {
    expectVecClose(projectVector([3, 4], [1, 0]), [3, 0]);
  });

  it('should project onto diagonal', () => {
    expectVecClose(projectVector([2, 0], [1, 1]), [1, 1]);
  });

  it('should handle zero target', () => {
    expectVecClose(projectVector([1, 2], [0, 0]), [0, 0]);
  });
});

// =============================================================================
// Distance Functions
// =============================================================================

describe('distance2D', () => {
  it('should compute distance between origin and (3,4)', () => {
    expectClose(distance2D([0, 0], [3, 4]), 5);
  });

  it('should return 0 for same point', () => {
    expectClose(distance2D([1, 2], [1, 2]), 0);
  });
});

describe('distance3D', () => {
  it('should compute 3D distance', () => {
    expectClose(distance3D([0, 0, 0], [1, 2, 2]), 3);
  });
});

describe('distanceND', () => {
  it('should compute N-dimensional distance', () => {
    expectClose(distanceND([0, 0, 0, 0], [1, 1, 1, 1]), 2);
  });

  it('should handle 2D case', () => {
    expectClose(distanceND([0, 0], [3, 4]), 5);
  });
});

describe('distancePointToLine2D', () => {
  it('should compute perpendicular distance', () => {
    expectClose(distancePointToLine2D([0, 1], [0, 0], [1, 0]), 1);
  });

  it('should compute distance to endpoint', () => {
    expectClose(distancePointToLine2D([2, 0], [0, 0], [1, 0]), 1);
  });

  it('should handle degenerate segment', () => {
    expectClose(distancePointToLine2D([3, 4], [0, 0], [0, 0]), 5);
  });
});

// =============================================================================
// Intersection Functions
// =============================================================================

describe('intersectLines2D', () => {
  it('should find intersection of perpendicular lines through origin', () => {
    const result = intersectLines2D([0, 0], [1, 0], [0, 0], [0, 1]);
    expect(result).not.toBeNull();
    expectVecClose(result!, [0, 0]);
  });

  it('should find intersection of crossing lines', () => {
    // Line 1: (0,0) + t*(1,1), Line 2: (1,0) + s*(0,1) => intersection at (1,1)
    const result = intersectLines2D([0, 0], [1, 1], [1, 0], [0, 1]);
    expect(result).not.toBeNull();
    expectVecClose(result!, [1, 1], 1e-6);
  });

  it('should return null for parallel lines', () => {
    expect(intersectLines2D([0, 0], [1, 0], [0, 1], [1, 0])).toBeNull();
  });
});

describe('intersectSegments2D', () => {
  it('should find intersection of crossing segments', () => {
    const result = intersectSegments2D([0, 0], [1, 1], [0, 1], [1, 0]);
    expect(result).not.toBeNull();
    expectVecClose(result!, [0.5, 0.5]);
  });

  it('should return null for non-intersecting segments', () => {
    const result = intersectSegments2D([0, 0], [1, 0], [0, 1], [1, 1]);
    expect(result).toBeNull();
  });

  it('should return null for parallel segments', () => {
    const result = intersectSegments2D([0, 0], [1, 0], [0, 1], [1, 1]);
    expect(result).toBeNull();
  });
});
