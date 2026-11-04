/**
 * Spherical Bessel functions j_n, y_n, i_n, k_n, Hankel functions of real order,
 * and the first positive zeros of J_ν.
 *
 * Conventions: `j_n(x) = √(π/2x) J_{n+1/2}(x)`, `y_n` likewise from Y, `i_n = √(π/2x) I_{n+1/2}(x)`,
 * `k_n = √(π/2x) K_{n+1/2}(x)` (so `k_0(x) = (π/2) e^{-x}/x`).
 */

import { Complex } from '@danielsimonjr/mathts-core';
import { besselJ, besselY } from '../typed/special.js';

function asNumber(value: unknown, name: string): number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}: expected a scalar result`);
  }
  return value;
}

function assertOrder(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${name}: order must be a non-negative integer`);
  }
}

/**
 * Miller's downward recurrence `f_{k-1} = a_k f_k + sign · f_{k+1}` with `a_k = (2k+1)/x`,
 * normalised so that the computed `f_0` equals the exact value `f0`.
 */
function millerDownward(n: number, x: number, sign: 1 | -1, f0: number): number {
  const big = Math.max(n, Math.abs(x));
  const start = Math.ceil(big) + 30 + Math.ceil(Math.sqrt(40 * (big + 1)));
  const vals = new Array<number>(start + 2).fill(0);
  vals[start] = 1;
  for (let k = start; k >= 1; k -= 1) {
    const prev = ((2 * k + 1) / x) * vals[k] + sign * vals[k + 1];
    vals[k - 1] = prev;
    if (Math.abs(prev) > 1e150) {
      for (let j = k - 1; j <= start; j += 1) vals[j] *= 1e-150;
    }
  }
  return vals[n] * (f0 / vals[0]);
}

/** j_n(x): upward recurrence for x > n, Miller downward otherwise. */
function sphBesselJ(n: number, x: number): number {
  if (x === 0) return n === 0 ? 1 : 0;
  const j0 = Math.sin(x) / x;
  if (n === 0) return j0;
  if (x > n) {
    const j1 = Math.sin(x) / (x * x) - Math.cos(x) / x;
    let jm = j0;
    let j = j1;
    for (let k = 1; k < n; k += 1) {
      const next = ((2 * k + 1) / x) * j - jm;
      jm = j;
      j = next;
    }
    return j;
  }
  return millerDownward(n, x, -1, j0);
}

/** y_n(x): upward recurrence (stable for Y). */
function sphBesselY(n: number, x: number): number {
  if (x === 0) return -Infinity;
  const y0 = -Math.cos(x) / x;
  if (n === 0) return y0;
  let ym = y0;
  let y = -Math.cos(x) / (x * x) - Math.sin(x) / x;
  for (let k = 1; k < n; k += 1) {
    const next = ((2 * k + 1) / x) * y - ym;
    ym = y;
    y = next;
  }
  return y;
}

/** i_n(x): Miller downward recurrence (I is the minimal solution). */
function sphBesselI(n: number, x: number): number {
  if (x === 0) return n === 0 ? 1 : 0;
  const i0 = Math.sinh(x) / x;
  if (n === 0) return i0;
  return millerDownward(n, x, 1, i0);
}

/** k_n(x): upward recurrence (stable for K). */
function sphBesselK(n: number, x: number): number {
  if (x === 0) return Infinity;
  const k0 = (Math.PI / 2) * (Math.exp(-x) / x);
  if (n === 0) return k0;
  let km = k0;
  let k = k0 * (1 + 1 / x);
  for (let j = 1; j < n; j += 1) {
    const next = km + ((2 * j + 1) / x) * k;
    km = k;
    k = next;
  }
  return k;
}

/** Spherical Bessel function of the first kind `j_n(x)`. */
export function sphericalBesselJ(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselJ');
  return Number.isNaN(x) ? NaN : sphBesselJ(n, x);
}

/** Spherical Bessel function of the second kind `y_n(x)`. */
export function sphericalBesselY(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselY');
  return Number.isNaN(x) ? NaN : sphBesselY(n, x);
}

/** Modified spherical Bessel function of the first kind `i_n(x)`. */
export function sphericalBesselI(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselI');
  return Number.isNaN(x) ? NaN : sphBesselI(n, x);
}

/** Modified spherical Bessel function of the second kind `k_n(x)`. */
export function sphericalBesselK(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselK');
  return Number.isNaN(x) ? NaN : sphBesselK(n, x);
}

/** Hankel function of the first kind `H¹_ν(x) = J_ν(x) + i Y_ν(x)`. */
export function hankelH1(nu: number, x: number): Complex {
  const j = asNumber(besselJ(nu, x), 'hankelH1');
  const y = asNumber(besselY(nu, x), 'hankelH1');
  return new Complex(j, y);
}

/** Hankel function of the second kind `H²_ν(x) = J_ν(x) − i Y_ν(x)`. */
export function hankelH2(nu: number, x: number): Complex {
  const j = asNumber(besselJ(nu, x), 'hankelH2');
  const y = asNumber(besselY(nu, x), 'hankelH2');
  return new Complex(j, -y);
}

/** d/dx J_ν(x) = (J_{ν−1}(x) − J_{ν+1}(x)) / 2, with J_{−1} = −J_1. */
function besselJDerivative(nu: number, x: number): number {
  const jPrev =
    nu === 0
      ? -asNumber(besselJ(1, x), 'besselJZeros')
      : asNumber(besselJ(nu - 1, x), 'besselJZeros');
  const jNext = asNumber(besselJ(nu + 1, x), 'besselJZeros');
  return (jPrev - jNext) / 2;
}

/**
 * First `k` positive zeros of `J_ν(x)`, via McMahon's asymptotic guess refined by Newton.
 *
 * @example
 * besselJZeros(0, 2) // [2.404825557695773, 5.520078110286311]
 */
export function besselJZeros(nu: number, k: number): number[] {
  if (!Number.isInteger(k) || k < 1) {
    throw new RangeError('besselJZeros: k must be a positive integer');
  }
  const mu = 4 * nu * nu;
  const zeros: number[] = [];
  for (let s = 1; s <= k; s += 1) {
    const beta = (s + nu / 2 - 0.25) * Math.PI;
    const b8 = 8 * beta;
    let x = beta - (mu - 1) / b8 - (4 * (mu - 1) * (7 * mu - 31)) / (3 * b8 * b8 * b8);
    for (let it = 0; it < 100; it += 1) {
      const dx = asNumber(besselJ(nu, x), 'besselJZeros') / besselJDerivative(nu, x);
      x -= dx;
      if (Math.abs(dx) <= 1e-15 * Math.max(1, Math.abs(x))) break;
    }
    zeros.push(x);
  }
  return zeros;
}
