/**
 * Symmetric 3x3 eigen-decomposition and inertia-tensor operations. Matrices are
 * column-major, as in the kernels of `kernels.generated.ts`. The functions do
 * not allocate and do not throw.
 *
 * @packageDocumentation
 */
import type { KernelInput, KernelOutput } from './kernels.generated.js';

/** Off-diagonal stop bound of the Jacobi sweep, relative to the diagonal, squared. */
const EPS2 = 2 ** -100;

/**
 * Computes the eigenvalues and orthonormal eigenvectors of a symmetric 3x3 matrix.
 * The function reads the upper triangle of `m` only (cells 0, 3, 6, 4, 7, 8).
 * It writes the eigenvalues in ascending order, and the eigenvectors as the
 * columns of a right-handed rotation, so `m = V diag(values) Vᵀ`.
 * The function reads all inputs before it writes, so `values` and `vectors` can each
 * be the same array as `m`, at any offsets. `values` and `vectors` must not overlap
 * each other.
 *
 * @param values - Receives the 3 eigenvalues, ascending, at `valuesOff`.
 * @param vectors - Receives the eigenvectors as columns at `vectorsOff`. Column k belongs to
 *   `values[valuesOff + k]`. The sign of each column is not specified, and a repeated
 *   eigenvalue gets an arbitrary orthonormal basis of its eigenspace.
 * @param m - Symmetric input matrix, read at `mOff`. Only its upper triangle is read.
 * @param valuesOff - Index of the first eigenvalue in `values`. Default 0.
 * @param vectorsOff - Index of the first cell of `vectors`. Default 0.
 * @param mOff - Index of the first cell of `m`. Default 0.
 * @returns Nothing. A non-finite input writes NaN to all 12 outputs.
 */
export function eigSym3(
  values: KernelOutput,
  vectors: KernelOutput,
  m: KernelInput,
  valuesOff = 0,
  vectorsOff = 0,
  mOff = 0
): void {
  const m00 = m[mOff]!;
  const m01 = m[mOff + 3]!;
  const m02 = m[mOff + 6]!;
  const m11 = m[mOff + 4]!;
  const m12 = m[mOff + 7]!;
  const m22 = m[mOff + 8]!;
  if (
    !Number.isFinite(m00) ||
    !Number.isFinite(m01) ||
    !Number.isFinite(m02) ||
    !Number.isFinite(m11) ||
    !Number.isFinite(m12) ||
    !Number.isFinite(m22)
  ) {
    for (let k = 0; k < 3; k++) values[valuesOff + k] = Number.NaN;
    for (let k = 0; k < 9; k++) vectors[vectorsOff + k] = Number.NaN;
    return;
  }

  let a00 = m00;
  let a01 = m01;
  let a02 = m02;
  let a11 = m11;
  let a12 = m12;
  let a22 = m22;
  let v00 = 1;
  let v01 = 0;
  let v02 = 0;
  let v10 = 0;
  let v11 = 1;
  let v12 = 0;
  let v20 = 0;
  let v21 = 0;
  let v22 = 1;

  const big = Math.max(
    Math.abs(a00),
    Math.abs(a01),
    Math.abs(a02),
    Math.abs(a11),
    Math.abs(a12),
    Math.abs(a22)
  );
  let e = 0;
  if (big !== 0) {
    e = Math.floor(Math.log2(big));
    if (e < -1000) e = -1000;
    if (e > 1000) e = 1000;
    const scale = Math.pow(2, -e);
    a00 *= scale;
    a01 *= scale;
    a02 *= scale;
    a11 *= scale;
    a12 *= scale;
    a22 *= scale;
  }

  for (let sweep = 0; sweep < 32; sweep++) {
    if (a01 !== 0) {
      const theta = (a11 - a00) / (2 * a01);
      const t =
        Math.abs(theta) > 1e150
          ? 1 / (2 * theta)
          : (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const tau = s / (1 + c);
      a00 -= t * a01;
      a11 += t * a01;
      a01 = 0;
      const n02 = a02 - s * (a12 + tau * a02);
      const n12 = a12 + s * (a02 - tau * a12);
      a02 = n02;
      a12 = n12;
      const p0 = v00 - s * (v01 + tau * v00);
      const q0 = v01 + s * (v00 - tau * v01);
      v00 = p0;
      v01 = q0;
      const p1 = v10 - s * (v11 + tau * v10);
      const q1 = v11 + s * (v10 - tau * v11);
      v10 = p1;
      v11 = q1;
      const p2 = v20 - s * (v21 + tau * v20);
      const q2 = v21 + s * (v20 - tau * v21);
      v20 = p2;
      v21 = q2;
    }
    if (a02 !== 0) {
      const theta = (a22 - a00) / (2 * a02);
      const t =
        Math.abs(theta) > 1e150
          ? 1 / (2 * theta)
          : (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const tau = s / (1 + c);
      a00 -= t * a02;
      a22 += t * a02;
      a02 = 0;
      const n01 = a01 - s * (a12 + tau * a01);
      const n12 = a12 + s * (a01 - tau * a12);
      a01 = n01;
      a12 = n12;
      const p0 = v00 - s * (v02 + tau * v00);
      const q0 = v02 + s * (v00 - tau * v02);
      v00 = p0;
      v02 = q0;
      const p1 = v10 - s * (v12 + tau * v10);
      const q1 = v12 + s * (v10 - tau * v12);
      v10 = p1;
      v12 = q1;
      const p2 = v20 - s * (v22 + tau * v20);
      const q2 = v22 + s * (v20 - tau * v22);
      v20 = p2;
      v22 = q2;
    }
    if (a12 !== 0) {
      const theta = (a22 - a11) / (2 * a12);
      const t =
        Math.abs(theta) > 1e150
          ? 1 / (2 * theta)
          : (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const tau = s / (1 + c);
      a11 -= t * a12;
      a22 += t * a12;
      a12 = 0;
      const n01 = a01 - s * (a02 + tau * a01);
      const n02 = a02 + s * (a01 - tau * a02);
      a01 = n01;
      a02 = n02;
      const p0 = v01 - s * (v02 + tau * v01);
      const q0 = v02 + s * (v01 - tau * v02);
      v01 = p0;
      v02 = q0;
      const p1 = v11 - s * (v12 + tau * v11);
      const q1 = v12 + s * (v11 - tau * v12);
      v11 = p1;
      v12 = q1;
      const p2 = v21 - s * (v22 + tau * v21);
      const q2 = v22 + s * (v21 - tau * v22);
      v21 = p2;
      v22 = q2;
    }
    const off = a01 * a01 + a02 * a02 + a12 * a12;
    const dia = a00 * a00 + a11 * a11 + a22 * a22;
    if (off <= EPS2 * dia) break;
  }

  // Sort ascending with the 3-element network (0,1), (1,2), (0,1). Swap only when strictly greater.
  if (a00 > a11) {
    const tv = a00;
    a00 = a11;
    a11 = tv;
    const c0 = v00;
    v00 = v01;
    v01 = c0;
    const c1 = v10;
    v10 = v11;
    v11 = c1;
    const c2 = v20;
    v20 = v21;
    v21 = c2;
  }
  if (a11 > a22) {
    const tv = a11;
    a11 = a22;
    a22 = tv;
    const c0 = v01;
    v01 = v02;
    v02 = c0;
    const c1 = v11;
    v11 = v12;
    v12 = c1;
    const c2 = v21;
    v21 = v22;
    v22 = c2;
  }
  if (a00 > a11) {
    const tv = a00;
    a00 = a11;
    a11 = tv;
    const c0 = v00;
    v00 = v01;
    v01 = c0;
    const c1 = v10;
    v10 = v11;
    v11 = c1;
    const c2 = v20;
    v20 = v21;
    v21 = c2;
  }

  // Make the basis right-handed after the sort. Negate column 2 with `0 - v` so no -0 appears.
  const det =
    v00 * (v11 * v22 - v21 * v12) - v10 * (v01 * v22 - v21 * v02) + v20 * (v01 * v12 - v11 * v02);
  if (det < 0) {
    v02 = 0 - v02;
    v12 = 0 - v12;
    v22 = 0 - v22;
  }

  const restore = Math.pow(2, e);
  values[valuesOff] = a00 * restore;
  values[valuesOff + 1] = a11 * restore;
  values[valuesOff + 2] = a22 * restore;
  vectors[vectorsOff] = v00;
  vectors[vectorsOff + 1] = v10;
  vectors[vectorsOff + 2] = v20;
  vectors[vectorsOff + 3] = v01;
  vectors[vectorsOff + 4] = v11;
  vectors[vectorsOff + 5] = v21;
  vectors[vectorsOff + 6] = v02;
  vectors[vectorsOff + 7] = v12;
  vectors[vectorsOff + 8] = v22;
}

/**
 * Computes `R I Rᵀ` for 3x3 column-major matrices. The function is alias-safe,
 * so `out` may be `R` or `I`.
 *
 * @param out - Receives the 3x3 result at `outOff`. `out` can be the same array as an input.
 * @param R - Rotation matrix, read at `ROff`.
 * @param I - Input matrix, read at `IOff`.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param ROff - Index of the first cell of `R`. Default 0.
 * @param IOff - Index of the first cell of `I`. Default 0.
 * @returns `out`.
 */
export function rotateTensor(
  out: KernelOutput,
  R: KernelInput,
  I: KernelInput,
  outOff = 0,
  ROff = 0,
  IOff = 0
): KernelOutput {
  const r00 = R[ROff]!;
  const r10 = R[ROff + 1]!;
  const r20 = R[ROff + 2]!;
  const r01 = R[ROff + 3]!;
  const r11 = R[ROff + 4]!;
  const r21 = R[ROff + 5]!;
  const r02 = R[ROff + 6]!;
  const r12 = R[ROff + 7]!;
  const r22 = R[ROff + 8]!;
  const i00 = I[IOff]!;
  const i10 = I[IOff + 1]!;
  const i20 = I[IOff + 2]!;
  const i01 = I[IOff + 3]!;
  const i11 = I[IOff + 4]!;
  const i21 = I[IOff + 5]!;
  const i02 = I[IOff + 6]!;
  const i12 = I[IOff + 7]!;
  const i22 = I[IOff + 8]!;

  // T = R I, with the entries of T named t(row)(col).
  const t00 = 0 + r00 * i00 + r01 * i10 + r02 * i20;
  const t10 = 0 + r10 * i00 + r11 * i10 + r12 * i20;
  const t20 = 0 + r20 * i00 + r21 * i10 + r22 * i20;
  const t01 = 0 + r00 * i01 + r01 * i11 + r02 * i21;
  const t11 = 0 + r10 * i01 + r11 * i11 + r12 * i21;
  const t21 = 0 + r20 * i01 + r21 * i11 + r22 * i21;
  const t02 = 0 + r00 * i02 + r01 * i12 + r02 * i22;
  const t12 = 0 + r10 * i02 + r11 * i12 + r12 * i22;
  const t22 = 0 + r20 * i02 + r21 * i12 + r22 * i22;

  // out = T Rᵀ.
  out[outOff] = 0 + t00 * r00 + t01 * r01 + t02 * r02;
  out[outOff + 1] = 0 + t10 * r00 + t11 * r01 + t12 * r02;
  out[outOff + 2] = 0 + t20 * r00 + t21 * r01 + t22 * r02;
  out[outOff + 3] = 0 + t00 * r10 + t01 * r11 + t02 * r12;
  out[outOff + 4] = 0 + t10 * r10 + t11 * r11 + t12 * r12;
  out[outOff + 5] = 0 + t20 * r10 + t21 * r11 + t22 * r12;
  out[outOff + 6] = 0 + t00 * r20 + t01 * r21 + t02 * r22;
  out[outOff + 7] = 0 + t10 * r20 + t11 * r21 + t12 * r22;
  out[outOff + 8] = 0 + t20 * r20 + t21 * r21 + t22 * r22;
  return out;
}

/**
 * Shifts an inertia tensor from the centre of mass to a point at offset `d`
 * (Steiner's theorem): `I + m (|d|² E − d dᵀ)`. The result is symmetric when `I` is.
 * The function is alias-safe, so `out` may be `I`.
 *
 * @param out - Receives the 3x3 result at `outOff`. `out` can be the same array as `I`.
 * @param I - Inertia tensor about the centre of mass, read at `IOff`.
 * @param mass - Body mass.
 * @param offset - Displacement `d` (3 values), read at `offsetOff`. Its sign does not change the result.
 * @param outOff - Index of the first cell of `out`. Default 0.
 * @param IOff - Index of the first cell of `I`. Default 0.
 * @param offsetOff - Index of the first value of `offset`. Default 0.
 * @returns `out`.
 */
export function parallelAxis(
  out: KernelOutput,
  I: KernelInput,
  mass: number,
  offset: KernelInput,
  outOff = 0,
  IOff = 0,
  offsetOff = 0
): KernelOutput {
  const i00 = I[IOff]!;
  const i10 = I[IOff + 1]!;
  const i20 = I[IOff + 2]!;
  const i01 = I[IOff + 3]!;
  const i11 = I[IOff + 4]!;
  const i21 = I[IOff + 5]!;
  const i02 = I[IOff + 6]!;
  const i12 = I[IOff + 7]!;
  const i22 = I[IOff + 8]!;
  const d0 = offset[offsetOff]!;
  const d1 = offset[offsetOff + 1]!;
  const d2 = offset[offsetOff + 2]!;

  // The diagonal adds the two other squares directly. `|d|² - di²` would cancel the
  // small squares when one component dominates (d = (1e8, 3, 4) gave 24, not 25).
  // Each off-diagonal pair uses one expression, so the result is exactly symmetric.
  const k01 = mass * (0 - d0 * d1);
  const k02 = mass * (0 - d0 * d2);
  const k12 = mass * (0 - d1 * d2);

  out[outOff] = i00 + mass * (d1 * d1 + d2 * d2);
  out[outOff + 1] = i10 + k01;
  out[outOff + 2] = i20 + k02;
  out[outOff + 3] = i01 + k01;
  out[outOff + 4] = i11 + mass * (d0 * d0 + d2 * d2);
  out[outOff + 5] = i21 + k12;
  out[outOff + 6] = i02 + k02;
  out[outOff + 7] = i12 + k12;
  out[outOff + 8] = i22 + mass * (d0 * d0 + d1 * d1);
  return out;
}
