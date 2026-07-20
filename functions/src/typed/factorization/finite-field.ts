/**
 * Dense univariate polynomial arithmetic over the finite field 𝔽_p, backed
 * by the same `bigint[]` representation as `integer-poly.ts` (index =
 * degree). Every coefficient produced by an operation in this module is
 * kept reduced into the canonical range `[0, p)` and trimmed so the
 * highest-degree entry (if any) is nonzero.
 *
 * This module is part of the univariate factorization engine
 * (`functions/src/typed/factorization/`) and is `bigint`-only by design.
 */

import { trim, degree, lc, isZero, type IntPoly } from './integer-poly.js';

export type { IntPoly } from './integer-poly.js';

/** Reduces a single bigint into the canonical range `[0, p)`. */
function modP(a: bigint, p: bigint): bigint {
  const r = a % p;
  return r < 0n ? r + p : r;
}

/**
 * Reduces every coefficient of `a` into `[0, p)`, then trims trailing
 * (highest-degree) zero coefficients. Does not mutate the input.
 */
export function reduceModP(a: IntPoly, p: bigint): IntPoly {
  return trim(a.map((c) => modP(c, p)));
}

/** `a + b` over 𝔽_p, coefficients reduced into `[0, p)`. */
export function addP(a: IntPoly, b: IntPoly, p: bigint): IntPoly {
  const n = Math.max(a.length, b.length);
  const out: bigint[] = new Array<bigint>(n);
  for (let i = 0; i < n; i += 1) {
    const av = i < a.length ? a[i] : 0n;
    const bv = i < b.length ? b[i] : 0n;
    out[i] = modP(av + bv, p);
  }
  return trim(out);
}

/** `a - b` over 𝔽_p, coefficients reduced into `[0, p)`. */
export function subP(a: IntPoly, b: IntPoly, p: bigint): IntPoly {
  const n = Math.max(a.length, b.length);
  const out: bigint[] = new Array<bigint>(n);
  for (let i = 0; i < n; i += 1) {
    const av = i < a.length ? a[i] : 0n;
    const bv = i < b.length ? b[i] : 0n;
    out[i] = modP(av - bv, p);
  }
  return trim(out);
}

/** `a * b` over 𝔽_p via schoolbook convolution, coefficients in `[0, p)`. */
export function mulP(a: IntPoly, b: IntPoly, p: bigint): IntPoly {
  const ta = trim(a);
  const tb = trim(b);
  if (ta.length === 0 || tb.length === 0) {
    return [];
  }
  const out: bigint[] = new Array<bigint>(ta.length + tb.length - 1).fill(0n);
  for (let i = 0; i < ta.length; i += 1) {
    const ai = ta[i];
    if (ai === 0n) continue;
    for (let j = 0; j < tb.length; j += 1) {
      out[i + j] = modP(out[i + j] + ai * tb[j], p);
    }
  }
  return trim(out);
}

/**
 * Modular inverse of a scalar `a` modulo prime `p`, via the extended
 * Euclidean algorithm. Returns a value in `[1, p)`. Throws if `a ≡ 0 (mod p)`
 * (no inverse exists).
 */
export function invModP(a: bigint, p: bigint): bigint {
  const ar = modP(a, p);
  if (ar === 0n) {
    throw new RangeError('invModP: 0 has no modular inverse');
  }
  // Extended Euclidean algorithm: find x such that ar*x + p*y = gcd(ar,p) = 1.
  let oldR = ar;
  let r = p;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  // oldR is gcd(a, p); for prime p and ar != 0 (mod p), gcd is 1.
  return modP(oldS, p);
}

/**
 * Scales `a` so its leading coefficient becomes 1 (multiplies by
 * `invModP(lc(a), p)`). Returns `[]` unchanged for the zero polynomial.
 */
export function makeMonicP(a: IntPoly, p: bigint): IntPoly {
  const t = reduceModP(a, p);
  if (isZero(t)) {
    return [];
  }
  const inv = invModP(lc(t), p);
  return trim(t.map((c) => modP(c * inv, p)));
}

/**
 * Polynomial division over 𝔽_p: `a = q*b + r` with `deg(r) < deg(b)`.
 * `b` must be nonzero. Coefficients of `q` and `r` are reduced into `[0, p)`.
 */
export function divmodP(a: IntPoly, b: IntPoly, p: bigint): { q: IntPoly; r: IntPoly } {
  const tb = reduceModP(b, p);
  if (isZero(tb)) {
    throw new RangeError('divmodP: division by the zero polynomial');
  }
  const db = degree(tb);
  const invLb = invModP(lc(tb), p);
  let rem = reduceModP(a, p);
  const dq = degree(rem) - db;
  const q: bigint[] = dq >= 0 ? new Array<bigint>(dq + 1).fill(0n) : [];
  while (!isZero(rem) && degree(rem) >= db) {
    const dr = degree(rem);
    const shift = dr - db;
    const coeff = modP(rem[dr] * invLb, p);
    q[shift] = coeff;
    for (let i = 0; i <= db; i += 1) {
      rem[shift + i] = modP(rem[shift + i] - coeff * tb[i], p);
    }
    rem = trim(rem);
  }
  return { q: trim(q), r: rem };
}

/**
 * Monic gcd of `a` and `b` over 𝔽_p via the Euclidean algorithm. Returns
 * `[]` (zero polynomial) only when both inputs are zero; otherwise the
 * result is monic (leading coefficient 1).
 */
export function gcdP(a: IntPoly, b: IntPoly, p: bigint): IntPoly {
  let x = reduceModP(a, p);
  let y = reduceModP(b, p);
  if (isZero(x)) {
    return makeMonicP(y, p);
  }
  if (isZero(y)) {
    return makeMonicP(x, p);
  }
  while (!isZero(y)) {
    const { r } = divmodP(x, y, p);
    x = y;
    y = r;
  }
  return makeMonicP(x, p);
}

/**
 * `base^e mod (mod, p)`: modular exponentiation of `base` by non-negative
 * bigint `e`, reducing modulo the polynomial `mod` (via `divmodP`) and
 * modulo `p` at each step, using square-and-multiply. `e` must be >= 0.
 */
export function powModPolyP(base: IntPoly, e: bigint, mod: IntPoly, p: bigint): IntPoly {
  if (e < 0n) {
    throw new RangeError('powModPolyP: negative exponent not supported');
  }
  let result: IntPoly = [1n];
  let b = divmodP(base, mod, p).r;
  let exp = e;
  while (exp > 0n) {
    if (exp & 1n) {
      result = divmodP(mulP(result, b, p), mod, p).r;
    }
    b = divmodP(mulP(b, b, p), mod, p).r;
    exp >>= 1n;
  }
  return reduceModP(result, p);
}
