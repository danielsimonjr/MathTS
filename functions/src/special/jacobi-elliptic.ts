/**
 * Jacobi elliptic functions sn, cn, dn.
 *
 * Uses the parameter convention `m = k^2` (matching scipy's
 * `scipy.special.ellipj(u, m)` and mpmath's `ellipfun(..., u, m)`), not the
 * modulus-angle convention some texts use.
 *
 * Computed via the descending Landen transformation / arithmetic-geometric
 * mean (AGM) method (Abramowitz & Stegun 16.4, the Bulirsch algorithm):
 * build the AGM sequences
 *
 *   a_0 = 1, b_0 = sqrt(1 - m), c_0 = sqrt(m)
 *   a_{i+1} = (a_i + b_i) / 2
 *   b_{i+1} = sqrt(a_i * b_i)
 *   c_{i+1} = (a_i - b_i) / 2
 *
 * until c_N is negligible, then descend the amplitude
 *
 *   phi_N = 2^N * a_N * u
 *   phi_{i-1} = (phi_i + asin((c_i / a_i) * sin(phi_i))) / 2   for i = N..1
 *
 * so that sn(u,m) = sin(phi_0), cn(u,m) = cos(phi_0),
 * dn(u,m) = sqrt(1 - m * sn^2(u,m)).
 *
 * @packageDocumentation
 */

/** AGM iterations; c_i halves in magnitude each step (roughly) so this
 * comfortably reaches double-precision zero for m in [0, 1]. */
const MAX_AGM_ITERATIONS = 12;

/** Below this, c_i is treated as converged to zero. */
const AGM_TOLERANCE = 1e-16;

interface JacobiElliptic {
  sn: number;
  cn: number;
  dn: number;
}

/**
 * Compute sn, cn, dn simultaneously via the AGM/descending-Landen method.
 * Internal — the three public functions each call this and pick a field,
 * since the AGM ladder is shared work.
 */
function jacobiElliptic(u: number, m: number): JacobiElliptic {
  if (m < 0 || m > 1) {
    throw new Error('jacobiElliptic: m (=k^2) must be in [0, 1]');
  }
  if (m === 0) {
    return { sn: Math.sin(u), cn: Math.cos(u), dn: 1 };
  }
  if (m === 1) {
    const sn = Math.tanh(u);
    const sech = 1 / Math.cosh(u);
    return { sn, cn: sech, dn: sech };
  }

  const a: number[] = [1];
  const b: number[] = [Math.sqrt(1 - m)];
  const c: number[] = [Math.sqrt(m)];

  let n = 0;
  while (n < MAX_AGM_ITERATIONS && Math.abs(c[n]) > AGM_TOLERANCE) {
    a.push((a[n] + b[n]) / 2);
    b.push(Math.sqrt(a[n] * b[n]));
    c.push((a[n] - b[n]) / 2);
    n++;
  }

  let phi = Math.pow(2, n) * a[n] * u;
  for (let i = n; i >= 1; i--) {
    phi = (phi + Math.asin((c[i] / a[i]) * Math.sin(phi))) / 2;
  }

  const sn = Math.sin(phi);
  const cn = Math.cos(phi);
  const dn = Math.sqrt(1 - m * sn * sn);
  return { sn, cn, dn };
}

/**
 * Jacobi elliptic function sn(u, m), parameter convention m = k^2.
 *
 * @param u - Argument
 * @param m - Parameter m = k^2, must be in [0, 1]
 * @returns sn(u, m)
 *
 * @example
 * jacobiSN(0.5, 0.3) // ~0.4742156227
 */
export function jacobiSN(u: number, m: number): number {
  return jacobiElliptic(u, m).sn;
}

/**
 * Jacobi elliptic function cn(u, m), parameter convention m = k^2.
 *
 * @param u - Argument
 * @param m - Parameter m = k^2, must be in [0, 1]
 * @returns cn(u, m)
 *
 * @example
 * jacobiCN(0.5, 0.3) // ~0.8804087364
 */
export function jacobiCN(u: number, m: number): number {
  return jacobiElliptic(u, m).cn;
}

/**
 * Jacobi elliptic function dn(u, m), parameter convention m = k^2.
 *
 * @param u - Argument
 * @param m - Parameter m = k^2, must be in [0, 1]
 * @returns dn(u, m)
 *
 * @example
 * jacobiDN(0.5, 0.3) // ~0.9656789647
 */
export function jacobiDN(u: number, m: number): number {
  return jacobiElliptic(u, m).dn;
}
