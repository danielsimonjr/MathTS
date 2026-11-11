/**
 * Bit-exact parity of the mat4 and frustum kernels with fourJS `Matrix4` / `Frustum`.
 * The fixture comes from `functions/scripts/gen-fourjs-parity.mjs` (run by hand with Node
 * against a built fourJS checkout). Every float64 in it is 16 hex digits of its bits.
 */
import { readFileSync } from 'node:fs';
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
  mat4Multiply,
  mat4Orthographic,
  mat4Perspective,
  type Mat4DepthRange,
} from '../src/index.js';

type Hex = string;
interface Probe {
  point: Hex[];
  radius: Hex;
  min: Hex[];
  max: Hex[];
  containsPoint: boolean;
  intersectsSphere: boolean;
  intersectsBox: boolean;
}
interface Fixture {
  fourjsCommit: string;
  multiply: { a: Hex[]; b: Hex[]; out: Hex[] }[];
  invert: { m: Hex[]; det: Hex; out: Hex[] }[];
  compose: { position: Hex[]; rotation: Hex[]; scale: Hex[]; out: Hex[] }[];
  decompose: { m: Hex[]; position: Hex[]; rotation: Hex[]; scale: Hex[] }[];
  perspective: { args: Hex[]; depthRange: Mat4DepthRange; out: Hex[] }[];
  orthographic: { args: Hex[]; depthRange: Mat4DepthRange; out: Hex[] }[];
  frustum: { m: Hex[]; depthRange: Mat4DepthRange; planes: Hex[]; probes: Probe[] }[];
}

const fx = JSON.parse(
  readFileSync(new URL('./fixtures/fourjs-parity.json', import.meta.url), 'utf8')
) as Fixture;

const view = new DataView(new ArrayBuffer(8));
function num(h: Hex): number {
  view.setUint32(0, parseInt(h.slice(0, 8), 16));
  view.setUint32(4, parseInt(h.slice(8), 16));
  return view.getFloat64(0);
}
function hex(x: number): Hex {
  view.setFloat64(0, x);
  return (
    view.getUint32(0).toString(16).padStart(8, '0') +
    view.getUint32(4).toString(16).padStart(8, '0')
  );
}
/** Distance in ulps between two finite float64 values of the same sign. */
const ulps = (a: Hex, b: Hex): number => Math.abs(Number(BigInt(`0x${a}`) - BigInt(`0x${b}`)));
const nums = (hs: Hex[]): Float64Array => Float64Array.from(hs, num);
const hexes = (xs: ArrayLike<number>): Hex[] => Array.from(xs, hex);

describe('mat4 kernels match fourJS Matrix4 bit for bit', () => {
  it('fixture is present', () => {
    expect(fx.fourjsCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(fx.multiply.length).toBeGreaterThan(0);
  });

  it('mat4Multiply', () => {
    for (const c of fx.multiply) {
      const out = new Float64Array(16);
      mat4Multiply(out, nums(c.a), nums(c.b));
      expect(hexes(out)).toEqual(c.out);
    }
  });

  it('mat4Invert and mat4Determinant', () => {
    for (const c of fx.invert) {
      const out = new Float64Array(16);
      expect(mat4Invert(out, nums(c.m))).toBe(out);
      // Another summation order than fourJS (small enough for V8 to inline): close, not exact.
      const det = num(c.det);
      expect(Math.abs(mat4Determinant(nums(c.m)) - det)).toBeLessThanOrEqual(
        1e-12 * Math.abs(det) + 1e-12
      );
      expect(hexes(out)).toEqual(c.out);
    }
  });

  it('mat4Compose (fourJS compose with a zero pivot)', () => {
    for (const c of fx.compose) {
      const out = new Float64Array(16);
      mat4Compose(out, nums(c.position), nums(c.rotation), nums(c.scale));
      expect(hexes(out)).toEqual(c.out);
    }
  });

  it('mat4Decompose', () => {
    for (const c of fx.decompose) {
      const p = new Float64Array(3);
      const r = new Float64Array(4);
      const s = new Float64Array(3);
      mat4Decompose(p, r, s, nums(c.m));
      expect(hexes(p)).toEqual(c.position);
      expect(hexes(r)).toEqual(c.rotation);
      expect(hexes(s)).toEqual(c.scale);
    }
  });

  it('mat4Perspective in both depth ranges', () => {
    for (const c of fx.perspective) {
      const [fovY, aspect, near, far] = c.args.map(num) as [number, number, number, number];
      const out = new Float64Array(16);
      mat4Perspective(out, fovY, aspect, near, far, c.depthRange);
      // Cells 0 and 5 hold 1 / Math.tan(fovY / 2). Math.tan differs by one ulp between
      // V8 (the fixture's engine) and JavaScriptCore (the Bun test step) for some inputs.
      // Those two cells may differ by at most one ulp; the other 14 are exact.
      const got = hexes(out);
      for (let i = 0; i < 16; i++) {
        if (i === 0 || i === 5)
          expect(ulps(got[i]!, c.out[i]!), `cell ${i}`).toBeLessThanOrEqual(1);
        else expect(got[i], `cell ${i}`).toBe(c.out[i]);
      }
    }
  });

  it('mat4Orthographic in both depth ranges, -0 cells included', () => {
    let negativeZeros = 0;
    for (const c of fx.orthographic) {
      const [l, r, b, t, n, f] = c.args.map(num) as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const out = new Float64Array(16);
      mat4Orthographic(out, l, r, b, t, n, f, c.depthRange);
      expect(hexes(out)).toEqual(c.out);
      negativeZeros += c.out.filter((h) => h === '8000000000000000').length;
    }
    expect(negativeZeros).toBeGreaterThan(0);
  });
});

describe('frustum kernels match fourJS Frustum bit for bit', () => {
  it('frustumFromMatrix planes, degenerate matrices included', () => {
    let degenerate = 0;
    for (const c of fx.frustum) {
      const planes = new Float64Array(24);
      frustumFromMatrix(planes, nums(c.m), c.depthRange);
      expect(hexes(planes)).toEqual(c.planes);
      if (c.planes[3] === hex(Number.POSITIVE_INFINITY)) degenerate++;
    }
    expect(degenerate).toBeGreaterThan(0);
  });

  it('point, sphere and AABB tests', () => {
    let both = 0;
    for (const c of fx.frustum) {
      const planes = nums(c.planes);
      for (const p of c.probes) {
        const point = nums(p.point);
        expect(frustumContainsPoint(planes, point)).toBe(p.containsPoint);
        expect(frustumIntersectsSphere(planes, point, num(p.radius))).toBe(p.intersectsSphere);
        expect(frustumIntersectsAabb(planes, nums(p.min), nums(p.max))).toBe(p.intersectsBox);
        if (p.intersectsBox !== p.containsPoint) both++;
      }
    }
    expect(both).toBeGreaterThan(0);
  });
});
