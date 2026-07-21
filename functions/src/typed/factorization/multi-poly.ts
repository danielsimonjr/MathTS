/**
 * Sparse multivariate polynomial arithmetic over ℤ, backed by a
 * `Map<string, bigint>` keyed by an encoded exponent vector.
 *
 * Convention: a `MultiPoly` fixes an ordered variable list `vars`; every
 * exponent vector has `vars.length` entries, one per variable in that order.
 * `terms` maps `key(exponents)` to the (always nonzero) coefficient — zero
 * coefficients are pruned on every construction/operation, so the zero
 * polynomial is represented by an empty map.
 *
 * This module is part of the multivariate factorization engine
 * (`functions/src/typed/factorization/`, Layer 2) and is `bigint`-only by
 * design, matching the univariate engine in `integer-poly.ts`.
 */

import { bigintGcd } from './integer-poly.js';
import { polyFromExpression, type Poly } from '../polynomial-ideal.js';

/** Sparse multivariate polynomial over ℤ. */
export interface MultiPoly {
  /** Ordered variable names; every exponent vector has this length. */
  vars: string[];
  /** Exponent-vector key -> nonzero coefficient. */
  terms: Map<string, bigint>;
}

/** Encodes an exponent vector as a stable map key (comma-joined). */
export function key(exps: number[]): string {
  return exps.join(',');
}

/** Decodes a `key()`-encoded exponent vector back into numbers. */
export function unkey(k: string): number[] {
  if (k === '') {
    return [];
  }
  return k.split(',').map((s) => Number(s));
}

/** The zero polynomial over `vars`. */
export function zeroPoly(vars: string[]): MultiPoly {
  return { vars: vars.slice(), terms: new Map() };
}

/** The constant polynomial `c` over `vars` (zero exponents throughout). */
export function constPoly(vars: string[], c: bigint): MultiPoly {
  const terms = new Map<string, bigint>();
  if (c !== 0n) {
    terms.set(key(new Array<number>(vars.length).fill(0)), c);
  }
  return { vars: vars.slice(), terms };
}

/**
 * Builds a `MultiPoly` over `vars` from `(exponents, coefficient)` entries.
 * Entries sharing an exponent vector are summed; zero coefficients (after
 * summing) are pruned.
 */
export function fromTerms(vars: string[], entries: Array<[number[], bigint]>): MultiPoly {
  const terms = new Map<string, bigint>();
  for (const [exps, coeff] of entries) {
    if (exps.length !== vars.length) {
      throw new RangeError('fromTerms: exponent vector length must match vars.length');
    }
    const k = key(exps);
    const prev = terms.get(k) ?? 0n;
    const next = prev + coeff;
    if (next === 0n) {
      terms.delete(k);
    } else {
      terms.set(k, next);
    }
  }
  return { vars: vars.slice(), terms };
}

/** The degree of `p` in the variable at `varIndex` (max exponent across terms; -1 if zero). */
export function degreeIn(p: MultiPoly, varIndex: number): number {
  let d = -1;
  for (const k of p.terms.keys()) {
    const exps = unkey(k);
    if (exps[varIndex] > d) {
      d = exps[varIndex];
    }
  }
  return d;
}

/** The total degree of `p` (max sum of exponents across terms; -1 if zero). */
export function totalDegree(p: MultiPoly): number {
  let d = -1;
  for (const k of p.terms.keys()) {
    const exps = unkey(k);
    const s = exps.reduce((a, b) => a + b, 0);
    if (s > d) {
      d = s;
    }
  }
  return d;
}

/** True iff `p` has no nonzero terms. */
export function isZero(p: MultiPoly): boolean {
  return p.terms.size === 0;
}

/** Structural equality: same `vars` (in order) and the same term map. */
export function equals(a: MultiPoly, b: MultiPoly): boolean {
  if (a.vars.length !== b.vars.length) return false;
  for (let i = 0; i < a.vars.length; i += 1) {
    if (a.vars[i] !== b.vars[i]) return false;
  }
  if (a.terms.size !== b.terms.size) return false;
  for (const [k, v] of a.terms) {
    if (b.terms.get(k) !== v) return false;
  }
  return true;
}

/** `a + b` (both over the same `vars`). */
export function addMP(a: MultiPoly, b: MultiPoly): MultiPoly {
  const terms = new Map<string, bigint>(a.terms);
  for (const [k, v] of b.terms) {
    const next = (terms.get(k) ?? 0n) + v;
    if (next === 0n) {
      terms.delete(k);
    } else {
      terms.set(k, next);
    }
  }
  return { vars: a.vars.slice(), terms };
}

/** `a - b` (both over the same `vars`). */
export function subMP(a: MultiPoly, b: MultiPoly): MultiPoly {
  return addMP(a, negMP(b));
}

/** `a * b` (both over the same `vars`), via distributed convolution. */
export function mulMP(a: MultiPoly, b: MultiPoly): MultiPoly {
  const n = a.vars.length;
  const terms = new Map<string, bigint>();
  for (const [ka, ca] of a.terms) {
    const ea = unkey(ka);
    for (const [kb, cb] of b.terms) {
      const eb = unkey(kb);
      const exps = new Array<number>(n);
      for (let i = 0; i < n; i += 1) {
        exps[i] = ea[i] + eb[i];
      }
      const k = key(exps);
      const next = (terms.get(k) ?? 0n) + ca * cb;
      if (next === 0n) {
        terms.delete(k);
      } else {
        terms.set(k, next);
      }
    }
  }
  return { vars: a.vars.slice(), terms };
}

/** `p * k` for a scalar `k: bigint`. */
export function scalarMulMP(p: MultiPoly, k: bigint): MultiPoly {
  const terms = new Map<string, bigint>();
  if (k !== 0n) {
    for (const [tk, tv] of p.terms) {
      terms.set(tk, tv * k);
    }
  }
  return { vars: p.vars.slice(), terms };
}

/** `-p`. */
export function negMP(p: MultiPoly): MultiPoly {
  const terms = new Map<string, bigint>();
  for (const [k, v] of p.terms) {
    terms.set(k, -v);
  }
  return { vars: p.vars.slice(), terms };
}

/**
 * Total monomial order used for canonicalizing multivariate polynomials:
 * degree-lex — higher total degree first, then lexicographic comparison of
 * the exponent vector (earlier variables weighted higher). Returns a
 * negative number if `expsA` sorts before `expsB` (i.e. `expsA` is the
 * "larger"/leading monomial), positive if after, 0 if equal.
 */
export function canonicalCompare(expsA: number[], expsB: number[]): number {
  const da = expsA.reduce((a, b) => a + b, 0);
  const db = expsB.reduce((a, b) => a + b, 0);
  if (da !== db) {
    return db - da; // higher total degree sorts first (negative result)
  }
  for (let i = 0; i < expsA.length; i += 1) {
    if (expsA[i] !== expsB[i]) {
      return expsB[i] - expsA[i]; // larger exponent in an earlier variable sorts first
    }
  }
  return 0;
}

/**
 * The leading term of `p` under `canonicalCompare`: the term whose exponent
 * vector sorts first. Returns `null` for the zero polynomial.
 */
export function leadingTerm(p: MultiPoly): { exps: number[]; coeff: bigint } | null {
  let best: { exps: number[]; coeff: bigint } | null = null;
  for (const [k, v] of p.terms) {
    const exps = unkey(k);
    if (best === null || canonicalCompare(exps, best.exps) < 0) {
      best = { exps, coeff: v };
    }
  }
  return best;
}

/** Non-negative gcd of all coefficients of `p` (0 for the zero polynomial). */
export function integerContentMP(p: MultiPoly): bigint {
  let g = 0n;
  for (const v of p.terms.values()) {
    g = bigintGcd(g, v);
  }
  return g;
}

/**
 * Primitive part of `p`: divide out `integerContentMP(p)`, then flip sign
 * so the leading term (under `canonicalCompare`) has a positive
 * coefficient. The zero polynomial maps to itself.
 */
export function primitivePartMP(p: MultiPoly): MultiPoly {
  if (isZero(p)) {
    return { vars: p.vars.slice(), terms: new Map() };
  }
  const g = integerContentMP(p);
  const terms = new Map<string, bigint>();
  for (const [k, v] of p.terms) {
    terms.set(k, g === 0n ? v : v / g);
  }
  const divided: MultiPoly = { vars: p.vars.slice(), terms };
  const lead = leadingTerm(divided);
  if (lead !== null && lead.coeff < 0n) {
    return negMP(divided);
  }
  return divided;
}

/**
 * Multivariate polynomial long division: returns the quotient `a / b` iff
 * `b` divides `a` **exactly** over ℤ, else `null`.
 *
 * Repeatedly takes the `canonicalCompare`-leading term of the current
 * remainder and attempts to cancel it against `b`'s leading term: the
 * exponent vector must dominate `b`'s leading exponents component-wise, and
 * the coefficient must divide `b`'s leading coefficient exactly in ℤ (bigint
 * `%` gives an exact `0` remainder regardless of operand signs). Any failure
 * of either condition means the division is not exact — this function is the
 * recombination correctness arbiter and must never round or approximate.
 */
export function multiExactDivide(a: MultiPoly, b: MultiPoly): MultiPoly | null {
  const bLead = leadingTerm(b);
  if (bLead === null) {
    // Division by the zero polynomial is undefined.
    return null;
  }
  const n = a.vars.length;
  let remainder = a;
  const quotientEntries: Array<[number[], bigint]> = [];
  while (!isZero(remainder)) {
    const rLead = leadingTerm(remainder);
    if (rLead === null) {
      break;
    }
    const qExps = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const diff = rLead.exps[i] - bLead.exps[i];
      if (diff < 0) {
        return null;
      }
      qExps[i] = diff;
    }
    if (rLead.coeff % bLead.coeff !== 0n) {
      return null;
    }
    const qCoeff = rLead.coeff / bLead.coeff;
    quotientEntries.push([qExps, qCoeff]);
    const qTerm = fromTerms(a.vars, [[qExps, qCoeff]]);
    remainder = subMP(remainder, mulMP(qTerm, b));
  }
  return fromTerms(a.vars, quotientEntries);
}

/**
 * Parses `expr` over `vars` via algebra's exact `polyFromExpression`, then
 * lifts it to a bigint-backed {@link MultiPoly} — but only if EVERY
 * coefficient is an exact integer. Returns `null` on any non-integer
 * coefficient or if parsing throws (unknown symbol, non-integer exponent,
 * non-constant divisor, etc.).
 */
export function fromAlgebraExpr(expr: string, vars: string[]): MultiPoly | null {
  try {
    const parsed: Poly = polyFromExpression(expr, vars);
    const entries: Array<[number[], bigint]> = [];
    for (const term of parsed) {
      // Integer-literal boundary inherited from polyFromExpression's float-based
      // parser: integer coefficients within 2^53 are exact; astronomically large
      // literals are outside this parser's supported domain.
      if (!Number.isInteger(term.coeff)) {
        return null;
      }
      entries.push([term.powers, BigInt(term.coeff)]);
    }
    return fromTerms(vars, entries);
  } catch {
    // Any parse/build failure (unknown symbol, non-integer exponent, non-constant
    // divisor, or a fromTerms exponent-length mismatch) declines rather than throws.
    return null;
  }
}

/**
 * Renders `p` back to an expression string in the SAME format as
 * `polynomial-ideal.polyToString` (term order, `*`/`^` spacing, `+ -`
 * collapsing, `1*x` unit-coefficient style) — but rendered directly from
 * `bigint` coefficients so values above 2^53 stay exact. Routing through
 * `polyToString` would require `Number(v)`, which silently rounds.
 */
export function toAlgebraString(p: MultiPoly): string {
  if (p.terms.size === 0) return '0';
  const fmt = (c: bigint): string => c.toString();
  const terms = [...p.terms]
    .map(([k, v]) => ({ exps: unkey(k), coeff: v }))
    .reverse()
    .map(({ exps, coeff }) => {
      const varPart = exps
        .map((e, i) => (e === 0 ? '' : e === 1 ? p.vars[i] : `${p.vars[i]}^${e}`))
        .filter(Boolean)
        .join('*');
      return varPart ? `${fmt(coeff)}*${varPart}` : fmt(coeff);
    });
  return terms.join(' + ').replace(/\+ -/g, '- ');
}
