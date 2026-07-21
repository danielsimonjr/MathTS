/**
 * Multivariate factorization over ℤ via Kronecker substitution (Layer 2 v1).
 *
 * The orchestration ties three shipped pieces together:
 *   1. Kronecker substitution (`kronecker.ts`) collapses an `n ≥ 2` variable
 *      integer polynomial to a single univariate image whose monomials are in
 *      bijection with the original's (mixed-radix place values).
 *   2. The univariate Zassenhaus engine (`zassenhaus.ts`) factors that image
 *      into irreducibles over ℤ.
 *   3. Subset recombination lifts each univariate irreducible (or product of
 *      several) back to a multivariate candidate and confirms it by EXACT
 *      multivariate division (`multiExactDivide`) — division is the sole
 *      arbiter, so no unverified factor is ever emitted.
 *
 * Correctness follows because (a) every true multivariate factor's image is a
 * subset of the univariate factors, so recombination is complete up to the
 * caps, and (b) division confirms each candidate, so recombination is sound.
 *
 * Two caps bound the work (each logs, never returns a silently wrong answer):
 *   - `KRONECKER_MAX_DEGREE` on the substituted univariate degree
 *     (`∏(degᵢ+1) − 1`), the Kronecker analogue of Layer 1's factor-count cap.
 *   - `MAX_MODULAR_FACTORS` on the univariate factor-pool size, matching
 *     Layer 1's recombination cap.
 *
 * `bigint`-only, matching the rest of the factorization engine.
 */

import {
  degreeIn,
  totalDegree,
  isZero,
  equals,
  integerContentMP,
  primitivePartMP,
  leadingTerm,
  canonicalCompare,
  multiExactDivide,
  type MultiPoly,
} from './multi-poly.js';
import { substitutionBases, substitute, substitutedDegree, backSubstitute } from './kronecker.js';
import { factorUnivariateZ } from './zassenhaus.js';
import { mul, type IntPoly } from './integer-poly.js';

/** Complete multivariate factorization: `p = constant · ∏ factorsᵢ^multᵢ`. */
export type MultiFactorization = {
  constant: bigint;
  factors: Array<{ poly: MultiPoly; mult: number }>;
};

/**
 * Beyond this substituted univariate degree, Kronecker declines (returns null)
 * and logs — avoids the `∏(degᵢ+1)` blowup producing a giant univariate solve.
 */
const KRONECKER_MAX_DEGREE = 2000n;

/**
 * Beyond this many univariate irreducibles in the recombination pool, subset
 * search is skipped and the input is returned whole (correct but unfactored),
 * with a logged notice — identical in spirit to Layer 1's cap.
 */
const MAX_MODULAR_FACTORS = 24;

/** Emits a diagnostic when a cap is hit (no silent truncation). */
function log(message: string): void {
  console.warn(message);
}

/** Yields every size-`s` subset of `{0, …, n-1}` as an index array. */
function* subsetsOfSize(n: number, s: number): Generator<number[]> {
  if (s === 0) {
    yield [];
    return;
  }
  if (s > n) {
    return;
  }
  const idx = Array.from({ length: s }, (_, i) => i);
  for (;;) {
    yield idx.slice();
    let i = s - 1;
    while (i >= 0 && idx[i] === n - s + i) {
      i -= 1;
    }
    if (i < 0) {
      return;
    }
    idx[i] += 1;
    for (let j = i + 1; j < s; j += 1) {
      idx[j] = idx[j - 1] + 1;
    }
  }
}

/** Removes the given pool indices in-place (descending, so splices don't shift). */
function removeIndices(pool: IntPoly[], indices: number[]): void {
  const sorted = [...indices].sort((a, b) => b - a);
  for (const i of sorted) {
    pool.splice(i, 1);
  }
}

/** Univariate product of the pool elements at `indices` (empty ⇒ constant 1). */
function subsetProduct(pool: IntPoly[], indices: number[]): IntPoly {
  let prod: IntPoly = [1n];
  for (const idx of indices) {
    prod = mul(prod, pool[idx]);
  }
  return prod;
}

/**
 * The multivariate candidate a subset back-substitutes to, normalized to a
 * positive-leading primitive part — or `null` if the back-substitution carries
 * out of range (an invalid, non-genuine factor) or is a bare constant.
 */
function candidateFor(
  pool: IntPoly[],
  indices: number[],
  bases: bigint[],
  degBounds: number[],
  vars: string[]
): MultiPoly | null {
  const back = backSubstitute(subsetProduct(pool, indices), bases, degBounds, vars);
  if (back === null) {
    return null;
  }
  const cand = primitivePartMP(back);
  if (totalDegree(cand) < 1) {
    return null;
  }
  return cand;
}

/**
 * Finds a size-`s` subset of `pool` that back-substitutes to `cand` (used to
 * strip one image-copy of a repeated factor per multiplicity division), or
 * `null` if none remains.
 */
function findMatchingSubset(
  pool: IntPoly[],
  s: number,
  cand: MultiPoly,
  bases: bigint[],
  degBounds: number[],
  vars: string[]
): number[] | null {
  for (const indices of subsetsOfSize(pool.length, s)) {
    const c = candidateFor(pool, indices, bases, degBounds, vars);
    if (c !== null && equals(c, cand)) {
      return indices;
    }
  }
  return null;
}

/**
 * Factors a multivariate (`n ≥ 2` variables) integer polynomial completely
 * over ℤ into irreducible factors with multiplicity, via Kronecker
 * substitution onto the Layer 1 univariate engine.
 *
 * Returns `null` (declines) when it cannot help — a single variable, the zero
 * or a constant polynomial, or the substituted degree exceeding the cap — so
 * the caller keeps its existing behavior. On success the constant carries the
 * signed integer content and every factor has a positive leading term under
 * the canonical (degree-lex) monomial order.
 */
export function factorMultivariateKronecker(p: MultiPoly): MultiFactorization | null {
  if (p.vars.length < 2) {
    return null;
  }
  if (isZero(p) || totalDegree(p) < 1) {
    return null;
  }

  // Signed integer content: p = constant · g, with g the positive-leading
  // primitive part.
  const cont = integerContentMP(p);
  const pLead = leadingTerm(p);
  const sign = pLead !== null && pLead.coeff < 0n ? -1n : 1n;
  let constant = cont * sign;
  const g = primitivePartMP(p);

  const bases = substitutionBases(g);
  if (substitutedDegree(g, bases) > KRONECKER_MAX_DEGREE) {
    log(
      `factorMultivariateKronecker: substituted degree exceeds ` +
        `KRONECKER_MAX_DEGREE=${KRONECKER_MAX_DEGREE.toString()}; declining`
    );
    return null;
  }

  const image = substitute(g, bases);
  const uf = factorUnivariateZ(image);

  const totalCount = uf.factors.reduce((acc, f) => acc + f.mult, 0);
  if (totalCount <= 1) {
    // The univariate image is irreducible ⇒ g is irreducible.
    return { constant, factors: [{ poly: g, mult: 1 }] };
  }

  // Flatten the univariate factorization into a pool of irreducibles, repeating
  // each by its multiplicity (a repeated multivariate factor shows up as
  // repeated images).
  const pool: IntPoly[] = [];
  for (const { poly, mult } of uf.factors) {
    for (let i = 0; i < mult; i += 1) {
      pool.push(poly);
    }
  }

  if (pool.length > MAX_MODULAR_FACTORS) {
    log(
      `factorMultivariateKronecker: ${pool.length} univariate factors exceeds ` +
        `MAX_MODULAR_FACTORS=${MAX_MODULAR_FACTORS}; returning input whole`
    );
    return { constant, factors: [{ poly: g, mult: 1 }] };
  }

  const degBounds = g.vars.map((_, i) => degreeIn(g, i));
  let gCur = g;
  const found: Array<{ poly: MultiPoly; mult: number }> = [];

  // Recombination: increasing subset size; the smallest subset that divides is
  // an irreducible factor. Restart from size 1 after each extraction.
  let s = 1;
  while (pool.length > 0 && 2 * s <= pool.length) {
    let extracted = false;
    for (const indices of subsetsOfSize(pool.length, s)) {
      const cand = candidateFor(pool, indices, bases, degBounds, g.vars);
      if (cand === null) {
        continue;
      }
      const quotient = multiExactDivide(gCur, cand);
      if (quotient === null) {
        continue;
      }
      // Confirmed irreducible factor. Capture its multiplicity by dividing it
      // out repeatedly, stripping one image-copy from the pool each time.
      gCur = quotient;
      removeIndices(pool, indices);
      let mult = 1;
      for (;;) {
        const next = multiExactDivide(gCur, cand);
        if (next === null) {
          break;
        }
        const copy = findMatchingSubset(pool, s, cand, bases, degBounds, g.vars);
        if (copy === null) {
          break;
        }
        removeIndices(pool, copy);
        gCur = next;
        mult += 1;
      }
      found.push({ poly: cand, mult });
      extracted = true;
      break;
    }
    if (extracted) {
      s = 1;
    } else {
      s += 1;
    }
  }

  // Any leftover cofactor: fold its content/sign into `constant`; a non-constant
  // remainder is the final irreducible factor (verified: g equals the product,
  // so the residual constant is ±1).
  if (!isZero(gCur)) {
    const c = integerContentMP(gCur);
    const l = leadingTerm(gCur);
    const sgn = l !== null && l.coeff < 0n ? -1n : 1n;
    constant *= c * sgn;
    if (totalDegree(gCur) >= 1) {
      found.push({ poly: primitivePartMP(gCur), mult: 1 });
    }
  }

  found.sort((a, b) => {
    const la = leadingTerm(a.poly);
    const lb = leadingTerm(b.poly);
    if (la === null || lb === null) {
      return 0;
    }
    return canonicalCompare(la.exps, lb.exps);
  });

  return { constant, factors: found };
}
