/**
 * View frustum as six planes, with allocation-free containment tests. The planes are
 * stored as `(nx, ny, nz, d)` with unit inward normals, in the order left, right,
 * bottom, top, near, far. The tests follow `@fourjs/math` `Frustum` bit for bit.
 *
 * @packageDocumentation
 */
import type { KernelInput, KernelOutput } from './kernels.generated.js';
import type { Mat4DepthRange } from './mat4.js';

/**
 * Normalizes the plane already stored at `offset` (raw `(a, b, c, d)`) to a unit normal.
 * A normal with no length, or a non-finite length, writes the everything-inside plane
 * `(0, 0, 0, +Infinity)`. The helper takes only an array and an integer, so no double is
 * boxed at the call, which keeps the caller allocation-free.
 */
function normalizePlane(planes: KernelOutput, offset: number): void {
  const a = planes[offset]!;
  const b = planes[offset + 1]!;
  const c = planes[offset + 2]!;
  const d = planes[offset + 3]!;
  const length = Math.sqrt(a * a + b * b + c * c);
  if (!(length > 0) || !Number.isFinite(length)) {
    planes[offset] = 0;
    planes[offset + 1] = 0;
    planes[offset + 2] = 0;
    planes[offset + 3] = Infinity;
    return;
  }
  const inverse = 1 / length;
  planes[offset] = a * inverse;
  planes[offset + 1] = b * inverse;
  planes[offset + 2] = c * inverse;
  planes[offset + 3] = d * inverse;
}

/**
 * Extracts the six frustum planes of a view-projection matrix (Gribb-Hartmann), as
 * `@fourjs/math` `Frustum.setFromViewProjection`. A degenerate plane is written as the
 * everything-inside plane `(0, 0, 0, +Infinity)`. All 16 cells are read before any
 * plane is written, so `planes` may overlap `m`.
 *
 * @param planes - Receives 24 numbers, four per plane, at `planesOff`.
 * @param m - Column-major view-projection matrix, read at `mOff`.
 * @param depthRange - Clip-space depth convention of `m`. Default `'negative-one-to-one'`.
 * @param planesOff - Index of the first value of `planes`. Default 0.
 * @param mOff - Index of the first cell of `m`. Default 0.
 * @returns `planes`.
 */
export function frustumFromMatrix(
  planes: KernelOutput,
  m: KernelInput,
  depthRange: Mat4DepthRange = 'negative-one-to-one',
  planesOff = 0,
  mOff = 0
): KernelOutput {
  // Rows of a column-major matrix: row `i` is `m[column * 4 + i]`.
  const r0x = m[mOff]!;
  const r0y = m[mOff + 4]!;
  const r0z = m[mOff + 8]!;
  const r0w = m[mOff + 12]!;
  const r1x = m[mOff + 1]!;
  const r1y = m[mOff + 5]!;
  const r1z = m[mOff + 9]!;
  const r1w = m[mOff + 13]!;
  const r2x = m[mOff + 2]!;
  const r2y = m[mOff + 6]!;
  const r2z = m[mOff + 10]!;
  const r2w = m[mOff + 14]!;
  const r3x = m[mOff + 3]!;
  const r3y = m[mOff + 7]!;
  const r3z = m[mOff + 11]!;
  const r3w = m[mOff + 15]!;

  const o = planesOff;
  // Raw plane rows first, then each is normalized in place: the same arithmetic as
  // `@fourjs/math`, with no double passed to a helper.
  planes[o] = r3x + r0x;
  planes[o + 1] = r3y + r0y;
  planes[o + 2] = r3z + r0z;
  planes[o + 3] = r3w + r0w;
  planes[o + 4] = r3x - r0x;
  planes[o + 5] = r3y - r0y;
  planes[o + 6] = r3z - r0z;
  planes[o + 7] = r3w - r0w;
  planes[o + 8] = r3x + r1x;
  planes[o + 9] = r3y + r1y;
  planes[o + 10] = r3z + r1z;
  planes[o + 11] = r3w + r1w;
  planes[o + 12] = r3x - r1x;
  planes[o + 13] = r3y - r1y;
  planes[o + 14] = r3z - r1z;
  planes[o + 15] = r3w - r1w;
  if (depthRange === 'zero-to-one') {
    planes[o + 16] = r2x;
    planes[o + 17] = r2y;
    planes[o + 18] = r2z;
    planes[o + 19] = r2w;
  } else {
    planes[o + 16] = r3x + r2x;
    planes[o + 17] = r3y + r2y;
    planes[o + 18] = r3z + r2z;
    planes[o + 19] = r3w + r2w;
  }
  planes[o + 20] = r3x - r2x;
  planes[o + 21] = r3y - r2y;
  planes[o + 22] = r3z - r2z;
  planes[o + 23] = r3w - r2w;
  normalizePlane(planes, o);
  normalizePlane(planes, o + 4);
  normalizePlane(planes, o + 8);
  normalizePlane(planes, o + 12);
  normalizePlane(planes, o + 16);
  normalizePlane(planes, o + 20);
  return planes;
}

/**
 * Tests whether a point lies inside all six planes. A `NaN` component makes the
 * comparison false for every plane, so the result is `true`.
 *
 * @param planes - Six planes, 24 numbers, read at `planesOff`.
 * @param p - Point `[x, y, z]`, read at `pOff`.
 * @param planesOff - Index of the first value of `planes`. Default 0.
 * @param pOff - Index of the first value of `p`. Default 0.
 * @returns `false` when the point is behind any plane, otherwise `true`.
 */
export function frustumContainsPoint(
  planes: KernelInput,
  p: KernelInput,
  planesOff = 0,
  pOff = 0
): boolean {
  const x = p[pOff]!;
  const y = p[pOff + 1]!;
  const z = p[pOff + 2]!;
  for (let i = 0; i < 24; i += 4) {
    const k = planesOff + i;
    if (planes[k]! * x + planes[k + 1]! * y + planes[k + 2]! * z + planes[k + 3]! < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Tests whether a bounding sphere touches the frustum. A `NaN` or infinite component in
 * `center` or `radius` gives `true`.
 *
 * @param planes - Six planes, 24 numbers, read at `planesOff`.
 * @param center - Sphere centre `[x, y, z]`, read at `cOff`.
 * @param radius - Sphere radius.
 * @param planesOff - Index of the first value of `planes`. Default 0.
 * @param cOff - Index of the first value of `center`. Default 0.
 * @returns `false` when the sphere lies wholly behind one plane, otherwise `true`.
 */
export function frustumIntersectsSphere(
  planes: KernelInput,
  center: KernelInput,
  radius: number,
  planesOff = 0,
  cOff = 0
): boolean {
  const x = center[cOff]!;
  const y = center[cOff + 1]!;
  const z = center[cOff + 2]!;
  for (let i = 0; i < 24; i += 4) {
    const k = planesOff + i;
    if (planes[k]! * x + planes[k + 1]! * y + planes[k + 2]! * z + planes[k + 3]! < -radius) {
      return false;
    }
  }
  return true;
}

/**
 * Tests whether an axis-aligned box touches the frustum. Each plane is tested against its
 * positive vertex, the corner furthest along the normal. A zero normal component selects
 * the maximum. An inverted box (`min > max` on an axis) is used as given. `NaN` bounds
 * give `true`.
 *
 * @param planes - Six planes, 24 numbers, read at `planesOff`.
 * @param min - Box minimum corner `[x, y, z]`, read at `minOff`.
 * @param max - Box maximum corner `[x, y, z]`, read at `maxOff`.
 * @param planesOff - Index of the first value of `planes`. Default 0.
 * @param minOff - Index of the first value of `min`. Default 0.
 * @param maxOff - Index of the first value of `max`. Default 0.
 * @returns `false` when the box lies wholly behind one plane, otherwise `true`.
 */
export function frustumIntersectsAabb(
  planes: KernelInput,
  min: KernelInput,
  max: KernelInput,
  planesOff = 0,
  minOff = 0,
  maxOff = 0
): boolean {
  const minX = min[minOff]!;
  const minY = min[minOff + 1]!;
  const minZ = min[minOff + 2]!;
  const maxX = max[maxOff]!;
  const maxY = max[maxOff + 1]!;
  const maxZ = max[maxOff + 2]!;
  for (let i = 0; i < 24; i += 4) {
    const k = planesOff + i;
    const nx = planes[k]!;
    const ny = planes[k + 1]!;
    const nz = planes[k + 2]!;
    const px = nx >= 0 ? maxX : minX;
    const py = ny >= 0 ? maxY : minY;
    const pz = nz >= 0 ? maxZ : minZ;
    if (nx * px + ny * py + nz * pz + planes[k + 3]! < 0) {
      return false;
    }
  }
  return true;
}
