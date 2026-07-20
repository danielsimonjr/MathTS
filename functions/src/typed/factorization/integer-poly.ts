/**
 * Dense univariate polynomial arithmetic over ℤ, backed by `bigint[]`.
 *
 * Convention: index = degree (coefficient of x^i lives at index i).
 * `[]` denotes the zero polynomial. After `trim`, the last entry (highest
 * degree) is guaranteed nonzero. `degree([])` is -1 by convention.
 *
 * This module is part of the univariate factorization engine
 * (`functions/src/typed/factorization/`) and is `bigint`-only by design:
 * float64 loses correctness once coefficients exceed 2^53 during Hensel
 * lifting to p^k.
 */

/** Dense polynomial over ℤ: index i holds the coefficient of x^i. */
export type IntPoly = bigint[];

/**
 * Removes trailing (highest-degree) zero coefficients so the last entry
 * (if any) is nonzero. Does not mutate the input.
 */
export function trim(p: IntPoly): IntPoly {
  let n = p.length;
  while (n > 0 && p[n - 1] === 0n) {
    n -= 1;
  }
  return p.slice(0, n);
}

/** Degree of `p`; the zero polynomial has degree -1 by convention. */
export function degree(p: IntPoly): number {
  const t = trim(p);
  return t.length - 1;
}

/** Leading coefficient of `p` (0n for the zero polynomial). */
export function lc(p: IntPoly): bigint {
  const t = trim(p);
  return t.length === 0 ? 0n : t[t.length - 1];
}

/** True iff `p` is the zero polynomial (ignoring trailing zero padding). */
export function isZero(p: IntPoly): boolean {
  return trim(p).length === 0;
}

/** `a + b`, trimmed. */
export function add(a: IntPoly, b: IntPoly): IntPoly {
  const n = Math.max(a.length, b.length);
  const out: bigint[] = new Array<bigint>(n);
  for (let i = 0; i < n; i += 1) {
    const av = i < a.length ? a[i] : 0n;
    const bv = i < b.length ? b[i] : 0n;
    out[i] = av + bv;
  }
  return trim(out);
}

/** `a - b`, trimmed. */
export function sub(a: IntPoly, b: IntPoly): IntPoly {
  const n = Math.max(a.length, b.length);
  const out: bigint[] = new Array<bigint>(n);
  for (let i = 0; i < n; i += 1) {
    const av = i < a.length ? a[i] : 0n;
    const bv = i < b.length ? b[i] : 0n;
    out[i] = av - bv;
  }
  return trim(out);
}

/** `-a`, trimmed. */
export function neg(a: IntPoly): IntPoly {
  return a.map((c) => -c);
}

/** `a * b` via the schoolbook convolution, trimmed. */
export function mul(a: IntPoly, b: IntPoly): IntPoly {
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
      out[i + j] += ai * tb[j];
    }
  }
  return trim(out);
}

/** `p * k` for a scalar `k: bigint`, trimmed. */
export function scalarMul(p: IntPoly, k: bigint): IntPoly {
  return trim(p.map((c) => c * k));
}

/** Structural equality after trimming (so trailing-zero padding is ignored). */
export function equals(a: IntPoly, b: IntPoly): boolean {
  const ta = trim(a);
  const tb = trim(b);
  if (ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i += 1) {
    if (ta[i] !== tb[i]) return false;
  }
  return true;
}

/** Evaluates `p(x)` at a bigint `x` via Horner's method. */
export function evaluate(p: IntPoly, x: bigint): bigint {
  const t = trim(p);
  let acc = 0n;
  for (let i = t.length - 1; i >= 0; i -= 1) {
    acc = acc * x + t[i];
  }
  return acc;
}

/** Non-negative gcd of two bigints (gcd(0,0) = 0). */
export function bigintGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Content of `p`: the non-negative gcd of its (trimmed) coefficients. */
export function content(p: IntPoly): bigint {
  const t = trim(p);
  let g = 0n;
  for (const c of t) {
    g = bigintGcd(g, c);
  }
  return g;
}

/**
 * Primitive part of `p`: divide out the content, then flip sign so the
 * leading coefficient is positive. The zero polynomial maps to itself.
 */
export function primitivePart(p: IntPoly): IntPoly {
  const t = trim(p);
  if (t.length === 0) {
    return [];
  }
  const g = content(t);
  const divided = g === 0n ? t.slice() : t.map((c) => c / g);
  const reduced = trim(divided);
  if (reduced.length === 0) {
    return reduced;
  }
  return lc(reduced) < 0n ? neg(reduced) : reduced;
}

/**
 * Exact polynomial quotient `a / b` over ℤ: performs schoolbook long division
 * and returns the quotient only if the remainder is exactly zero AND every
 * intermediate coefficient division was integral (no rounding). Returns
 * `null` whenever `b` does not divide `a` exactly over ℤ. This is the
 * recombination correctness test used by subset factor-recombination —
 * it must never silently round.
 */
export function exactDivide(a: IntPoly, b: IntPoly): IntPoly | null {
  const tb = trim(b);
  if (tb.length === 0) {
    return null; // division by zero polynomial
  }
  let rem = trim(a);
  if (rem.length === 0) {
    return [];
  }
  const db = tb.length - 1;
  const lb = tb[db];
  const dq = rem.length - 1 - db;
  if (dq < 0) {
    return null; // deg(a) < deg(b): only exact if a is zero, handled above
  }
  const q: bigint[] = new Array<bigint>(dq + 1).fill(0n);
  while (!isZero(rem) && degree(rem) >= db) {
    const dr = degree(rem);
    const lrRaw = rem[dr];
    if (lrRaw % lb !== 0n) {
      return null; // leading-coefficient division is not integral
    }
    const coeff = lrRaw / lb;
    const shift = dr - db;
    q[shift] = coeff;
    // rem -= coeff * x^shift * b
    for (let i = 0; i <= db; i += 1) {
      rem[shift + i] -= coeff * tb[i];
    }
    rem = trim(rem);
  }
  if (!isZero(rem)) {
    return null; // nonzero remainder
  }
  return trim(q);
}

/** Formal derivative `p'` over ℤ: coefficient i*p[i] at index i-1. */
export function derivative(p: IntPoly): IntPoly {
  const t = trim(p);
  if (t.length <= 1) {
    return [];
  }
  const out: bigint[] = new Array<bigint>(t.length - 1);
  for (let i = 1; i < t.length; i += 1) {
    out[i - 1] = t[i] * BigInt(i);
  }
  return trim(out);
}

/**
 * Pseudo-remainder of `a` by `b` over ℤ (both nonzero, deg(a) >= deg(b)):
 * returns `r` such that `lc(b)^(deg(a)-deg(b)+1) * a = q*b + r` with
 * `deg(r) < deg(b)`, staying entirely in ℤ (no rational arithmetic).
 */
function pseudoRemainder(a: IntPoly, b: IntPoly): IntPoly {
  const db = degree(b);
  const lb = lc(b);
  let rem = trim(a);
  while (!isZero(rem) && degree(rem) >= db) {
    const dr = degree(rem);
    const lr = rem[dr];
    const shift = dr - db;
    // rem = lb*rem - lr*x^shift*b
    const scaled: bigint[] = rem.map((c) => c * lb);
    for (let i = 0; i <= db; i += 1) {
      scaled[shift + i] -= lr * b[i];
    }
    rem = trim(scaled);
  }
  return rem;
}

/**
 * Gcd of two polynomials over ℤ via the Euclidean pseudo-remainder sequence
 * (stays in ℤ throughout via pseudo-division), returned as a primitive
 * polynomial with positive leading coefficient. `gcd(0, b) = primitivePart(b)`
 * and symmetrically for `gcd(a, 0)`; `gcd(0,0) = []`.
 */
export function polyGcdZ(a: IntPoly, b: IntPoly): IntPoly {
  let x = primitivePart(a);
  let y = primitivePart(b);
  if (isZero(x)) {
    return y;
  }
  if (isZero(y)) {
    return x;
  }
  if (degree(x) < degree(y)) {
    [x, y] = [y, x];
  }
  while (!isZero(y)) {
    const r = pseudoRemainder(x, y);
    x = y;
    y = primitivePart(r);
  }
  return x;
}

/** Integer square root of a non-negative bigint via Newton's method. */
function isqrt(n: bigint): bigint {
  if (n < 0n) {
    throw new RangeError('isqrt: negative input');
  }
  if (n < 2n) {
    return n;
  }
  let x0 = n;
  let x1 = (x0 + 1n) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) / 2n;
  }
  return x0;
}

/**
 * Landau–Mignotte coefficient bound: any integer factor of `p` has all
 * coefficients bounded in absolute value by this quantity. Uses the
 * generous form `ceil(sqrt(deg+1) * 2^deg * |lc(p)|)`, computed entirely
 * with bigint integer arithmetic (integer sqrt rounded UP so the bound
 * stays safe/over-estimating). Always positive.
 */
export function landauMignotte(p: IntPoly): bigint {
  const t = trim(p);
  const d = t.length - 1;
  if (d < 0) {
    return 1n; // zero polynomial: no factors to bound; return a safe positive value
  }
  const n = BigInt(d + 1);
  const lcAbs = t[d] < 0n ? -t[d] : t[d];
  const powerOfTwo = 1n << BigInt(d);
  // ceil(sqrt(n)): integer sqrt rounded up (isqrt already floors, so bump
  // by one unless n is a perfect square).
  const sq = isqrt(n);
  const sqrtCeil = sq * sq === n ? sq : sq + 1n;
  const bound = sqrtCeil * powerOfTwo * (lcAbs === 0n ? 1n : lcAbs);
  return bound > 0n ? bound : 1n;
}

/**
 * Reduces every coefficient of `p` into the symmetric residue range
 * `(-m/2, m/2]` modulo `m`. `m` must be a positive modulus. Coefficient
 * count is preserved (no trailing-zero trim) — a coefficient that reduces
 * to 0 mod `m` stays as an explicit 0 at its original index.
 */
export function modSymmetric(p: IntPoly, m: bigint): IntPoly {
  const half = m / 2n;
  return p.map((c) => {
    let r = c % m;
    if (r < 0n) {
      r += m;
    }
    // r is now in [0, m). Map into (-m/2, m/2].
    if (r > half) {
      r -= m;
    }
    return r;
  });
}
