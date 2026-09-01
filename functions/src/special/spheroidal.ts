/**
 * Prolate spheroidal wave functions — angular characteristic values
 * `λ_mn(c)` and the angular function `S_mn(c, η)` via the associated-Legendre
 * expansion (Flammer / Hodge). The pentadiagonal recurrence in the expansion
 * coefficients reduces to a symmetric tridiagonal eigenproblem on each
 * parity chain (even/odd `n−m`); we reuse matrix `eig`.
 *
 * As `c → 0`, `λ_mn → n(n+1)` and `S_mn(c, η) → P_n^m(η)` (Ferrers).
 * Oracle: `c = 0` closed form + finite-difference residual of the angular
 * ODE; scipy's `pro_cv` / `pro_ang1` when available in the gap suite.
 *
 * @packageDocumentation
 */

import { eig } from '@danielsimonjr/mathts-matrix';

type f64 = number;

/** Truncation of the associated-Legendre expansion (super-exponential decay). */
const KMAX = 48;

function checkMN(m: number, n: number, name: string): void {
  if (!Number.isInteger(m) || m < 0) {
    throw new Error(`${name}: m must be a nonnegative integer`);
  }
  if (!Number.isInteger(n) || n < m) {
    throw new Error(`${name}: n must be an integer ≥ m`);
  }
}

/**
 * Ferrers associated Legendre `P_n^m(x)` on `[-1, 1]` via the standard
 * recurrence (stable for the modest `n` used by the expansion).
 */
export function ferrersP(n: number, m: number, x: f64): f64 {
  if (m < 0 || n < m) return 0;
  const s = Math.max(0, 1 - x * x);
  const somx2 = Math.sqrt(s);
  let pmm = 1;
  if (m > 0) {
    let fact = 1;
    for (let i = 1; i <= m; i += 1) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }
  if (n === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (n === m + 1) return pmmp1;
  let pnn = pmmp1;
  for (let nn = m + 2; nn <= n; nn += 1) {
    pnn = ((2 * nn - 1) * x * pmmp1 - (nn + m - 1) * pmm) / (nn - m);
    pmm = pmmp1;
    pmmp1 = pnn;
  }
  return pnn;
}

interface Mode {
  lambda: f64;
  /** Coefficients `d_r` of `P_{m+r}^m`, r = r0, r0+2, ... */
  coeffs: Float64Array;
  r0: number;
}

function alpha(m: number, r: number, c2: f64): f64 {
  const ell = m + r;
  if (ell === 0 && m === 0) {
    return c2 / 3;
  }
  const den = (2 * ell - 1) * (2 * ell + 3);
  const extra = den === 0 ? 0 : (c2 * (2 * ell * (ell + 1) - 2 * m * m - 1)) / den;
  return ell * (ell + 1) + extra;
}

function beta(m: number, r: number, c2: f64): f64 {
  const ell = m + r;
  const den = (2 * ell + 3) * (2 * ell + 5);
  if (den === 0) return 0;
  return (c2 * (ell + m + 1) * (ell + m + 2)) / den;
}

function gammaCoeff(m: number, r: number, c2: f64): f64 {
  const ell = m + r;
  const den = (2 * ell - 3) * (2 * ell - 1);
  if (den === 0) return 0;
  return (c2 * (ell - m) * (ell - m - 1)) / den;
}

function solveParity(m: number, r0: number, c: f64): Mode[] {
  const c2 = c * c;
  const rs: number[] = [];
  for (let r = r0; r < KMAX; r += 2) rs.push(r);
  const N = rs.length;
  const diag = new Float64Array(N);
  const off = new Float64Array(N - 1);
  for (let i = 0; i < N; i += 1) {
    diag[i] = alpha(m, rs[i], c2);
    if (i < N - 1) {
      const b = beta(m, rs[i], c2);
      const g = gammaCoeff(m, rs[i + 1], c2);
      // Symmetrize the product β_i γ_{i+1} (both ≥ 0 for c² ≥ 0, r increasing).
      off[i] = Math.sign(b) * Math.sqrt(Math.abs(b * g));
    }
  }
  const mat: number[][] = Array.from({ length: N }, () => Array<number>(N).fill(0));
  for (let i = 0; i < N; i += 1) {
    mat[i][i] = diag[i];
    if (i < N - 1) {
      mat[i][i + 1] = off[i];
      mat[i + 1][i] = off[i];
    }
  }
  const { values, vectors } = eig(mat);
  const order = values.map((v, i) => ({ lam: v.re, i })).sort((a, b) => a.lam - b.lam);
  return order.map(({ lam, i }) => {
    const coeffs = new Float64Array(N);
    let nrm = 0;
    for (let k = 0; k < N; k += 1) {
      coeffs[k] = vectors[k][i];
      nrm += coeffs[k] * coeffs[k];
    }
    const s = Math.sqrt(nrm) || 1;
    // Sign: make the lowest-r coefficient positive (c→0: that mode is P_{m+r0}^m).
    const sign = coeffs[0] < 0 ? -1 : 1;
    for (let k = 0; k < N; k += 1) coeffs[k] = (sign * coeffs[k]) / s;
    return { lambda: lam, coeffs, r0 };
  });
}

function modeFor(m: number, n: number, c: f64): Mode {
  const N = n - m;
  const r0 = N % 2;
  const idx = Math.floor(N / 2);
  const modes = solveParity(m, r0, c);
  if (idx >= modes.length) {
    throw new Error(`spheroidal: expansion too short for n=${n}, m=${m}`);
  }
  return modes[idx];
}

/**
 * Angular characteristic value `λ_mn(c)` of the prolate spheroidal equation.
 * `λ_mn(0) = n(n+1)`.
 */
export function spheroidalLambda(m: number, n: number, c: f64): f64 {
  checkMN(m, n, 'spheroidalLambda');
  if (c === 0) return n * (n + 1);
  return modeFor(m, n, c).lambda;
}

/** Alias matching the DLMF `λ_mn(c)` notation. */
export const spheroidalCharacteristic = spheroidalLambda;

/**
 * Prolate angular spheroidal function `S_mn(c, η)` on `η ∈ [-1, 1]`.
 * `S_mn(0, η) = P_n^m(η)`.
 */
export function spheroidalAngular(m: number, n: number, c: f64, eta: f64): f64 {
  checkMN(m, n, 'spheroidalAngular');
  if (!Number.isFinite(eta) || eta < -1 || eta > 1) {
    throw new Error('spheroidalAngular: eta must lie in [-1, 1]');
  }
  if (c === 0) return ferrersP(n, m, eta);
  const mode = modeFor(m, n, c);
  // Scale so S_mn(0) matching is recovered at small c: the c=0 mode is a
  // single associated-Legendre, whose L2-on-coefficients norm is 1 after
  // our sign convention — evaluate the series and rescale to P_n^m(η0)
  // at a safe interior point when m=0, or by the first coefficient.
  let s = 0;
  for (let i = 0; i < mode.coeffs.length; i += 1) {
    const r = mode.r0 + 2 * i;
    s += mode.coeffs[i] * ferrersP(m + r, m, eta);
  }
  // Eigenvector is L2-normalised in coefficient space. Re-scale so
  // S_mn(c, η★) has the same sign and a smooth c→0 limit equal to P_n^m.
  const ref = m === 0 ? 0 : 0.5;
  const pref = ferrersP(n, m, ref);
  let sref = 0;
  for (let i = 0; i < mode.coeffs.length; i += 1) {
    const r = mode.r0 + 2 * i;
    sref += mode.coeffs[i] * ferrersP(m + r, m, ref);
  }
  if (Math.abs(sref) < 1e-18 || Math.abs(pref) < 1e-18) return s;
  return s * (pref / sref);
}

/**
 * Prolate radial function of the first kind `R_mn^{(1)}(c, ξ)` for `ξ ≥ 1`,
 * obtained from the angular function by the joining relation
 * `R_mn^{(1)}(c, ξ) ∝ S_mn(c, ξ)` continued off `[-1,1]` via the same
 * associated-Legendre series (analytic continuation of Ferrers to `ξ > 1`
 * through the same recurrence — valid for the modest `n` used here).
 *
 * Scaled so `R_mn^{(1)}(c, ξ) ∼ j_n(c ξ)` as `ξ → ∞` is NOT enforced (that
 * needs the spherical-Bessel joining factor). This export is the angular
 * series evaluated at `ξ`, which satisfies the radial ODE in `ξ` after the
 * standard `η ↔ ξ` substitution and is the quantity the characteristic-value
 * tests pin.
 */
export function spheroidalRadial(m: number, n: number, c: f64, xi: f64): f64 {
  checkMN(m, n, 'spheroidalRadial');
  if (!Number.isFinite(xi) || xi < 1) {
    throw new Error('spheroidalRadial: xi must be ≥ 1');
  }
  // Continue Ferrers off the cut via the same recurrence (x > 1 is allowed
  // algebraically; (1-x²)^{m/2} becomes (x²-1)^{m/2} i^m — we take the
  // real continuation (x²-1)^{m/2} with a real positive branch).
  return spheroidalAngularContinued(m, n, c, xi);
}

function ferrersPContinued(n: number, m: number, x: f64): f64 {
  const somx2 = x * x >= 1 ? Math.sqrt(x * x - 1) : Math.sqrt(1 - x * x);
  let pmm = 1;
  if (m > 0) {
    let fact = 1;
    for (let i = 1; i <= m; i += 1) {
      pmm *= fact * somx2; // real continuation, drop the Ferrers (−1)^m
      fact += 2;
    }
  }
  if (n === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (n === m + 1) return pmmp1;
  let pnn = pmmp1;
  for (let nn = m + 2; nn <= n; nn += 1) {
    pnn = ((2 * nn - 1) * x * pmmp1 - (nn + m - 1) * pmm) / (nn - m);
    pmm = pmmp1;
    pmmp1 = pnn;
  }
  return pnn;
}

function spheroidalAngularContinued(m: number, n: number, c: f64, x: f64): f64 {
  if (c === 0) return ferrersPContinued(n, m, x);
  const mode = modeFor(m, n, c);
  let s = 0;
  for (let i = 0; i < mode.coeffs.length; i += 1) {
    const r = mode.r0 + 2 * i;
    s += mode.coeffs[i] * ferrersPContinued(m + r, m, x);
  }
  const ref = 1.2;
  const pref = ferrersPContinued(n, m, ref);
  let sref = 0;
  for (let i = 0; i < mode.coeffs.length; i += 1) {
    const r = mode.r0 + 2 * i;
    sref += mode.coeffs[i] * ferrersPContinued(m + r, m, ref);
  }
  if (Math.abs(sref) < 1e-18 || Math.abs(pref) < 1e-18) return s;
  return s * (pref / sref);
}
