/**
 * Angular-momentum coupling (Wigner 3j, Clebsch–Gordan, Wigner 6j) via the Racah
 * formulas, and spherical harmonics with the Condon–Shortley phase.
 *
 * All angular momenta may be integers or half-integers. Inputs that are not
 * multiples of ½ raise `RangeError`; selection-rule violations return 0.
 */

import { Complex } from '@danielsimonjr/mathts-core';
import { ferrersP } from './spheroidal.js';

function assertHalfInteger(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(2 * value)) {
    throw new RangeError(`${name}: angular momentum must be a multiple of 1/2`);
  }
}

/** n! for a non-negative integer n (exact in double precision up to 170!). */
function fact(n: number): number {
  const m = Math.round(n);
  if (m < 0) throw new RangeError('factorial of a negative integer');
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
 * Spherical harmonic `Y_l^m(θ, φ)` with the Condon–Shortley phase.
 * `θ` is the polar angle and `φ` the azimuth. Returns zero when `|m| > l`.
 *
 * @example
 * sphericalHarmonic(0, 0, 0.3, 1.2) // re 0.28209479177387814, im 0
 */
export function sphericalHarmonic(l: number, m: number, theta: number, phi: number): Complex {
  if (!Number.isInteger(l) || l < 0 || !Number.isInteger(m)) {
    throw new RangeError('sphericalHarmonic: l must be a non-negative integer and m an integer');
  }
  const mAbs = Math.abs(m);
  if (mAbs > l) return new Complex(0, 0);
  // ferrersP already carries the (−1)^m Condon–Shortley factor.
  const p = ferrersP(l, mAbs, Math.cos(theta));
  const norm = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - mAbs) / fact(l + mAbs)));
  const re = norm * p * Math.cos(mAbs * phi);
  const im = norm * p * Math.sin(mAbs * phi);
  if (m >= 0) return new Complex(re, im);
  // Y_l^{-m} = (−1)^m · conj(Y_l^m)
  const s = phase(mAbs);
  return new Complex(s * re, -s * im);
}
