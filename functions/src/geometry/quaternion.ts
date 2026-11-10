/**
 * Quaternion algebra and rotation conversions. This module is the one
 * definition of the quaternion conventions of the package:
 *
 * - **Layout.** A quaternion is `[w, x, y, z]`: the scalar part is first.
 * - **Product.** {@link quaternionMultiply} is the Hamilton product
 *   (`i·j = k`, `j·k = i`, `k·i = j`).
 * - **Rotation.** A quaternion rotates a vector actively:
 *   `v' = q · [0, v] · q⁻¹`. A positive angle turns counter-clockwise when you
 *   look from the tip of the axis toward the origin (right-hand rule).
 *   `q` and `−q` are the same rotation.
 * - **Composition.** `quaternionMultiply(a, b)` applies `b` first, then `a`.
 * - **Matrix.** {@link quaternionToRotationMatrix} gives a matrix `R` that acts
 *   on column vectors: `v' = R · v`.
 * - **Euler angles.** {@link quaternionToEuler} gives ZYX intrinsic angles as
 *   `[roll, pitch, yaw]`: `q = qz(yaw) · qy(pitch) · qx(roll)`.
 *
 * The rotation functions accept a quaternion of any finite, non-zero
 * magnitude. They read the quaternion as the rotation of its unit form. They
 * throw on the zero quaternion and on a quaternion that is not finite. The
 * magnitude itself must be a finite number: components near the largest
 * double can have a magnitude that is not finite.
 *
 * @packageDocumentation
 */

type Vec3 = readonly [number, number, number] | readonly number[];
type Quat = readonly [number, number, number, number] | readonly number[];

function dot4(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/**
 * Limits of the sum of squares for the fast magnitude. Outside these limits
 * the sum loses digits, underflows to zero or overflows.
 */
const SUM_SQ_MIN = 1e-280;
const SUM_SQ_MAX = 1e280;

/**
 * Euclidean length of `v`. `Math.hypot` scales its arguments, so the length is
 * correct where the sum of squares is not. The plain square root is the fast
 * path for the usual range.
 */
function length(v: readonly number[]): number {
  let sumSq = 0;
  for (const c of v) sumSq += c * c;
  return sumSq > SUM_SQ_MIN && sumSq < SUM_SQ_MAX ? Math.sqrt(sumSq) : Math.hypot(...v);
}

/**
 * Magnitude of `q`. Throws when the magnitude is zero or `q` is not finite:
 * `name` is the caller.
 */
function magnitude(q: Quat, name: string): number {
  const m = length(q);
  if (m === 0) throw new Error(`${name}: zero-magnitude quaternion`);
  if (!Number.isFinite(m)) throw new Error(`${name}: quaternion must be finite`);
  return m;
}

/** Unit form of `q`. Throws as {@link magnitude} does. */
function unitForm(q: Quat, name: string): [number, number, number, number] {
  const m = magnitude(q, name);
  return [q[0] / m, q[1] / m, q[2] / m, q[3] / m];
}

/** Hamilton product of two quaternions `[w, x, y, z]`. */
export function quaternionMultiply(q1: Quat, q2: Quat): number[] {
  const [w1, x1, y1, z1] = q1;
  const [w2, x2, y2, z2] = q2;
  return [
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
  ];
}

/** Quaternion conjugate `[w, −x, −y, −z]`. */
export function quaternionConjugate(q: Quat): number[] {
  return [q[0], -q[1], -q[2], -q[3]];
}

/** Unit-normalize a quaternion. Throws on the zero quaternion. */
export function quaternionNormalize(q: Quat): number[] {
  return unitForm(q, 'quaternionNormalize');
}

/**
 * Multiplicative inverse of a quaternion: `conj(q) / |q|²`. For unit
 * quaternions the inverse equals the conjugate. Throws on the zero quaternion.
 *
 * @example
 * quaternionInverse([0, 1, 0, 0])  // [0, -1, 0, 0]
 */
export function quaternionInverse(q: Quat): number[] {
  // Two divisions by |q|: the square of |q| can overflow or underflow.
  const m = magnitude(q, 'quaternionInverse');
  return [q[0] / m / m, -q[1] / m / m, -q[2] / m / m, -q[3] / m / m];
}

/**
 * Unit quaternion for a rotation of `angle` radians about `axis`. The axis
 * does not need unit length. Throws when the axis is zero or not finite,
 * because such an axis defines no rotation.
 */
export function quaternionFromAxisAngle(axis: Vec3, angle: number): number[] {
  const n = length([axis[0], axis[1], axis[2]]);
  if (!(n > 0) || !Number.isFinite(n)) {
    throw new Error('quaternionFromAxisAngle: axis must be finite and non-zero');
  }
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), (axis[0] / n) * s, (axis[1] / n) * s, (axis[2] / n) * s];
}

/** Rotate a 3-vector by a quaternion: `q · [0, v] · q⁻¹`. */
export function quaternionRotate(q: Quat, v: Vec3): number[] {
  const u = unitForm(q, 'quaternionRotate');
  const r = quaternionMultiply(
    quaternionMultiply(u, [0, v[0], v[1], v[2]]),
    quaternionConjugate(u)
  );
  return [r[1], r[2], r[3]];
}

/** 3×3 rotation matrix for a quaternion `[w, x, y, z]`. The matrix acts on column vectors. */
export function quaternionToRotationMatrix(q: Quat): number[][] {
  const [w, x, y, z] = unitForm(q, 'quaternionToRotationMatrix');
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

/** Above this dot product, {@link quaternionSlerp} interpolates linearly. */
const SLERP_DOT_THRESHOLD = 0.9995;

/**
 * Spherical linear interpolation between two rotations, `t ∈ [0,1]`. The
 * function normalizes both inputs, so the result is a unit quaternion. The
 * function takes the shortest arc and negates `q2` when the dot product is
 * negative. When the inputs are nearly parallel, the slerp coefficients are
 * numerically unstable. The function then interpolates linearly and normalizes.
 *
 * @example
 * quaternionSlerp([1,0,0,0], [0,1,0,0], 0)    // [1,0,0,0]
 * quaternionSlerp([1,0,0,0], [0,1,0,0], 1)    // [0,1,0,0]
 */
export function quaternionSlerp(q1: Quat, q2: Quat, t: number): number[] {
  const a = unitForm(q1, 'quaternionSlerp');
  let b: number[] = unitForm(q2, 'quaternionSlerp');
  let d = dot4(a, b);
  if (d < 0) {
    d = -d;
    b = b.map((v) => -v);
  }
  if (d > SLERP_DOT_THRESHOLD) {
    // The two unit inputs are less than 2 degrees apart, so the sum is not zero.
    return quaternionNormalize(a.map((v, i) => v + t * (b[i] - v)));
  }
  const theta0 = Math.acos(d);
  const theta = theta0 * t;
  const sinTheta0 = Math.sin(theta0);
  const sinTheta = Math.sin(theta);
  const s0 = Math.cos(theta) - (d * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return a.map((v, i) => s0 * v + s1 * b[i]);
}

/**
 * Within this distance of `|sin(pitch)| = 1`, the rotation is at gimbal lock.
 * The band is about 1.4e-6 rad of pitch on each side of ±90°.
 */
const GIMBAL_LOCK_EPS = 1e-12;

/**
 * Convert a quaternion `[w, x, y, z]` to ZYX intrinsic Euler angles
 * `[roll, pitch, yaw]` in radians (the aerospace yaw-pitch-roll sequence).
 * Pitch is in `[−π/2, π/2]`.
 *
 * At pitch ±90° (gimbal lock) only the sum or the difference of roll and yaw
 * is defined. The function then returns roll `0`. The function puts the full
 * turn in yaw, so the angles still rebuild the same rotation.
 *
 * @example
 * quaternionToEuler([1, 0, 0, 0])  // [0, 0, 0]
 */
export function quaternionToEuler(q: Quat): [number, number, number] {
  const [w, x, y, z] = unitForm(q, 'quaternionToEuler');
  const sinp = 2 * (w * y - z * x);
  if (sinp > 1 - GIMBAL_LOCK_EPS) return [0, Math.PI / 2, -2 * Math.atan2(x, w)];
  if (sinp < -1 + GIMBAL_LOCK_EPS) return [0, -Math.PI / 2, 2 * Math.atan2(x, w)];
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return [roll, Math.asin(sinp), yaw];
}

/**
 * Quaternion logarithm. For `q = (w, v)`:
 * `log(q) = (ln|q|, θ·û)` where `θ = atan2(|v|, w)` and `û = v/|v|`.
 * For a unit quaternion the scalar part is `0` and `θ` is half of the
 * rotation angle. Throws on the zero quaternion.
 *
 * A quaternion with an exactly zero vector part has no axis. The function
 * returns `(ln|w|, 0, 0, 0)`. For a negative `w`, the result is the logarithm
 * of the same rotation (`q` and `−q` are one rotation), not of the same
 * quaternion. Each other quaternion keeps its axis, so a negative `w` with a
 * very small vector part gives a vector part of length near `π`.
 *
 * @example
 * quaternionLog([1, 0, 0, 0])  // [0, 0, 0, 0]
 */
export function quaternionLog(q: Quat): number[] {
  const [w, x, y, z] = q;
  const lnMag = Math.log(magnitude(q, 'quaternionLog'));
  const vNorm = length([x, y, z]);
  if (vNorm === 0) return [lnMag, 0, 0, 0];
  const theta = Math.atan2(vNorm, w);
  return [lnMag, (x / vNorm) * theta, (y / vNorm) * theta, (z / vNorm) * theta];
}

/**
 * Quaternion exponential. For `q = (w, v)`:
 * `exp(q) = eʷ · (cos|v|, sin|v|·v/|v|)`. This function is the inverse
 * of {@link quaternionLog}. For a pure quaternion (`w = 0`) the result is a
 * unit quaternion.
 *
 * @example
 * quaternionExp([0, 0, 0, 0])  // [1, 0, 0, 0]
 */
export function quaternionExp(q: Quat): number[] {
  const [w, x, y, z] = q;
  const vNorm = length([x, y, z]);
  const ew = Math.exp(w);
  if (vNorm === 0) return [ew, 0, 0, 0];
  const s = ew * Math.sin(vNorm);
  return [ew * Math.cos(vNorm), (x / vNorm) * s, (y / vNorm) * s, (z / vNorm) * s];
}

/**
 * Quaternion power: `pow(q, t) = exp(t · log(q))`. For a unit quaternion, the
 * power multiplies the rotation angle by `t` about the same axis (`t = 1` returns
 * `q`; `t = 0` returns the identity `[1, 0, 0, 0]`; `t = 2` doubles the
 * rotation). The magnitude of the result is `|q|ᵗ`.
 *
 * @example
 * quaternionPow([0.70710678, 0, 0, 0.70710678], 0.5)  // [0.92387953, 0, 0, 0.38268343]
 */
export function quaternionPow(q: Quat, t: number): number[] {
  return quaternionExp(quaternionLog(q).map((v) => v * t));
}
