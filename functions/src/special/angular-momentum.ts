/**
 * Angular-momentum coupling (Wigner 3j, Clebsch–Gordan, Wigner 6j) via the Racah
 * formulas, and spherical harmonics with the Condon–Shortley phase.
 *
 * All angular momenta may be integers or half-integers. Inputs that are not
 * multiples of ½ raise `RangeError`; selection-rule violations return 0.
 */

import { Complex } from '@danielsimonjr/mathts-core';
import { ferrersP } from './spheroidal.js';
import { MAX_FERRERS_ORDER, assertLoopOrder } from '../utils/limits.js';

function assertHalfInteger(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(2 * value)) {
    throw new RangeError(`${name}: angular momentum must be a multiple of 1/2`);
  }
}

/** n! for a non-negative integer n (exact in double precision up to 170!). */
function fact(n: number): number {
  const m = Math.round(n);
  if (m < 0) throw new RangeError('factorial of a negative integer');
  // 171! exceeds the largest double, so every larger factorial is Infinity.
  if (m > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= m; i += 1) r *= i;
  return r;
}

/** (−1)^e for an integer-valued e (possibly negative). */
function phase(e: number): number {
  return Math.abs(Math.round(e)) % 2 === 0 ? 1 : -1;
}

/** Triangle coefficient Δ(a,b,c) = √[(a+b−c)!(a−b+c)!(−a+b+c)!/(a+b+c+1)!]. */
function triangleDelta(a: number, b: number, c: number): number {
  return Math.sqrt((fact(a + b - c) * fact(a - b + c) * fact(-a + b + c)) / fact(a + b + c + 1));
}

/** Triangle rule with integer perimeter: |a−b| ≤ c ≤ a+b and a+b+c ∈ ℤ. */
function triangleOk(a: number, b: number, c: number): boolean {
  return Number.isInteger(a + b + c) && c <= a + b && c >= Math.abs(a - b);
}

/**
 * Wigner 3j symbol `(j1 j2 j3; m1 m2 m3)` by the Racah formula.
 *
 * @example
 * wigner3j(1, 1, 0, 0, 0, 0) // -0.5773502691896258
 */
export function wigner3j(
  j1: number,
  j2: number,
  j3: number,
  m1: number,
  m2: number,
  m3: number
): number {
  assertHalfInteger(j1, 'wigner3j');
  assertHalfInteger(j2, 'wigner3j');
  assertHalfInteger(j3, 'wigner3j');
  assertHalfInteger(m1, 'wigner3j');
  assertHalfInteger(m2, 'wigner3j');
  assertHalfInteger(m3, 'wigner3j');
  if (m1 + m2 + m3 !== 0) return 0;
  if (!triangleOk(j1, j2, j3)) return 0;
  if (Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(m3) > j3) return 0;
  if (!Number.isInteger(j1 + m1) || !Number.isInteger(j2 + m2) || !Number.isInteger(j3 + m3)) {
    return 0;
  }

  const delta = triangleDelta(j1, j2, j3);
  const pre =
    delta *
    Math.sqrt(
      fact(j1 + m1) * fact(j1 - m1) * fact(j2 + m2) * fact(j2 - m2) * fact(j3 + m3) * fact(j3 - m3)
    );
  const kMin = Math.max(0, j2 - j3 - m1, j1 - j3 + m2);
  const kMax = Math.min(j1 + j2 - j3, j1 - m1, j2 + m2);
  let sum = 0;
  for (let k = kMin; k <= kMax; k += 1) {
    const denom =
      fact(k) *
      fact(j3 - j2 + k + m1) *
      fact(j3 - j1 + k - m2) *
      fact(j1 + j2 - j3 - k) *
      fact(j1 - k - m1) *
      fact(j2 - k + m2);
    sum += phase(k) / denom;
  }
  return phase(j1 - j2 - m3) * pre * sum;
}

/**
 * Clebsch–Gordan coefficient `⟨j1 m1; j2 m2 | J M⟩`.
 *
 * @example
 * clebschGordan(1, 0, 1, 0, 2, 0) // 0.816496580927726
 */
export function clebschGordan(
  j1: number,
  m1: number,
  j2: number,
  m2: number,
  J: number,
  M: number
): number {
  return phase(j1 - j2 + M) * Math.sqrt(2 * J + 1) * wigner3j(j1, j2, J, m1, m2, -M);
}

/**
 * Wigner 6j symbol `{j1 j2 j3; j4 j5 j6}` by the Racah formula.
 *
 * @example
 * wigner6j(1, 1, 1, 1, 1, 1) // 1/6
 */
export function wigner6j(
  j1: number,
  j2: number,
  j3: number,
  j4: number,
  j5: number,
  j6: number
): number {
  for (const [v, name] of [
    [j1, 'j1'],
    [j2, 'j2'],
    [j3, 'j3'],
    [j4, 'j4'],
    [j5, 'j5'],
    [j6, 'j6'],
  ] as const) {
    assertHalfInteger(v, `wigner6j(${name})`);
  }
  if (
    !triangleOk(j1, j2, j3) ||
    !triangleOk(j1, j5, j6) ||
    !triangleOk(j4, j2, j6) ||
    !triangleOk(j4, j5, j3)
  ) {
    return 0;
  }

  const a1 = j1 + j2 + j3;
  const a2 = j1 + j5 + j6;
  const a3 = j4 + j2 + j6;
  const a4 = j4 + j5 + j3;
  const b1 = j1 + j2 + j4 + j5;
  const b2 = j2 + j3 + j5 + j6;
  const b3 = j3 + j1 + j6 + j4;
  const tMin = Math.max(a1, a2, a3, a4);
  const tMax = Math.min(b1, b2, b3);

  let sum = 0;
  for (let t = tMin; t <= tMax; t += 1) {
    const denom =
      fact(t - a1) *
      fact(t - a2) *
      fact(t - a3) *
      fact(t - a4) *
      fact(b1 - t) *
      fact(b2 - t) *
      fact(b3 - t);
    sum += (phase(t) * fact(t + 1)) / denom;
  }
  const pre =
    triangleDelta(j1, j2, j3) *
    triangleDelta(j1, j5, j6) *
    triangleDelta(j4, j2, j6) *
    triangleDelta(j4, j5, j3);
  return pre * sum;
}

/**
 * The largest `l + |m|` for which the factorial form of `sphericalHarmonic` is used:
 * `171!` is above the largest double, so `(l − m)! / (l + m)!` is lost from `l + |m| = 171`.
 */
const YLM_FACTORIAL_MAX = 170;

/**
 * The normalised associated Legendre function
 * `P̄_l^m(cos θ) = √((2l+1)/(4π) · (l−m)!/(l+m)!) · P_l^m(cos θ)` for `0 ≤ m ≤ l`, with the
 * Condon–Shortley phase, by the upward recurrence in `l` on the normalised functions
 * `P̄_k = f_k (x P̄_{k−1} − P̄_{k−2} / f_{k−1})`, `f_k = √((4k²−1)/(k²−m²))`. The start value
 * `P̄_m^m = (−1)^m √((2m+1)/(4π) · (2m−1)!!/(2m)!!) · sin^m θ` is kept as a logarithm, and the
 * recurrence rescales by `1e-250` above `1e250`, so no step overflows or underflows.
 * At a pole (`sin θ = 0`) the function is 0 for `m ≠ 0`.
 */
function normalizedLegendre(l: number, m: number, theta: number): number {
  const x = Math.cos(theta);
  let logScale = 0.5 * (Math.log(2 * m + 1) - Math.log(4 * Math.PI));
  if (m > 0) {
    const s2 = Math.sin(theta) ** 2;
    if (s2 === 0) return 0;
    for (let i = 1; i <= m; i += 1) logScale += 0.5 * Math.log((2 * i - 1) / (2 * i));
    logScale += 0.5 * m * Math.log(s2);
  }
  let older = m % 2 === 1 ? -1 : 1;
  let current = older;
  if (l > m) {
    let oldFactor = Math.sqrt(2 * m + 3);
    current = x * oldFactor * older;
    for (let k = m + 2; k <= l; k += 1) {
      const factor = Math.sqrt((4 * k * k - 1) / (k * k - m * m));
      const next = (x * current - older / oldFactor) * factor;
      older = current;
      current = next;
      oldFactor = factor;
      if (Math.abs(current) > 1e250) {
        current *= 1e-250;
        older *= 1e-250;
        logScale += 250 * Math.LN10;
      }
    }
  }
  // Two factors of exp(logScale / 2) keep the product finite when exp(logScale) alone is not.
  const half = Math.exp(logScale / 2);
  return current * half * half;
}

/**
 * Spherical harmonic `Y_l^m(θ, φ)` with the Condon–Shortley phase.
 * `θ` is the polar angle and `φ` the azimuth. Returns zero when `|m| > l`.
 *
 * For `l + |m| ≤ 170` the value comes from the associated Legendre function and the
 * factorial normalisation. Above that the factorials overflow, so the normalised recurrence
 * of `normalizedLegendre` computes the value; the cost is `l` steps, so `l` above
 * `MAX_FERRERS_ORDER` throws a RangeError.
 *
 * @throws RangeError if `l` is not a non-negative integer, `m` is not an integer, or
 *   `l + |m| > 170` and `l` is above `MAX_FERRERS_ORDER`
 *
 * @example
 * sphericalHarmonic(0, 0, 0.3, 1.2) // re 0.28209479177387814, im 0
 * sphericalHarmonic(200, 0, 1, 1) // re 0.07676429162435205, im 0
 */
export function sphericalHarmonic(l: number, m: number, theta: number, phi: number): Complex {
  if (!Number.isInteger(l) || l < 0 || !Number.isInteger(m)) {
    throw new RangeError('sphericalHarmonic: l must be a non-negative integer and m an integer');
  }
  const mAbs = Math.abs(m);
  if (mAbs > l) return new Complex(0, 0);
  let amplitude: number;
  if (l + mAbs <= YLM_FACTORIAL_MAX) {
    // ferrersP already carries the (−1)^m Condon–Shortley factor.
    const p = ferrersP(l, mAbs, Math.cos(theta));
    amplitude = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - mAbs) / fact(l + mAbs))) * p;
  } else {
    assertLoopOrder('sphericalHarmonic', 'l', l, MAX_FERRERS_ORDER);
    amplitude = normalizedLegendre(l, mAbs, theta);
  }
  const re = amplitude * Math.cos(mAbs * phi);
  const im = amplitude * Math.sin(mAbs * phi);
  if (m >= 0) return new Complex(re, im);
  // Y_l^{-m} = (−1)^m · conj(Y_l^m)
  const s = phase(mAbs);
  return new Complex(s * re, -s * im);
}
