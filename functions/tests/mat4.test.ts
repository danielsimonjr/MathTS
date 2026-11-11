import { describe, expect, it } from 'vitest';
import {
  frustumContainsPoint,
  frustumFromMatrix,
  frustumIntersectsAabb,
  frustumIntersectsSphere,
  mat4Compose,
  mat4Decompose,
  mat4Determinant,
  mat4Invert,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
} from '../src/index.js';

const close = (a: ArrayLike<number>, b: ArrayLike<number>, tol = 1e-12): void => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThanOrEqual(tol);
};
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const M = [2, 1, 0, 0, -1, 3, 1, 0, 0.5, 0, 4, 0, 7, -2, 5, 1];

describe('mat4 kernels', () => {
  it('multiply: identity, aliasing and offsets', () => {
    const out = new Float64Array(16);
    mat4Multiply(out, M, I);
    close(out, M, 0);
    const a = Float64Array.from(M);
    const ref = new Float64Array(16);
    mat4Multiply(ref, M, M);
    mat4Multiply(a, a, a);
    close(a, ref, 0);
    const big = new Float64Array(40);
    big.set(M, 3);
    big.set(M, 20);
    mat4Multiply(big, big, big, 4, 3, 20);
    close(big.subarray(4, 20), ref, 0);
  });

  it('invert: m · m⁻¹ = I, aliasing, singular', () => {
    const inv = new Float64Array(16);
    expect(mat4Determinant(M)).not.toBe(0);
    mat4Invert(inv, M);
    const p = new Float64Array(16);
    mat4Multiply(p, M, inv);
    close(p, I);
    const a = Float64Array.from(M);
    mat4Invert(a, a);
    close(a, inv, 0);
    const s = new Float64Array(16);
    const singular = [1, 2, 3, 4, 2, 4, 6, 8, 0, 1, 0, 0, 0, 0, 1, 0];
    expect(mat4Determinant(singular)).toBe(0);
    mat4Invert(s, singular);
    expect(Array.from(s).some((v) => !Number.isFinite(v))).toBe(true);
  });

  it('compose then decompose round-trips; zero scale gives the identity rotation', () => {
    const q = [Math.cos(0.4), Math.sin(0.4) * 0.6, 0, Math.sin(0.4) * 0.8];
    const m = new Float64Array(16);
    mat4Compose(m, [1, -2, 3], q, [2, 0.5, 3]);
    const p = new Float64Array(3);
    const r = new Float64Array(4);
    const s = new Float64Array(3);
    mat4Decompose(p, r, s, m);
    close(p, [1, -2, 3]);
    close(r, q);
    close(s, [2, 0.5, 3]);
    mat4Compose(m, [1, 2, 3], q, [1, 0, 1]);
    mat4Decompose(p, r, s, m);
    expect(Array.from(r)).toEqual([1, 0, 0, 0]);
  });

  it('lookAt: eye to origin, target on -Z, inverse of the camera world matrix', () => {
    const eye = [3, 4, 5];
    const target = [-1, 2, 0.5];
    const v = new Float64Array(16);
    mat4LookAt(v, eye, target, [0, 1, 0]);
    const apply = (x: number[]): number[] =>
      [0, 1, 2, 3].map((r) => v[r]! * x[0]! + v[4 + r]! * x[1]! + v[8 + r]! * x[2]! + v[12 + r]!);
    close(apply(eye), [0, 0, 0, 1]);
    const d = Math.hypot(target[0]! - eye[0]!, target[1]! - eye[1]!, target[2]! - eye[2]!);
    close(apply(target), [0, 0, -d, 1]);
    // world = columns (s, u, -f, eye) = rows of v's 3x3, transposed.
    const world = [
      v[0]!,
      v[4]!,
      v[8]!,
      0,
      v[1]!,
      v[5]!,
      v[9]!,
      0,
      v[2]!,
      v[6]!,
      v[10]!,
      0,
      eye[0]!,
      eye[1]!,
      eye[2]!,
      1,
    ];
    const p = new Float64Array(16);
    mat4Multiply(p, v, world);
    close(p, I);
    const deg = new Float64Array(16);
    mat4LookAt(deg, eye, eye, [0, 1, 0]);
    expect(Number.isNaN(deg[0]!)).toBe(true);
    expect([deg[3], deg[7], deg[11], deg[15]]).toEqual([0, 0, 0, 1]);
  });

  it('perspective depth range: near maps to -1 or 0, far to +1', () => {
    for (const [range, nearZ] of [
      ['negative-one-to-one', -1],
      ['zero-to-one', 0],
    ] as const) {
      const m = new Float64Array(16);
      mat4Perspective(m, 1, 1.5, 0.5, 100, range);
      const zw = (z: number): number => (m[10]! * z + m[14]!) / (m[11]! * z + m[15]!);
      expect(zw(-0.5)).toBeCloseTo(nearZ, 12);
      expect(zw(-100)).toBeCloseTo(1, 12);
    }
  });
});

describe('frustum kernels', () => {
  const vp = new Float64Array(16);
  mat4Perspective(vp, 1.2, 1, 1, 50);
  const planes = new Float64Array(24);
  frustumFromMatrix(planes, vp);

  it('point, sphere and box inside and outside', () => {
    expect(frustumContainsPoint(planes, [0, 0, -10])).toBe(true);
    expect(frustumContainsPoint(planes, [0, 0, 10])).toBe(false);
    expect(frustumIntersectsSphere(planes, [0, 0, -0.5], 1)).toBe(true);
    expect(frustumIntersectsSphere(planes, [0, 0, 5], 1)).toBe(false);
    expect(frustumIntersectsAabb(planes, [-1, -1, -11], [1, 1, -9])).toBe(true);
    expect(frustumIntersectsAabb(planes, [-1, -1, 2], [1, 1, 4])).toBe(false);
  });

  it('NaN inputs answer true', () => {
    expect(frustumContainsPoint(planes, [Number.NaN, 0, 0])).toBe(true);
    expect(frustumIntersectsSphere(planes, [0, 0, 5], Number.NaN)).toBe(true);
    expect(frustumIntersectsAabb(planes, [0, 0, 2], [Number.NaN, Number.NaN, Number.NaN])).toBe(
      true
    );
    expect(frustumIntersectsAabb(planes, [Number.NaN, Number.NaN, Number.NaN], [0, 0, 2])).toBe(
      true
    );
  });

  it('a zero matrix gives the everything-inside plane; offsets and aliasing', () => {
    const p = new Float64Array(24);
    frustumFromMatrix(p, new Float64Array(16));
    for (let i = 0; i < 24; i += 4)
      expect([p[i], p[i + 1], p[i + 2], p[i + 3]]).toEqual([0, 0, 0, Infinity]);
    const big = new Float64Array(40);
    big.set(vp, 0);
    frustumFromMatrix(big, big, 'negative-one-to-one', 2, 0);
    close(big.subarray(2, 26), planes, 0);
    expect(frustumContainsPoint(big, [0, 0, -10], 2)).toBe(true);
  });
});
