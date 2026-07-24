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

/** The monomial `x` as an `IntPoly` (`[0, 1]`). */
const X_POLY: IntPoly = [0n, 1n];

/**
 * Distinct-degree factorization of a monic, square-free polynomial `f` over
 * 𝔽_p. Returns the distinct-degree decomposition: each entry's `prod` is the
 * product of ALL monic irreducible factors of `f` that have degree exactly
 * `deg`. Uses the standard algorithm built on `x^(p^i) mod f` computed via
 * `powModPolyP`, peeling off `gcd(v, x^(p^i) - x)` at each step and shrinking
 * the working polynomial `v` as factors are removed.
 *
 * Precondition: `f` is monic and square-free over 𝔽_p. The empty array is
 * returned for a constant (degree ≤ 0) input.
 */
export function distinctDegreeFactor(f: IntPoly, p: bigint): Array<{ deg: number; prod: IntPoly }> {
  const result: Array<{ deg: number; prod: IntPoly }> = [];
  let v = makeMonicP(f, p);
  if (degree(v) <= 0) {
    return result;
  }
  // w tracks x^(p^i) mod v; start at x^(p^0) = x reduced mod v.
  let w = divmodP(X_POLY, v, p).r;
  let i = 1;
  while (degree(v) >= 2 * i) {
    // Raise to the p-th power: w becomes x^(p^i) mod v.
    w = powModPolyP(w, p, v, p);
    const g = gcdP(v, subP(w, X_POLY, p), p);
    if (degree(g) > 0) {
      result.push({ deg: i, prod: g });
      v = divmodP(v, g, p).q;
      w = divmodP(w, v, p).r;
    }
    i += 1;
  }
  // Whatever remains is a single irreducible factor of degree deg(v).
  if (degree(v) > 0) {
    result.push({ deg: degree(v), prod: v });
  }
  return result;
}

/**
 * Deterministic sequence of trial (candidate) polynomials for Cantor–Zassenhaus
 * splitting: monic polynomials enumerated by increasing degree, with the lower
 * coefficients ranging over 𝔽_p in a fixed base-`p` order — `x, x+1, …, x+(p-1)`,
 * then `x^2, x^2+1, …`, and so on. Deterministic (no `Math.random`), so results
 * are reproducible, and exhaustive over all monic polynomials, so a nontrivial
 * splitter is always eventually produced for a reducible input.
 */
function* trialPolys(p: bigint): Generator<IntPoly> {
  let deg = 1;
  while (true) {
    const count = p ** BigInt(deg);
    for (let k = 0n; k < count; k += 1n) {
      const poly: bigint[] = new Array<bigint>(deg + 1);
      let kk = k;
      for (let idx = 0; idx < deg; idx += 1) {
        poly[idx] = kk % p;
        kk /= p;
      }
      poly[deg] = 1n;
      yield trim(poly);
    }
    deg += 1;
  }
}

/**
 * Splits a monic, square-free product `f` of degree-`d` irreducibles into a
 * single nontrivial factor pair, recursing until every factor is a single
 * degree-`d` irreducible. Results are pushed onto `out` (each monic). Uses the
 * deterministic trial sequence from `trialPolys` — for odd `p` the classic
 * `gcd(f, T^((p^d-1)/2) - 1)` split, and for `p = 2` the Berlekamp trace-map
 * variant `gcd(f, T + T^2 + T^4 + … + T^(2^(d-1)))`.
 */
function edSplit(f: IntPoly, d: number, p: bigint, out: IntPoly[]): void {
  if (degree(f) === d) {
    out.push(f);
    return;
  }
  const trials = trialPolys(p);
  while (true) {
    const next = trials.next();
    // The generator is infinite, so `done` is never true; guard for the type.
    if (next.done) {
      return;
    }
    const t = next.value;
    let g: IntPoly;
    if (p === 2n) {
      // Trace map: sum_{i=0}^{d-1} T^(2^i) mod f, mod 2.
      let trace: IntPoly = [];
      let cur = divmodP(t, f, p).r;
      for (let i = 0; i < d; i += 1) {
        trace = addP(trace, cur, p);
        cur = divmodP(mulP(cur, cur, p), f, p).r;
      }
      g = gcdP(f, trace, p);
    } else {
      const e = (p ** BigInt(d) - 1n) / 2n;
      const h = powModPolyP(t, e, f, p);
      g = gcdP(f, subP(h, [1n], p), p);
    }
    const dg = degree(g);
    if (dg > 0 && dg < degree(f)) {
      edSplit(g, d, p, out);
      edSplit(divmodP(f, g, p).q, d, p, out);
      return;
    }
  }
}

/**
 * Equal-degree factorization (Cantor–Zassenhaus): given a monic, square-free
 * `f` that is a product of degree-`d` irreducibles over 𝔽_p, returns those
 * monic irreducible factors. The candidate polynomials are enumerated
 * deterministically (see `trialPolys`), so the factorization is reproducible.
 */
export function equalDegreeFactor(f: IntPoly, d: number, p: bigint): IntPoly[] {
  const out: IntPoly[] = [];
  edSplit(makeMonicP(f, p), d, p, out);
  return out;
}

/**
 * Full factorization of a square-free monic polynomial `f` over 𝔽_p into its
 * monic irreducible factors: distinct-degree decomposition followed by
 * Cantor–Zassenhaus equal-degree splitting of each degree class. Constant
 * (degree ≤ 0) inputs yield the empty array; a linear input yields itself.
 */
export function factorModP(f: IntPoly, p: bigint): IntPoly[] {
  const fm = makeMonicP(f, p);
  const d = degree(fm);
  if (d <= 0) {
    return [];
  }
  if (d === 1) {
    return [fm];
  }
  const factors: IntPoly[] = [];
  for (const { deg, prod } of distinctDegreeFactor(fm, p)) {
    if (degree(prod) === deg) {
      factors.push(prod);
    } else {
      for (const g of equalDegreeFactor(prod, deg, p)) {
        factors.push(g);
      }
    }
  }
  return factors;
}
