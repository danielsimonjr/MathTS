/**
 * Geodesy / spherical-geometry connectors (Wave C / bridge C7).
 * Bridges geometry ↔ trigonometry — distances on a sphere, not a plane.
 */
import { toRadians as _toRadians } from './typed/trigonometry.js';

const toRad = (deg: number): number => _toRadians(deg) as number;

/** Mean Earth radius in kilometres (the `haversine` default). */
export const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle (haversine) distance between two latitude/longitude points given
 * in **degrees**. Returns the distance in the units of `radius` (default: km on
 * mean-Earth-radius).
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius = EARTH_RADIUS_KM
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Vec3 = readonly [number, number, number] | readonly number[];
type Quat = readonly [number, number, number, number] | readonly number[];

const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a: readonly number[]): number => Math.sqrt(dot(a, a));

/**
 * Spherical linear interpolation between two vectors (treated as directions on a
 * sphere). `t ∈ [0,1]`; result has interpolated direction and magnitude. Falls back
 * to linear interpolation when the vectors are nearly parallel.
 */
export function slerp(v0: readonly number[], v1: readonly number[], t: number): number[] {
  const n0 = norm(v0);
  const n1 = norm(v1);
  const u0 = v0.map((v) => v / n0);
  const u1 = v1.map((v) => v / n1);
  let cos = dot(u0, u1);
  cos = cos > 1 ? 1 : cos < -1 ? -1 : cos;
  const omega = Math.acos(cos);
  const mag = n0 + (n1 - n0) * t;
  if (omega < 1e-9) return u0.map((v, i) => (v + (u1[i] - v) * t) * mag); // ~parallel → lerp
  const s = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / s;
  const b = Math.sin(t * omega) / s;
  return u0.map((v, i) => (a * v + b * u1[i]) * mag);
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

/** Unit-normalize a quaternion. */
export function quaternionNormalize(q: Quat): number[] {
  const m = norm(q as number[]);
  return (q as number[]).map((v) => v / m);
}

/** Unit quaternion for a rotation of `angle` radians about (unit-normalized) `axis`. */
export function quaternionFromAxisAngle(axis: Vec3, angle: number): number[] {
  const n = norm(axis as number[]) || 1;
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), (axis[0] / n) * s, (axis[1] / n) * s, (axis[2] / n) * s];
}

/** Rotate a 3-vector by a (unit) quaternion: `q · [0,v] · q⁻¹`. */
export function quaternionRotate(q: Quat, v: Vec3): number[] {
  const r = quaternionMultiply(quaternionMultiply(q, [0, v[0], v[1], v[2]]), quaternionConjugate(q));
  return [r[1], r[2], r[3]];
}

/** 3×3 rotation matrix for a (unit) quaternion `[w, x, y, z]`. */
export function quaternionToRotationMatrix(q: Quat): number[][] {
  const [w, x, y, z] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
