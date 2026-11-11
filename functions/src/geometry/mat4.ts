/**
 * Allocation-free 4x4 matrix kernels. Matrices are column-major (`m[column * 4 + row]`),
 * as in the kernels of `kernels.generated.ts`. Quaternions are `[w, x, y, z]`. The
 * functions do not allocate and do not throw. Each function reads all of its inputs
 * before it writes, so an output may be the same array as an input, at any offset.
 *
 * The arithmetic of the kernels with a `@fourjs/math` counterpart keeps the term order
 * of that counterpart, so for finite input on the same engine the results match it bit
 * for bit. The exceptions are documented on each function: `mat4Determinant` sums in
 * another order, `mat4Invert` has no singular branch, and `mat4Compose` takes no pivot.
 *
 * @packageDocumentation
 */
import type { KernelInput, KernelOutput } from './kernels.generated.js';

/** Clip-space depth convention of a projection matrix. */
export type Mat4DepthRange = 'negative-one-to-one' | 'zero-to-one';

/**
 * Multiplies two 4x4 matrices: `out = a · b`. Column-major.
 *
 * @param out - Receives the 16 cells of the product at `outOff`.
 * @param a - Left operand, read at `aOff`.
 * @param b - Right operand, read at `bOff`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param aOff - Index of the first cell of `a`. Default 0.
 * @param bOff - Index of the first cell of `b`. Default 0.
 * @returns `out`.
 */
export function mat4Multiply<T extends KernelOutput>(
  out: T,
  a: KernelInput,
  b: KernelInput,
  outOff = 0,
  aOff = 0,
  bOff = 0
): T {
  const a11 = a[aOff]!;
  const a21 = a[aOff + 1]!;
  const a31 = a[aOff + 2]!;
  const a41 = a[aOff + 3]!;
  const a12 = a[aOff + 4]!;
  const a22 = a[aOff + 5]!;
  const a32 = a[aOff + 6]!;
  const a42 = a[aOff + 7]!;
  const a13 = a[aOff + 8]!;
  const a23 = a[aOff + 9]!;
  const a33 = a[aOff + 10]!;
  const a43 = a[aOff + 11]!;
  const a14 = a[aOff + 12]!;
  const a24 = a[aOff + 13]!;
  const a34 = a[aOff + 14]!;
  const a44 = a[aOff + 15]!;

  const b11 = b[bOff]!;
  const b21 = b[bOff + 1]!;
  const b31 = b[bOff + 2]!;
  const b41 = b[bOff + 3]!;
  const b12 = b[bOff + 4]!;
  const b22 = b[bOff + 5]!;
  const b32 = b[bOff + 6]!;
  const b42 = b[bOff + 7]!;
  const b13 = b[bOff + 8]!;
  const b23 = b[bOff + 9]!;
  const b33 = b[bOff + 10]!;
  const b43 = b[bOff + 11]!;
  const b14 = b[bOff + 12]!;
  const b24 = b[bOff + 13]!;
  const b34 = b[bOff + 14]!;
  const b44 = b[bOff + 15]!;

  const o = outOff;
  out[o] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
  out[o + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
  out[o + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
  out[o + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;

  out[o + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
  out[o + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
  out[o + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
  out[o + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;

  out[o + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
  out[o + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
  out[o + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
  out[o + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;

  out[o + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
  out[o + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
  out[o + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
  out[o + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

  return out;
}

/**
 * Determinant of a 4x4 column-major matrix, by the Laplace expansion over the 2x2 minors
 * of the first two and the last two columns (12 products and 6 more). The body is small,
 * so V8 inlines it, and the returned double is not boxed. The value can differ from
 * fourJS `Matrix4.determinant` and from the determinant inside {@link mat4Invert} in the
 * last bits, because the terms are summed in another order.
 *
 * @param m - Input matrix, read at `mOff`.
 * @param mOff - Index of the first cell of `m`. Default 0.
 * @returns The determinant.
 */
export function mat4Determinant(m: KernelInput, mOff = 0): number {
  const a00 = m[mOff]!;
  const a01 = m[mOff + 1]!;
  const a02 = m[mOff + 2]!;
  const a03 = m[mOff + 3]!;
  const a10 = m[mOff + 4]!;
  const a11 = m[mOff + 5]!;
  const a12 = m[mOff + 6]!;
  const a13 = m[mOff + 7]!;
  const a20 = m[mOff + 8]!;
  const a21 = m[mOff + 9]!;
  const a22 = m[mOff + 10]!;
  const a23 = m[mOff + 11]!;
  const a30 = m[mOff + 12]!;
  const a31 = m[mOff + 13]!;
  const a32 = m[mOff + 14]!;
  const a33 = m[mOff + 15]!;
  const b0 = a00 * a11 - a01 * a10;
  const b1 = a00 * a12 - a02 * a10;
  const b2 = a00 * a13 - a03 * a10;
  const b3 = a01 * a12 - a02 * a11;
  const b4 = a01 * a13 - a03 * a11;
  const b5 = a02 * a13 - a03 * a12;
  const b6 = a20 * a31 - a21 * a30;
  const b7 = a20 * a32 - a22 * a30;
  const b8 = a20 * a33 - a23 * a30;
  const b9 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  return b0 * b11 - b1 * b10 + b2 * b9 + b3 * b8 - b4 * b7 + b5 * b6;
}

/**
 * Inverts a 4x4 column-major matrix by the adjugate, with the expressions of fourJS
 * `Matrix4.invert`. It multiplies by the reciprocal of the determinant and has no
 * singular branch: an exactly singular matrix gives infinite or NaN values, and a nearly
 * singular matrix gives large finite values. Check {@link mat4Determinant} first when the
 * input can be singular. (fourJS leaves a singular matrix unchanged.)
 *
 * @param out - Receives the 16 cells of the inverse at `outOff`. `out` can be the same
 *   array as `m`.
 * @param m - Input matrix, read at `mOff`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param mOff - Index of the first cell of `m`. Default 0.
 * @returns `out`.
 */
export function mat4Invert<T extends KernelOutput>(
  out: T,
  m: KernelInput,
  outOff = 0,
  mOff = 0
): T {
  const n11 = m[mOff]!;
  const n21 = m[mOff + 1]!;
  const n31 = m[mOff + 2]!;
  const n41 = m[mOff + 3]!;
  const n12 = m[mOff + 4]!;
  const n22 = m[mOff + 5]!;
  const n32 = m[mOff + 6]!;
  const n42 = m[mOff + 7]!;
  const n13 = m[mOff + 8]!;
  const n23 = m[mOff + 9]!;
  const n33 = m[mOff + 10]!;
  const n43 = m[mOff + 11]!;
  const n14 = m[mOff + 12]!;
  const n24 = m[mOff + 13]!;
  const n34 = m[mOff + 14]!;
  const n44 = m[mOff + 15]!;

  const t11 =
    n23 * n34 * n42 -
    n24 * n33 * n42 +
    n24 * n32 * n43 -
    n22 * n34 * n43 -
    n23 * n32 * n44 +
    n22 * n33 * n44;
  const t12 =
    n14 * n33 * n42 -
    n13 * n34 * n42 -
    n14 * n32 * n43 +
    n12 * n34 * n43 +
    n13 * n32 * n44 -
    n12 * n33 * n44;
  const t13 =
    n13 * n24 * n42 -
    n14 * n23 * n42 +
    n14 * n22 * n43 -
    n12 * n24 * n43 -
    n13 * n22 * n44 +
    n12 * n23 * n44;
  const t14 =
    n14 * n23 * n32 -
    n13 * n24 * n32 -
    n14 * n22 * n33 +
    n12 * n24 * n33 +
    n13 * n22 * n34 -
    n12 * n23 * n34;

  const determinant = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  const inverseDeterminant = 1 / determinant;
  const o = outOff;

  out[o] = t11 * inverseDeterminant;
  out[o + 1] =
    (n24 * n33 * n41 -
      n23 * n34 * n41 -
      n24 * n31 * n43 +
      n21 * n34 * n43 +
      n23 * n31 * n44 -
      n21 * n33 * n44) *
    inverseDeterminant;
  out[o + 2] =
    (n22 * n34 * n41 -
      n24 * n32 * n41 +
      n24 * n31 * n42 -
      n21 * n34 * n42 -
      n22 * n31 * n44 +
      n21 * n32 * n44) *
    inverseDeterminant;
  out[o + 3] =
    (n23 * n32 * n41 -
      n22 * n33 * n41 -
      n23 * n31 * n42 +
      n21 * n33 * n42 +
      n22 * n31 * n43 -
      n21 * n32 * n43) *
    inverseDeterminant;

  out[o + 4] = t12 * inverseDeterminant;
  out[o + 5] =
    (n13 * n34 * n41 -
      n14 * n33 * n41 +
      n14 * n31 * n43 -
      n11 * n34 * n43 -
      n13 * n31 * n44 +
      n11 * n33 * n44) *
    inverseDeterminant;
  out[o + 6] =
    (n14 * n32 * n41 -
      n12 * n34 * n41 -
      n14 * n31 * n42 +
      n11 * n34 * n42 +
      n12 * n31 * n44 -
      n11 * n32 * n44) *
    inverseDeterminant;
  out[o + 7] =
    (n12 * n33 * n41 -
      n13 * n32 * n41 +
      n13 * n31 * n42 -
      n11 * n33 * n42 -
      n12 * n31 * n43 +
      n11 * n32 * n43) *
    inverseDeterminant;

  out[o + 8] = t13 * inverseDeterminant;
  out[o + 9] =
    (n14 * n23 * n41 -
      n13 * n24 * n41 -
      n14 * n21 * n43 +
      n11 * n24 * n43 +
      n13 * n21 * n44 -
      n11 * n23 * n44) *
    inverseDeterminant;
  out[o + 10] =
    (n12 * n24 * n41 -
      n14 * n22 * n41 +
      n14 * n21 * n42 -
      n11 * n24 * n42 -
      n12 * n21 * n44 +
      n11 * n22 * n44) *
    inverseDeterminant;
  out[o + 11] =
    (n13 * n22 * n41 -
      n12 * n23 * n41 -
      n13 * n21 * n42 +
      n11 * n23 * n42 +
      n12 * n21 * n43 -
      n11 * n22 * n43) *
    inverseDeterminant;

  out[o + 12] = t14 * inverseDeterminant;
  out[o + 13] =
    (n13 * n24 * n31 -
      n14 * n23 * n31 +
      n14 * n21 * n33 -
      n11 * n24 * n33 -
      n13 * n21 * n34 +
      n11 * n23 * n34) *
    inverseDeterminant;
  out[o + 14] =
    (n14 * n22 * n31 -
      n12 * n24 * n31 -
      n14 * n21 * n32 +
      n11 * n24 * n32 +
      n12 * n21 * n34 -
      n11 * n22 * n34) *
    inverseDeterminant;
  out[o + 15] =
    (n12 * n23 * n31 -
      n13 * n22 * n31 +
      n13 * n21 * n32 -
      n11 * n23 * n32 -
      n12 * n21 * n33 +
      n11 * n22 * n33) *
    inverseDeterminant;
  return out;
}

/**
 * Builds a translate-rotate-scale matrix: `T · R · S`. The upper 3x3 block is the
 * rotation columns scaled by `scale`, and the translation column is `position`.
 * For finite input it equals `@fourjs/math` `Matrix4.compose` with a zero pivot, except
 * that a `-0` position cell stays `-0` (fourJS gives `+0`) and an infinite scale does not
 * reach the translation column (fourJS gives NaN there).
 *
 * @param out - Receives the 16 cells at `outOff`.
 * @param position - Translation `[x, y, z]`, read at `pOff`.
 * @param rotation - Unit quaternion `[w, x, y, z]`, read at `rOff`.
 * @param scale - Scale `[x, y, z]`, read at `sOff`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param pOff - Index of the first value of `position`. Default 0.
 * @param rOff - Index of the first value of `rotation`. Default 0.
 * @param sOff - Index of the first value of `scale`. Default 0.
 * @returns `out`.
 */
export function mat4Compose<T extends KernelOutput>(
  out: T,
  position: KernelInput,
  rotation: KernelInput,
  scale: KernelInput,
  outOff = 0,
  pOff = 0,
  rOff = 0,
  sOff = 0
): T {
  const w = rotation[rOff]!;
  const x = rotation[rOff + 1]!;
  const y = rotation[rOff + 2]!;
  const z = rotation[rOff + 3]!;
  const px = position[pOff]!;
  const py = position[pOff + 1]!;
  const pz = position[pOff + 2]!;
  const sx = scale[sOff]!;
  const sy = scale[sOff + 1]!;
  const sz = scale[sOff + 2]!;

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  // Columns of R · S: column j is rotation column j scaled by scale[j].
  const m11 = (1 - (yy + zz)) * sx;
  const m21 = (xy + wz) * sx;
  const m31 = (xz - wy) * sx;
  const m12 = (xy - wz) * sy;
  const m22 = (1 - (xx + zz)) * sy;
  const m32 = (yz + wx) * sy;
  const m13 = (xz + wy) * sz;
  const m23 = (yz - wx) * sz;
  const m33 = (1 - (xx + yy)) * sz;

  const o = outOff;
  out[o] = m11;
  out[o + 1] = m21;
  out[o + 2] = m31;
  out[o + 3] = 0;
  out[o + 4] = m12;
  out[o + 5] = m22;
  out[o + 6] = m32;
  out[o + 7] = 0;
  out[o + 8] = m13;
  out[o + 9] = m23;
  out[o + 10] = m33;
  out[o + 11] = 0;
  out[o + 12] = px;
  out[o + 13] = py;
  out[o + 14] = pz;
  out[o + 15] = 1;

  return out;
}

/**
 * Splits an affine matrix into translation, rotation and scale. The scale is the length
 * of each upper 3x3 column. The rotation is written as `[w, x, y, z]`, by the Shepperd
 * method. A zero scale component writes the identity rotation `[1, 0, 0, 0]`. The
 * function assumes a positive scale: a mirroring matrix does not decompose to its own
 * rotation.
 *
 * @param outPosition - Receives `[x, y, z]` at `posOff`.
 * @param outRotation - Receives `[w, x, y, z]` at `rotOff`.
 * @param outScale - Receives `[x, y, z]` at `scaleOff`.
 * @param m - Input matrix, read at `mOff`. Each output may be `m`. The three outputs must
 *   not overlap each other.
 * @param posOff - Index of the first value of `outPosition`. Default 0.
 * @param rotOff - Index of the first value of `outRotation`. Default 0.
 * @param scaleOff - Index of the first value of `outScale`. Default 0.
 * @param mOff - Index of the first cell of `m`. Default 0.
 * @returns Nothing.
 */
export function mat4Decompose(
  outPosition: KernelOutput,
  outRotation: KernelOutput,
  outScale: KernelOutput,
  m: KernelInput,
  posOff = 0,
  rotOff = 0,
  scaleOff = 0,
  mOff = 0
): void {
  const e0 = m[mOff]!;
  const e1 = m[mOff + 1]!;
  const e2 = m[mOff + 2]!;
  const e4 = m[mOff + 4]!;
  const e5 = m[mOff + 5]!;
  const e6 = m[mOff + 6]!;
  const e8 = m[mOff + 8]!;
  const e9 = m[mOff + 9]!;
  const e10 = m[mOff + 10]!;
  const e12 = m[mOff + 12]!;
  const e13 = m[mOff + 13]!;
  const e14 = m[mOff + 14]!;

  const sx = Math.sqrt(e0 * e0 + e1 * e1 + e2 * e2);
  const sy = Math.sqrt(e4 * e4 + e5 * e5 + e6 * e6);
  const sz = Math.sqrt(e8 * e8 + e9 * e9 + e10 * e10);

  outPosition[posOff] = e12;
  outPosition[posOff + 1] = e13;
  outPosition[posOff + 2] = e14;
  outScale[scaleOff] = sx;
  outScale[scaleOff + 1] = sy;
  outScale[scaleOff + 2] = sz;

  if (sx === 0 || sy === 0 || sz === 0) {
    outRotation[rotOff] = 1;
    outRotation[rotOff + 1] = 0;
    outRotation[rotOff + 2] = 0;
    outRotation[rotOff + 3] = 0;
    return;
  }

  const inverseSx = 1 / sx;
  const inverseSy = 1 / sy;
  const inverseSz = 1 / sz;

  const m11 = e0 * inverseSx;
  const m21 = e1 * inverseSx;
  const m31 = e2 * inverseSx;
  const m12 = e4 * inverseSy;
  const m22 = e5 * inverseSy;
  const m32 = e6 * inverseSy;
  const m13 = e8 * inverseSz;
  const m23 = e9 * inverseSz;
  const m33 = e10 * inverseSz;

  // Shepperd's method, as in `setQuaternionFromBasis` of `@fourjs/math`, written as
  // `[w, x, y, z]`.
  const trace = m11 + m22 + m33;
  const r = rotOff;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    outRotation[r] = 0.25 / s;
    outRotation[r + 1] = (m32 - m23) * s;
    outRotation[r + 2] = (m13 - m31) * s;
    outRotation[r + 3] = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    outRotation[r] = (m32 - m23) / s;
    outRotation[r + 1] = 0.25 * s;
    outRotation[r + 2] = (m12 + m21) / s;
    outRotation[r + 3] = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    outRotation[r] = (m13 - m31) / s;
    outRotation[r + 1] = (m12 + m21) / s;
    outRotation[r + 2] = 0.25 * s;
    outRotation[r + 3] = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    outRotation[r] = (m21 - m12) / s;
    outRotation[r + 1] = (m13 + m31) / s;
    outRotation[r + 2] = (m23 + m32) / s;
    outRotation[r + 3] = 0.25 * s;
  }
}

/**
 * Builds the view matrix of a camera at `eye` that looks at `target` (gluLookAt). The
 * camera looks down its own -Z axis with `up` as +Y. A degenerate input (`eye` equal to
 * `target`, or `up` parallel to the view direction) gives NaN by arithmetic. There is no
 * fill.
 *
 * @param out - Receives the 16 cells at `outOff`.
 * @param eye - Camera position `[x, y, z]`, read at `eyeOff`.
 * @param target - Look-at point `[x, y, z]`, read at `targetOff`.
 * @param up - Up direction `[x, y, z]`, read at `upOff`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param eyeOff - Index of the first value of `eye`. Default 0.
 * @param targetOff - Index of the first value of `target`. Default 0.
 * @param upOff - Index of the first value of `up`. Default 0.
 * @returns `out`.
 */
export function mat4LookAt<T extends KernelOutput>(
  out: T,
  eye: KernelInput,
  target: KernelInput,
  up: KernelInput,
  outOff = 0,
  eyeOff = 0,
  targetOff = 0,
  upOff = 0
): T {
  const ex = eye[eyeOff]!;
  const ey = eye[eyeOff + 1]!;
  const ez = eye[eyeOff + 2]!;
  const tx = target[targetOff]!;
  const ty = target[targetOff + 1]!;
  const tz = target[targetOff + 2]!;
  const ux = up[upOff]!;
  const uy = up[upOff + 1]!;
  const uz = up[upOff + 2]!;

  // f = normalize(target - eye)
  let dx = tx - ex;
  let dy = ty - ey;
  let dz = tz - ez;
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx = dx / dl;
  dy = dy / dl;
  dz = dz / dl;

  // s = normalize(f × up)
  let sx = dy * uz - dz * uy;
  let sy = dz * ux - dx * uz;
  let sz = dx * uy - dy * ux;
  const sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
  sx = sx / sl;
  sy = sy / sl;
  sz = sz / sl;

  // u = s × f
  const vx = sy * dz - sz * dy;
  const vy = sz * dx - sx * dz;
  const vz = sx * dy - sy * dx;

  const o = outOff;
  out[o] = sx;
  out[o + 1] = vx;
  out[o + 2] = -dx;
  out[o + 3] = 0;
  out[o + 4] = sy;
  out[o + 5] = vy;
  out[o + 6] = -dy;
  out[o + 7] = 0;
  out[o + 8] = sz;
  out[o + 9] = vz;
  out[o + 10] = -dz;
  out[o + 11] = 0;
  out[o + 12] = -(sx * ex + sy * ey + sz * ez);
  out[o + 13] = -(vx * ex + vy * ey + vz * ez);
  out[o + 14] = dx * ex + dy * ey + dz * ez;
  out[o + 15] = 1;

  return out;
}

/**
 * Writes a right-handed perspective projection, as `@fourjs/math` `setPerspective`. The
 * camera looks down -Z. `near` and `far` are positive distances. An infinite `far` is not
 * supported: the formula gives NaN.
 *
 * @param out - Receives the 16 cells at `outOff`.
 * @param fovY - Full vertical field of view in radians.
 * @param aspect - Width divided by height.
 * @param near - Distance to the near plane, positive.
 * @param far - Distance to the far plane, greater than `near`.
 * @param depthRange - Clip-space depth convention. Default `'negative-one-to-one'`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @returns `out`.
 */
export function mat4Perspective<T extends KernelOutput>(
  out: T,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
  depthRange: Mat4DepthRange = 'negative-one-to-one',
  outOff = 0
): T {
  const focalLength = 1 / Math.tan(fovY * 0.5);
  const nearMinusFar = near - far;

  const o = outOff;
  out[o] = focalLength / aspect;
  out[o + 1] = 0;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = focalLength;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = 0;
  out[o + 9] = 0;
  out[o + 11] = -1;
  out[o + 12] = 0;
  out[o + 13] = 0;
  out[o + 15] = 0;

  if (depthRange === 'zero-to-one') {
    out[o + 10] = far / nearMinusFar;
    out[o + 14] = (far * near) / nearMinusFar;
  } else {
    out[o + 10] = (far + near) / nearMinusFar;
    out[o + 14] = (2 * far * near) / nearMinusFar;
  }

  return out;
}

/**
 * Writes a right-handed orthographic projection, as `@fourjs/math` `setOrthographic`. A
 * symmetric box gives `-0` in some cells, which the bit-exact parity test relies on.
 *
 * @param out - Receives the 16 cells at `outOff`.
 * @param left - Left edge of the view volume.
 * @param right - Right edge of the view volume.
 * @param bottom - Bottom edge of the view volume.
 * @param top - Top edge of the view volume.
 * @param near - Distance to the near plane, positive.
 * @param far - Distance to the far plane, greater than `near`.
 * @param depthRange - Clip-space depth convention. Default `'negative-one-to-one'`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @returns `out`.
 */
export function mat4Orthographic<T extends KernelOutput>(
  out: T,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
  depthRange: Mat4DepthRange = 'negative-one-to-one',
  outOff = 0
): T {
  const width = right - left;
  const height = top - bottom;
  const depth = far - near;

  const o = outOff;
  out[o] = 2 / width;
  out[o + 1] = 0;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = 2 / height;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = 0;
  out[o + 9] = 0;
  out[o + 11] = 0;
  out[o + 12] = -(right + left) / width;
  out[o + 13] = -(top + bottom) / height;
  out[o + 15] = 1;

  if (depthRange === 'zero-to-one') {
    out[o + 10] = -1 / depth;
    out[o + 14] = -near / depth;
  } else {
    out[o + 10] = -2 / depth;
    out[o + 14] = -(far + near) / depth;
  }

  return out;
}
