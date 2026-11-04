/**
 * Real-root isolation and approximation for real polynomials: Sturm sequences,
 * Descartes' sign-change bound, Cauchy-bound bisection isolation and refinement.
 * Coefficients are ascending (`coeffs[i]` multiplies x^i), as in `polyval`.
 */
import { polyval } from '../typed/algebra.js';

/** Drop trailing (highest-degree) zero coefficients. */
function trim(p: readonly number[]): number[] {
  const out = [...p];
  while (out.length > 0 && out[out.length - 1] === 0) out.pop();
  return out;
}

function assertNonZero(coeffs: readonly number[]): number[] {
  const p = trim(coeffs);
  if (p.length === 0) throw new RangeError('the zero polynomial has no isolated roots');
  return p;
}

/** Derivative of an ascending coefficient list. */
function derivative(p: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < p.length; i++) out.push(i * p[i]);
  return out.length > 0 ? out : [0];
}

/** Remainder of a divided by b (ascending coefficients, floating point). */
function remainder(a: readonly number[], b: readonly number[]): number[] {
  const r = [...a];
  const db = b.length - 1;
  const lead = b[db];
  for (let i = r.length - 1; i >= db; i--) {
    const q = r[i] / lead;
    if (q !== 0) {
      for (let j = 0; j <= db; j++) r[i - db + j] -= q * b[j];
    }
    r[i] = 0;
  }
  return trim(r.slice(0, db));
}

/**
 * Sturm sequence of p: p0 = p, p1 = p', p_{i+1} = -rem(p_{i-1}, p_i). Its sign
 * changes at x count the distinct real roots of p below x.
 */
export function sturmSequence(coeffs: readonly number[]): number[][] {
  const p0 = assertNonZero(coeffs);
  const seq: number[][] = [p0];
  if (p0.length === 1) return seq;
  seq.push(derivative(p0));
  for (;;) {
    const prev = seq[seq.length - 2];
    const cur = seq[seq.length - 1];
    if (cur.length === 1) break;
    const r = remainder(prev, cur).map((x) => -x);
    if (r.length === 0) break;
    seq.push(r);
  }
  return seq;
}

function signChanges(values: readonly number[]): number {
  const nz = values.filter((v) => v !== 0);
  let changes = 0;
  for (let i = 1; i < nz.length; i++) {
    if (nz[i] * nz[i - 1] < 0) changes++;
  }
  return changes;
}

/**
 * Number of distinct real roots in the half-open interval (a, b], by Sturm's
 * theorem. Exact when neither endpoint is a root of the sequence.
 */
export function sturmRootCount(coeffs: readonly number[], a: number, b: number): number {
  if (!(a <= b)) throw new RangeError('sturmRootCount requires a <= b');
  const seq = sturmSequence(coeffs);
  const va = signChanges(seq.map((p) => polyval(p, a)));
  const vb = signChanges(seq.map((p) => polyval(p, b)));
  return va - vb;
}

/** Number of sign changes in the coefficient list: an upper bound on the positive real roots. */
export function descartesSignChanges(coeffs: readonly number[]): number {
  return signChanges(coeffs);
}

/**
 * Disjoint intervals (a, b] each containing exactly one real root of the
 * polynomial, found by bisection on Sturm counts inside the Cauchy bound.
 * `bound` overrides the Cauchy bound; `minWidth` stops bisection early.
 */
export function isolateRealRoots(
  coeffs: readonly number[],
  opts?: { bound?: number; minWidth?: number }
): Array<[number, number]> {
  const p = assertNonZero(coeffs);
  if (p.length === 1) return [];
  const lead = Math.abs(p[p.length - 1]);
  let cauchy = 0;
  for (let i = 0; i < p.length - 1; i++) cauchy = Math.max(cauchy, Math.abs(p[i]) / lead);
  const B = opts?.bound ?? 1 + cauchy;
  const minWidth = opts?.minWidth ?? 1e-14;
  const seq = sturmSequence(p);
  const count = (a: number, b: number): number =>
    signChanges(seq.map((q) => polyval(q, a))) - signChanges(seq.map((q) => polyval(q, b)));

  const out: Array<[number, number]> = [];
  const split = (a: number, b: number, n: number): void => {
    if (n === 0) return;
    if (n === 1 || b - a <= minWidth) {
      out.push([a, b]);
      return;
    }
    const m = (a + b) / 2;
    split(a, m, count(a, m));
    split(m, b, count(m, b));
  };
  split(-B, B, count(-B, B));
  return out;
}

/**
 * Real roots of the polynomial, sorted ascending, each distinct root once.
 * Isolates with `isolateRealRoots`, then refines each interval by bisection on
 * Sturm counts until its width is at most `tol`. Bisection on counts (rather
 * than sign changes) also handles even-multiplicity roots, where the sign does
 * not change.
 */
export function realRoots(coeffs: readonly number[], tol = 1e-10): number[] {
  const p = assertNonZero(coeffs);
  const seq = sturmSequence(p);
  const count = (a: number, b: number): number =>
    signChanges(seq.map((q) => polyval(q, a))) - signChanges(seq.map((q) => polyval(q, b)));
  return isolateRealRoots(p).map(([a0, b0]) => {
    let lo = a0;
    let hi = b0;
    while (hi - lo > tol) {
      const m = (lo + hi) / 2;
      if (count(lo, m) === 1) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  });
}
