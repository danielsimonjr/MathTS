/**
 * Roots of a polynomial of degree 1 to 3 in closed form, and the rule that snaps a computed root
 * to an integer.
 *
 * Every tolerance here is relative: it compares a quantity with the size of the terms that made
 * it. An absolute tolerance reads the root `1e-10` of `x - 1e-10` as `0`, and reads the
 * polynomial `x^2 - 1e20` as a constant.
 *
 * The functions take the dense coefficients, lowest degree first, as `polynomialCoefficients`
 * returns them: finite, with a non-zero leading coefficient.
 */

import { Complex } from '@danielsimonjr/mathts-core';
import { polynomialRoot } from '../factories/index.js';

/** A root that is a real number, or a `Complex`. */
export type ClosedFormRoot = number | Complex;

/** The relative size below which the value of a polynomial at a number is rounding noise. */
const EVALUATION_NOISE = 64 * Number.EPSILON;

/** A discriminant that is no larger than this fraction of its two terms is zero. */
const DISCRIMINANT_NOISE = 16 * Number.EPSILON;

/** An imaginary part below this fraction of the size of a root (of about 1) is rounding noise. */
const IMAGINARY_NOISE = 1e-12;

/** The value, the slope and the noise scale of a polynomial at the point `zr + zi*i`. */
interface Evaluation {
  valueRe: number;
  valueIm: number;
  slopeRe: number;
  slopeIm: number;
  /** `sum |c_i| |z|^i`: the size of the terms that made the value. */
  scale: number;
}

function evaluateAt(dense: readonly number[], zr: number, zi: number): Evaluation {
  const modulus = Math.hypot(zr, zi);
  let valueRe = 0;
  let valueIm = 0;
  let slopeRe = 0;
  let slopeIm = 0;
  let scale = 0;
  for (let i = dense.length - 1; i >= 0; i--) {
    const nextSlopeRe = slopeRe * zr - slopeIm * zi + valueRe;
    const nextSlopeIm = slopeRe * zi + slopeIm * zr + valueIm;
    slopeRe = nextSlopeRe;
    slopeIm = nextSlopeIm;
    const nextValueRe = valueRe * zr - valueIm * zi + dense[i];
    const nextValueIm = valueRe * zi + valueIm * zr;
    valueRe = nextValueRe;
    valueIm = nextValueIm;
    scale = scale * modulus + Math.abs(dense[i]);
  }
  return { valueRe, valueIm, slopeRe, slopeIm, scale };
}

/** True when the integer `n` is an exact zero of a polynomial with safe-integer coefficients. */
function integerIsExactZero(dense: readonly number[], n: number): boolean {
  const point = BigInt(n);
  let value = 0n;
  for (let i = dense.length - 1; i >= 0; i--) value = value * point + BigInt(dense[i]);
  return value === 0n;
}

/**
 * True when the polynomial vanishes at `zr + zi*i`: exactly, for an integer point of a polynomial
 * with integer coefficients; else to within the rounding noise of the evaluation.
 */
function vanishesAt(dense: readonly number[], zr: number, zi: number): boolean {
  if (zi === 0 && Number.isSafeInteger(zr) && dense.every(Number.isSafeInteger)) {
    return integerIsExactZero(dense, zr);
  }
  const e = evaluateAt(dense, zr, zi);
  return Math.hypot(e.valueRe, e.valueIm) <= EVALUATION_NOISE * e.scale;
}

/**
 * True when `candidate` is the root that `root` approximates, and not another root close to it.
 * A Newton step from `root` has the size of the error of `root`; the distance to `candidate` may
 * not be much larger than that step. So `1e-10` is not the root `0` of `x*(x - 1e-10)`, and
 * `1.0000000000000002` is the root `1` of `x - 1`.
 */
function isTheSameRoot(
  dense: readonly number[],
  root: readonly [number, number],
  candidate: readonly [number, number]
): boolean {
  const e = evaluateAt(dense, root[0], root[1]);
  const slope = Math.hypot(e.slopeRe, e.slopeIm);
  const distance = Math.hypot(root[0] - candidate[0], root[1] - candidate[1]);
  const floor = 8 * Number.EPSILON * Math.max(1, Math.hypot(candidate[0], candidate[1]));
  if (slope === 0) return distance <= floor || distance <= 1e-6 * Math.max(1, Math.hypot(...root));
  const step = Math.hypot(e.valueRe, e.valueIm) / slope;
  return distance <= 8 * step + floor;
}

/**
 * Snap a real root to the nearest integer, only when that integer is a root of the polynomial and
 * the computed root is its approximation. A numeric method returns `1.0000000000000002` for the
 * root `1`; the integer is the value a person expects. A root that is near an integer but is not
 * one (`1.000000001` for `x - 1.000000001`, `1e-10` for `x - 1e-10`) keeps its value. Turns `-0`
 * into `0`.
 */
export function snapRoot(dense: readonly number[], root: number): number {
  const n = Math.round(root);
  if (n !== root && vanishesAt(dense, n, 0) && isTheSameRoot(dense, [root, 0], [n, 0])) {
    return n + 0;
  }
  return root + 0;
}

/** {@link snapRoot} for a complex root: each part may snap to an integer, under the same rule. */
function snapComplexRoot(dense: readonly number[], re: number, im: number): [number, number] {
  const candidates: Array<[number, number]> = [
    [Math.round(re), Math.round(im)],
    [Math.round(re), im],
    [re, Math.round(im)],
  ];
  for (const candidate of candidates) {
    if (candidate[0] === re && candidate[1] === im) continue;
    if (
      vanishesAt(dense, candidate[0], candidate[1]) &&
      isTheSameRoot(dense, [re, im], candidate)
    ) {
      return [candidate[0] + 0, candidate[1] + 0];
    }
  }
  return [re + 0, im + 0];
}

/** The power of two nearest to `x`, with its exponent kept in a safe range. */
function powerOfTwoNear(x: number): number {
  const exponent = Math.round(Math.log2(x));
  return 2 ** Math.max(-900, Math.min(900, exponent));
}

/** A complex number from a root, or a real one when its imaginary part is zero. */
function asRoot(dense: readonly number[], re: number, im: number): ClosedFormRoot {
  if (im === 0) return snapRoot(dense, re);
  const [snappedRe, snappedIm] = snapComplexRoot(dense, re, im);
  return new Complex(snappedRe, snappedIm);
}

/** The roots of `c0 + c1*x + c2*x^2`: two distinct, one double, or a conjugate pair. */
function quadraticRoots(dense: readonly number[]): ClosedFormRoot[] {
  const unit = powerOfTwoNear(Math.max(Math.abs(dense[0]), Math.abs(dense[1]), Math.abs(dense[2])));
  const [c, b, a] = dense.map((v) => v / unit);
  if (c === 0) {
    const other = -b / a;
    const roots = other === 0 ? [0] : [0, other].sort((p, q) => p - q);
    return roots.map((r) => snapRoot(dense, r));
  }
  if (b === 0) {
    // x^2 = -c/a: the roots are symmetric, so write them from one square root.
    const ratio = -c / a;
    if (ratio > 0) {
      const r = Math.sqrt(ratio);
      return [snapRoot(dense, -r), snapRoot(dense, r)];
    }
    const im = Math.sqrt(-ratio);
    return [asRoot(dense, 0, im), asRoot(dense, 0, -im)];
  }
  const fourAC = 4 * a * c;
  const discriminant = b * b - fourAC;
  if (Math.abs(discriminant) <= DISCRIMINANT_NOISE * (b * b + Math.abs(fourAC))) {
    return [asRoot(dense, -b / (2 * a), 0)];
  }
  if (discriminant > 0) {
    // Avoid the cancellation of -b + sqrt(d) when b*b is much larger than 4*a*c: the larger root
    // is q/a, and the other follows from the product of the roots, c/a.
    const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant)) / 2;
    const roots = [q / a, c / q].sort((p, r) => p - r);
    return roots.map((r) => snapRoot(dense, r));
  }
  const re = -b / (2 * a);
  const im = Math.sqrt(-discriminant) / (2 * a);
  return [asRoot(dense, re, im), asRoot(dense, re, -im)];
}

/** True when two roots hold the same value. */
function sameRoot(x: ClosedFormRoot, y: ClosedFormRoot): boolean {
  const [xr, xi] = typeof x === 'number' ? [x, 0] : [x.re, x.im];
  const [yr, yi] = typeof y === 'number' ? [y, 0] : [y.re, y.im];
  return xr === yr && xi === yi;
}

/**
 * Real roots in ascending order, then the complex roots: by real part ascending, and for a
 * conjugate pair the root with the positive imaginary part first.
 */
function orderRoots(roots: ClosedFormRoot[]): ClosedFormRoot[] {
  const distinct: ClosedFormRoot[] = [];
  for (const r of roots) if (!distinct.some((d) => sameRoot(d, r))) distinct.push(r);
  const reals = distinct.filter((r): r is number => typeof r === 'number').sort((p, q) => p - q);
  const complex = distinct
    .filter((r): r is Complex => typeof r !== 'number')
    .sort((p, q) => p.re - q.re || q.im - p.im);
  return [...reals, ...complex];
}

/** The roots of a cubic. The variable is scaled so that its roots are about 1 before the solve. */
function cubicRoots(dense: readonly number[]): ClosedFormRoot[] {
  const [d, c, b, a] = dense;
  if (d === 0) {
    return orderRoots([0, ...quadraticRoots([c, b, a])]);
  }
  // `polynomialRoot` tests its coefficients against fixed absolute tolerances, so give it
  // a polynomial whose roots and coefficients are about 1. The scale factors are powers of two,
  // so the scaling does not change a digit of a coefficient.
  const s = powerOfTwoNear(Math.cbrt(Math.abs(d / a)));
  const unit = powerOfTwoNear(Math.abs(d));
  const scaled = [d / unit, (c * s) / unit, (b * s * s) / unit, (a * s * s * s) / unit];
  if (!scaled.every(Number.isFinite)) {
    throw new RangeError('solve: the coefficients of the cubic differ too much in size');
  }
  const raw = (polynomialRoot as (...coefficients: number[]) => unknown[])(...scaled);
  const roots: ClosedFormRoot[] = raw.map((r) => {
    const [re, im] =
      typeof r === 'number' ? [r, 0] : [(r as { re: number }).re, (r as { im: number }).im];
    if (!Number.isFinite(re) || !Number.isFinite(im)) {
      throw new RangeError('solve: the closed form of the cubic is not finite');
    }
    const isReal = Math.abs(im) <= IMAGINARY_NOISE * Math.max(1, Math.hypot(re, im));
    return asRoot(dense, re * s, isReal ? 0 : im * s);
  });
  return orderRoots(roots);
}

/**
 * The roots of a polynomial of degree 1 to 3, in closed form: the real roots in ascending
 * order, then the complex roots. Each distinct root appears once.
 *
 * @param dense - The coefficients, lowest degree first; 2 to 4 finite numbers, the last one not zero.
 * @returns The roots. A real root is a number, a complex root is a `Complex`.
 * @throws RangeError when the coefficients differ so much in size that a cubic cannot be scaled.
 *
 * @example
 * closedFormRoots([-1e12, 0, 1]); // [-1000000, 1000000]
 * closedFormRoots([-1e-10, 1]); // [1e-10]
 */
export function closedFormRoots(dense: readonly number[]): ClosedFormRoot[] {
  switch (dense.length) {
    case 2: {
      const root = -dense[0] / dense[1];
      if (!Number.isFinite(root)) {
        throw new RangeError(
          'solve: the root of the linear polynomial is outside the range of a number'
        );
      }
      return [snapRoot(dense, root)];
    }
    case 3:
      return orderRoots(quadraticRoots(dense));
    case 4:
      return cubicRoots(dense);
    default:
      throw new RangeError(`closedFormRoots takes degree 1 to 3, not degree ${dense.length - 1}`);
  }
}
