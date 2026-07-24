/**
 * Yun's square-free decomposition over ℤ.
 *
 * Given a nonzero integer polynomial `f`, decomposes `primitivePart(f)` into
 * pairwise-coprime square-free factors with multiplicities such that
 * `primitivePart(f) = ∏ factorᵢ^multᵢ` (up to sign — each returned `factor`
 * is normalized to have a positive leading coefficient via `primitivePart`).
 *
 * This is the classical characteristic-0 algorithm (valid over any field of
 * characteristic 0, hence over ℤ via `polyGcdZ`/`exactDivide`): let
 * `g = gcd(f, f')`, `c = f/g`, `w = f'/g`. Then repeatedly peel off the
 * square-free part at multiplicity `i` via `y = gcd(c, w)`,
 * `factor = c/y`, `c = y`, `w = w/y - factor'`.
 *
 * Part of the univariate factorization engine
 * (`functions/src/typed/factorization/`) — bigint-only.
 */

import {
  degree,
  derivative,
  exactDivide,
  polyGcdZ,
  primitivePart,
  sub,
  type IntPoly,
} from './integer-poly.js';

/** One square-free factor of the input, with its multiplicity in the input. */
export interface SquareFreeFactor {
  factor: IntPoly;
  mult: number;
}

/**
 * Yun square-free decomposition of `f` over ℤ. `f` must be nonzero (may be
 * non-primitive; the content is discarded — decomposition operates on
 * `primitivePart(f)`). Trivial degree-0 (constant) factors are never
 * included in the output.
 *
 * Recurrence (standard Yun, char 0): with `g = gcd(f, f')`,
 * `b0 = f/g`, `c0 = f'/g`, `d0 = c0 - b0'`. At each step `i = 1, 2, …`
 * (while `deg(b) > 0`): `aᵢ = gcd(b, d)` is the square-free factor of
 * multiplicity `i` (possibly a unit, i.e. degree 0, meaning multiplicity `i`
 * is absent); `b ← b/aᵢ`, `c ← d/aᵢ`, `d ← c - b'` for the next round.
 */
export function squareFreeDecompose(f: IntPoly): SquareFreeFactor[] {
  const p = primitivePart(f);
  const result: SquareFreeFactor[] = [];

  const fPrime = derivative(p);
  const g = polyGcdZ(p, fPrime);

  const b0 = exactDivide(p, g);
  const c0 = exactDivide(fPrime, g);
  if (b0 === null || c0 === null) {
    throw new Error(
      "squareFreeDecompose: exact division failed against gcd(f, f'); f/g and f'/g must divide evenly"
    );
  }

  let b = b0;
  let d = sub(c0, derivative(b));
  let i = 1;
  while (degree(b) > 0) {
    const a = polyGcdZ(b, d);
    if (degree(a) > 0) {
      result.push({ factor: primitivePart(a), mult: i });
    }
    const nextB = exactDivide(b, a);
    const nextC = exactDivide(d, a);
    if (nextB === null || nextC === null) {
      throw new Error('squareFreeDecompose: exact division b/a or d/a failed');
    }
    b = nextB;
    d = sub(nextC, derivative(b));
    i += 1;
  }

  return result;
}
