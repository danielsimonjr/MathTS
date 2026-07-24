/**
 * Geometry breadth follow-up (quaternion exp/log/pow + 3-D intersections).
 *
 * Oracles:
 * - quaternionPow pinned against scipy.spatial.transform.Rotation (rotvec
 *   scaling), scalar-first `[w,x,y,z]` reordered from scipy's `[x,y,z,w]`.
 * - quaternionExp/Log round-trip (closed-form inverse of each other).
 * - rayTriangleIntersect / rayPlaneIntersect / segmentSegmentClosest pinned
 *   against hand-derived closed-form values (Möller–Trumbore / plane
 *   equation / Ericson's ClosestPtSegmentSegment).
 */
import { describe, it, expect } from 'vitest';
import {
  quaternionExp,
  quaternionLog,
  quaternionPow,
  quaternionFromAxisAngle,
  rayTriangleIntersect,
  rayPlaneIntersect,
  segmentSegmentClosest,
} from '../src/index.js';

function expectClose(actual: number[], expected: number[], tol: number): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], -Math.log10(tol));
  }
}

describe('gap geometry breadth oracle — quaternion exp/log/pow', () => {
  const TOL = 1e-9;
  // 90-degree rotation about z: scalar-first [w, x, y, z]. Verified against
  // scipy: R.from_euler('z', 90, degrees=True).as_quat() == [0,0,0.70710678,0.70710678]
  // (scipy is scalar-last [x,y,z,w]) -> scalar-first [0.70710678, 0, 0, 0.70710678].
  const q90z = quaternionFromAxisAngle([0, 0, 1], Math.PI / 2);

  it('quaternionFromAxisAngle matches the expected 90-degree-about-z quaternion', () => {
    expectClose(q90z, [0.70710678, 0, 0, 0.70710678], 1e-8);
  });

  it('quaternionPow(q, 0.5) halves the rotation angle (45 degrees about z)', () => {
    const half = quaternionPow(q90z, 0.5);
    expectClose(half, [0.92387953, 0, 0, 0.38268343], 1e-8);
  });

  it('quaternionPow(q, 2) doubles the rotation angle (180 degrees about z)', () => {
    const doubled = quaternionPow(q90z, 2);
    expectClose(doubled, [0, 0, 0, 1], TOL);
  });

  it('quaternionPow(q, 1) returns q unchanged', () => {
    const same = quaternionPow(q90z, 1);
    expectClose(same, q90z as number[], TOL);
  });

  it('quaternionPow(q, 0) returns the identity quaternion', () => {
    const identity = quaternionPow(q90z, 0);
    expectClose(identity, [1, 0, 0, 0], TOL);
  });

  it('quaternionLog(identity) is the zero quaternion', () => {
    expectClose(quaternionLog([1, 0, 0, 0]), [0, 0, 0, 0], TOL);
  });

  it('quaternionExp(zero) is the identity quaternion', () => {
    expectClose(quaternionExp([0, 0, 0, 0]), [1, 0, 0, 0], TOL);
  });

  it('quaternionExp(quaternionLog(q)) round-trips for several unit quaternions', () => {
    const samples: number[][] = [
      [1, 0, 0, 0],
      q90z as number[],
      quaternionFromAxisAngle([1, 0, 0], Math.PI / 3),
      quaternionFromAxisAngle([1, 1, 1], 1.234),
      quaternionFromAxisAngle([0, 1, 0], 2.5),
    ];
    for (const q of samples) {
      const roundTripped = quaternionExp(quaternionLog(q));
      expectClose(roundTripped, q, 1e-10);
    }
  });
});

describe('gap geometry breadth oracle — 3-D ray/segment intersections', () => {
  const TOL = 1e-9;

  it('rayTriangleIntersect hits the triangle interior at the expected point/t', () => {
    const hit = rayTriangleIntersect([0.25, 0.25, -1], [0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0]);
    expect(hit).not.toBeNull();
    expectClose(hit!.point, [0.25, 0.25, 0], TOL);
    expect(hit!.t).toBeCloseTo(1, 9);
  });

  it('rayTriangleIntersect returns null for a ray that misses the triangle', () => {
    const miss = rayTriangleIntersect([2, 2, -1], [0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0]);
    expect(miss).toBeNull();
  });

  it('rayTriangleIntersect returns null for a ray parallel to the triangle plane', () => {
    const parallel = rayTriangleIntersect(
      [0.25, 0.25, -1],
      [1, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    );
    expect(parallel).toBeNull();
  });

  it('rayPlaneIntersect hits the plane at the expected point/t', () => {
    const hit = rayPlaneIntersect([0, 0, -1], [0, 0, 1], [0, 0, 0], [0, 0, 1]);
    expect(hit).not.toBeNull();
    expectClose(hit!.point, [0, 0, 0], TOL);
    expect(hit!.t).toBeCloseTo(1, 9);
  });

  it('rayPlaneIntersect returns null for a ray parallel to the plane', () => {
    const parallel = rayPlaneIntersect([0, 0, -1], [1, 0, 0], [0, 0, 0], [0, 0, 1]);
    expect(parallel).toBeNull();
  });

  it('segmentSegmentClosest returns distance 1 for parallel unit-apart segments', () => {
    const result = segmentSegmentClosest([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]);
    expect(result.distance).toBeCloseTo(1, 9);
  });

  it('segmentSegmentClosest returns distance 0 at the crossing point for intersecting segments', () => {
    const result = segmentSegmentClosest([0, 0, 0], [1, 1, 0], [0, 1, 0], [1, 0, 0]);
    expect(result.distance).toBeCloseTo(0, 9);
    expectClose(result.point1, [0.5, 0.5, 0], TOL);
    expectClose(result.point2, [0.5, 0.5, 0], TOL);
  });
});
