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
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  if (n0 === 0 || n1 === 0) throw new Error('slerp: input vectors must be non-zero');
  const u0 = v0.map((v) => v / n0);
  const u1 = v1.map((v) => v / n1);
  let cos = dot(u0, u1);
  cos = cos > 1 ? 1 : cos < -1 ? -1 : cos;
  const omega = Math.acos(cos);
  const mag = n0 + (n1 - n0) * t;
  if (omega < 1e-9) return u0.map((v, i) => (v + (u1[i] - v) * t) * mag); // ~parallel → lerp
  // Antipodal directions (θ ≈ π): sin(omega) ≈ 0, so a/b below would explode — and the
  // interpolation path is genuinely undefined (no unique great circle). Fail loudly.
  if (Math.PI - omega < 1e-9)
    throw new Error('slerp: antipodal directions have no unique interpolation path');
  const s = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / s;
  const b = Math.sin(t * omega) / s;
  return u0.map((v, i) => (a * v + b * u1[i]) * mag);
}
