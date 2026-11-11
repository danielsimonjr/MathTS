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
  mat4Orthographic,
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

describe('review: orientation, offsets, guards and boundaries', () => {
  it('lookAt from +Z at the origin is the identity rotation and translates by -5', () => {
    const v = new Float64Array(16);
    mat4LookAt(v, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    close(v, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1], 0);
  });

  it('lookAt, perspective and frustum agree as a pipeline', () => {
    const view = new Float64Array(16);
    mat4LookAt(view, [10, 0, 0], [0, 0, 0], [0, 1, 0]);
    const proj = new Float64Array(16);
    mat4Perspective(proj, 1, 1, 1, 100);
    const vp = mat4Multiply(new Float64Array(16), proj, view);
    const planes = frustumFromMatrix(new Float64Array(24), vp);
    expect(frustumContainsPoint(planes, [0, 0, 0])).toBe(true); // in front of the camera
    expect(frustumContainsPoint(planes, [20, 0, 0])).toBe(false); // behind it
    expect(frustumContainsPoint(planes, [0, 0, 8])).toBe(false); // outside the left/right planes
  });

  it('every kernel honours every offset', () => {
    const pad = (xs: ArrayLike<number>, off: number): Float64Array => {
      const a = new Float64Array(off + xs.length + 3).fill(Number.NaN);
      a.set(xs, off);
      return a;
    };
    const q = [Math.cos(0.4), Math.sin(0.4) * 0.6, 0, Math.sin(0.4) * 0.8];
    const P = [1, -2, 3];
    const S = [2, 0.5, 3];
    const ref = (f: (o: Float64Array) => unknown, n: number): Float64Array => {
      const o = new Float64Array(n);
      f(o);
      return o;
    };
    const check = (
      n: number,
      plain: (o: Float64Array) => unknown,
      shifted: (o: Float64Array) => unknown
    ): void => {
      const want = ref(plain, n);
      const o = new Float64Array(n + 9).fill(Number.NaN);
      shifted(o);
      close(o.subarray(5, 5 + n), want, 0);
      expect(Number.isNaN(o[4]!) && Number.isNaN(o[5 + n]!)).toBe(true);
    };
    check(
      16,
      (o) => mat4Invert(o, M),
      (o) => mat4Invert(o, pad(M, 2), 5, 2)
    );
    expect(mat4Determinant(pad(M, 3), 3)).toBe(mat4Determinant(M));
    check(
      16,
      (o) => mat4Compose(o, P, q, S),
      (o) => mat4Compose(o, pad(P, 1), pad(q, 2), pad(S, 3), 5, 1, 2, 3)
    );
    check(
      16,
      (o) => mat4LookAt(o, [3, 4, 5], [-1, 2, 0.5], [0, 1, 0]),
      (o) => mat4LookAt(o, pad([3, 4, 5], 1), pad([-1, 2, 0.5], 2), pad([0, 1, 0], 3), 5, 1, 2, 3)
    );
    check(
      16,
      (o) => mat4Perspective(o, 1, 1.5, 0.5, 100, 'zero-to-one'),
      (o) => mat4Perspective(o, 1, 1.5, 0.5, 100, 'zero-to-one', 5)
    );
    check(
      16,
      (o) => mat4Orthographic(o, -2, 3, -1, 4, 0.5, 9, 'zero-to-one'),
      (o) => mat4Orthographic(o, -2, 3, -1, 4, 0.5, 9, 'zero-to-one', 5)
    );
    check(
      24,
      (o) => frustumFromMatrix(o, M),
      (o) => frustumFromMatrix(o, pad(M, 2), 'negative-one-to-one', 5, 2)
    );
    const m = mat4Compose(new Float64Array(16), P, q, S);
    const dp = new Float64Array(8).fill(Number.NaN);
    const dr = new Float64Array(9).fill(Number.NaN);
    const ds = new Float64Array(8).fill(Number.NaN);
    mat4Decompose(dp, dr, ds, pad(m, 4), 2, 3, 4, 4);
    close(dp.subarray(2, 5), P, 1e-12);
    close(dr.subarray(3, 7), q, 1e-12);
    close(ds.subarray(4, 7), S, 1e-12);
    const vp = new Float64Array(16);
    mat4Perspective(vp, 1.2, 1, 1, 50);
    const pl = pad(frustumFromMatrix(new Float64Array(24), vp), 3);
    for (const [pt, inside] of [
      [[0, 0, -10], true],
      [[0, 0, 10], false],
    ] as const) {
      expect(frustumContainsPoint(pl, pad(pt, 2), 3, 2)).toBe(inside);
      expect(frustumIntersectsSphere(pl, pad(pt, 1), 0.5, 3, 1)).toBe(inside);
      const lo = [pt[0] - 1, pt[1] - 1, pt[2] - 1];
      const hi = [pt[0] + 1, pt[1] + 1, pt[2] + 1];
      expect(frustumIntersectsAabb(pl, pad(lo, 1), pad(hi, 2), 3, 1, 2)).toBe(inside);
    }
  });

  it('decompose: a zero scale on any axis gives the identity rotation', () => {
    const q = [Math.cos(0.4), Math.sin(0.4) * 0.6, 0, Math.sin(0.4) * 0.8];
    for (const s of [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ]) {
      const m = mat4Compose(new Float64Array(16), [1, 2, 3], q, s);
      const r = new Float64Array(4);
      mat4Decompose(new Float64Array(3), r, new Float64Array(3), m);
      expect(Array.from(r)).toEqual([1, 0, 0, 0]);
    }
  });

  it('frustum planes: NaN and infinite rows give the everything-inside plane', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = Float64Array.from(I);
      m[0] = bad; // reaches the x component of the left and right planes
      const p = frustumFromMatrix(new Float64Array(24), m);
      expect([p[0], p[1], p[2], p[3]]).toEqual([0, 0, 0, Infinity]);
      expect([p[4], p[5], p[6], p[7]]).toEqual([0, 0, 0, Infinity]);
    }
  });

  it('boundaries: a point on a plane, a sphere and a box that touch it count as inside', () => {
    // Orthographic box [-1, 1]^2, near 1, far 3: the right plane is x = 1.
    const m = new Float64Array(16);
    mat4Orthographic(m, -1, 1, -1, 1, 1, 3);
    const p = frustumFromMatrix(new Float64Array(24), m);
    expect(frustumContainsPoint(p, [1, 0, -2])).toBe(true);
    expect(frustumContainsPoint(p, [1 + 1e-9, 0, -2])).toBe(false);
    expect(frustumIntersectsSphere(p, [2, 0, -2], 1)).toBe(true);
    expect(frustumIntersectsSphere(p, [2 + 1e-9, 0, -2], 1)).toBe(false);
    expect(frustumIntersectsAabb(p, [1, 0, -2], [2, 1, -1])).toBe(true);
    expect(frustumIntersectsAabb(p, [1 + 1e-9, 0, -2], [2, 1, -1])).toBe(false);
  });
});
