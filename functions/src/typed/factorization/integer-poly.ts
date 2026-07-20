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
