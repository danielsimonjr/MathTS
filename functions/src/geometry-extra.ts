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
