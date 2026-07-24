/**
 * Kronecker substitution: reduces a multivariate integer polynomial to a
 * univariate one so it can be factored by the Layer 1 univariate engine
 * (`zassenhaus.ts`), then inverts the map to recover multivariate
 * candidates.
 *
 * The substitution maps `x_k ↦ x^{bases[k]}`, where `bases[0] = 1` and
 * `bases[k] = ∏_{i<k} (degreeIn(p, i) + 1)`. Every monomial
 * `∏_i x_i^{e_i}` then lands at the distinct univariate degree
 * `Σ_i e_i · bases[i]` — distinct because the bases form the place values of
 * a mixed-radix numeral system with radix `degreeIn(p, i) + 1` at position
 * `i`, so no two exponent vectors bounded by the original per-variable
 * degrees can collide. This is what makes the map invertible via
 * {@link backSubstitute}.
 *
 * `bigint`-only per the Layer 2 factorization engine's constraints; the
 * univariate degree used as an array index is a `Number`, guarded against
 * exceeding `Number.MAX_SAFE_INTEGER` before conversion.
 */

import { degreeIn, fromTerms, unkey, type MultiPoly } from './multi-poly.js';
import { trim, type IntPoly } from './integer-poly.js';

/**
 * One substitution base per variable of `p`: `bases[0] = 1`,
 * `bases[k] = ∏_{i<k} (degreeIn(p, i) + 1)`.
 */
export function substitutionBases(p: MultiPoly): bigint[] {
  const n = p.vars.length;
  const bases: bigint[] = new Array<bigint>(n);
  let prod = 1n;
  for (let k = 0; k < n; k += 1) {
    bases[k] = prod;
    const d = degreeIn(p, k);
    const radix = d < 0 ? 1n : BigInt(d) + 1n;
    prod *= radix;
  }
  return bases;
}

/**
 * The univariate degree that the substitution `x_k ↦ x^{bases[k]}` sends
 * `p`'s highest-degree corner monomial to: `Σ_i degreeIn(p, i) · bases[i]`.
 * Callers use this (as a `bigint`) to enforce a degree cap BEFORE calling
 * {@link substitute}, which throws if this bound exceeds
 * `Number.MAX_SAFE_INTEGER`.
 */
export function substitutedDegree(p: MultiPoly, bases: bigint[]): bigint {
  let total = 0n;
  for (let i = 0; i < bases.length; i += 1) {
    const d = degreeIn(p, i);
    const dd = d < 0 ? 0n : BigInt(d);
    total += dd * bases[i];
  }
  return total;
}

/**
 * Applies the Kronecker substitution `x_k ↦ x^{bases[k]}` to `p`, producing
 * the univariate image as a dense `IntPoly`. Each term's coefficient is
 * placed at univariate degree `Σ_i e_i · bases[i]` (summed with any other
 * term landing at the same degree, though the mixed-radix construction of
 * `bases` guarantees that never happens for exponents within `p`'s own
 * degrees).
 *
 * Throws `RangeError` if the maximum possible substituted degree exceeds
 * `Number.MAX_SAFE_INTEGER` (the array index cannot represent it exactly).
 * Callers should apply the `KRONECKER_MAX_DEGREE` cap via
 * {@link substitutedDegree} before calling this, so this throw is a defensive
 * backstop, not the primary cap enforcement.
 */
export function substitute(p: MultiPoly, bases: bigint[]): IntPoly {
  const maxDeg = substitutedDegree(p, bases);
  if (maxDeg > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `substitute: substituted degree ${maxDeg.toString()} exceeds Number.MAX_SAFE_INTEGER`
    );
  }
  const len = Number(maxDeg) + 1;
  const out: bigint[] = new Array<bigint>(len).fill(0n);
  for (const [k, coeff] of p.terms) {
    const exps = unkey(k);
    let deg = 0n;
    for (let i = 0; i < exps.length; i += 1) {
      deg += BigInt(exps[i]) * bases[i];
    }
    const idx = Number(deg);
    out[idx] += coeff;
  }
  return trim(out);
}

/**
 * Inverts {@link substitute}: recovers the `MultiPoly` whose Kronecker image
 * is `u`, given the same `bases` and the ORIGINAL polynomial's per-variable
 * degree bounds `degBounds`.
 *
 * Each nonzero univariate coefficient at degree `e` is decomposed by
 * mixed-radix division — radix `degBounds[i] + 1` at position `i` — into an
 * exponent vector. If `e` doesn't fit within the mixed-radix system sized by
 * `degBounds` (a nonzero remainder after the top digit), the decomposition is
 * an out-of-range carry: `e` cannot correspond to a genuine exponent vector
 * bounded by `degBounds`, so this returns `null` rather than a bogus
 * `MultiPoly`. This is the guard that rejects spurious univariate factors
 * during Kronecker recombination.
 */
export function backSubstitute(
  u: IntPoly,
  bases: bigint[],
  degBounds: number[],
  vars: string[]
): MultiPoly | null {
  const n = bases.length;
  const trimmed = trim(u);
  const entries: Array<[number[], bigint]> = [];
  for (let e = 0; e < trimmed.length; e += 1) {
    const coeff = trimmed[e];
    if (coeff === 0n) {
      continue;
    }
    let remaining = BigInt(e);
    const exps = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const radix = BigInt(degBounds[i]) + 1n;
      exps[i] = Number(remaining % radix);
      remaining = remaining / radix;
    }
    if (remaining !== 0n) {
      return null;
    }
    entries.push([exps, coeff]);
  }
  return fromTerms(vars, entries);
}
