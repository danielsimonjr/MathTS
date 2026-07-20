/**
 * Multifactor Hensel lifting for the univariate factorization engine
 * (`functions/src/typed/factorization/`).
 *
 * Given a MONIC integer polynomial `f` and its MONIC irreducible factors over
 * 𝔽_p (whose product is ≡ f mod p), lift that factorization to a factorization
 * modulo `p^k` whose product is ≡ f (mod p^k), with each lifted factor still
 * ≡ its input factor (mod p). The target modulus `p^k` is chosen by the caller
 * so that `p^k ≥ 2·landauMignotte(f)+1`, i.e. large enough that the true
 * integer factors of `f` are uniquely recovered by symmetric reduction.
 *
 * Strategy: LINEAR (iterated) two-factor Hensel lifting from `p^i` to `p^{i+1}`
 * up to `p^k`, combined with a recursive FACTOR TREE for more than two factors.
 * Bézout cofactors `s, t` with `s·g + t·h ≡ 1 (mod p)` are computed once per
 * two-factor split via the extended Euclidean algorithm over 𝔽_p; because the
 * per-step diophantine correction is solved only mod p, the fixed mod-p
 * cofactors remain valid at every lifting step (the standard property of linear
 * Hensel lifting — see Geddes/Czapor/Labahn §6.4 or von zur Gathen & Gerhard
 * §15). All factors are monic and `f` is monic, so the lifted factors stay
 * monic and no leading-coefficient imposition is required.
 *
 * `bigint`-only by design: float64 loses correctness once `p^k > 2^53`.
 */

import {
  add,
  sub,
  mul,
  scalarMul,
  isZero,
  lc,
  modSymmetric,
  type IntPoly,
} from './integer-poly.js';
import { reduceModP, addP, mulP, subP, divmodP, invModP } from './finite-field.js';

/**
 * Reduces every coefficient of `poly` into the canonical range `[0, m)` and
 * trims trailing zeros. Used to keep the growing lifted factors bounded by the
 * current modulus. Monic factors keep their leading `1` (never reduced away
 * for `m > 1`).
 */
function reduceIntoRange(poly: IntPoly, m: bigint): IntPoly {
  const out = poly.map((c) => {
    const r = c % m;
    return r < 0n ? r + m : r;
  });
  let n = out.length;
  while (n > 0 && out[n - 1] === 0n) {
    n -= 1;
  }
  return out.slice(0, n);
}

/**
 * Exact scalar division of an integer polynomial by `m`: every coefficient is
 * assumed divisible by `m` (the Hensel invariant guarantees `f - G·H ≡ 0`
 * modulo the current modulus). bigint division is exact for divisible operands.
 */
function scalarExactDiv(poly: IntPoly, m: bigint): IntPoly {
  return poly.map((c) => c / m);
}

/** Product of a list of polynomials over 𝔽_p (empty product = the constant 1). */
function productModP(polys: IntPoly[], p: bigint): IntPoly {
  let acc: IntPoly = [1n];
  for (const g of polys) {
    acc = mulP(acc, g, p);
  }
  return acc;
}

/**
 * Extended Euclidean algorithm over 𝔽_p for two coprime polynomials `g`, `h`:
 * returns `s, t` with `s·g + t·h ≡ 1 (mod p)`, `deg(s) < deg(h)`,
 * `deg(t) < deg(g)`. Requires `gcd(g, h) = 1` over 𝔽_p (true when `g` and `h`
 * are products of disjoint sets of distinct monic irreducibles).
 */
function bezoutModP(g: IntPoly, h: IntPoly, p: bigint): { s: IntPoly; t: IntPoly } {
  let oldR = reduceModP(g, p);
  let r = reduceModP(h, p);
  let oldS: IntPoly = [1n];
  let s: IntPoly = [];
  let oldT: IntPoly = [];
  let t: IntPoly = [1n];
  while (!isZero(r)) {
    const { q } = divmodP(oldR, r, p);
    const newR = subP(oldR, mulP(q, r, p), p);
    oldR = r;
    r = newR;
    const newS = subP(oldS, mulP(q, s, p), p);
    oldS = s;
    s = newS;
    const newT = subP(oldT, mulP(q, t, p), p);
    oldT = t;
    t = newT;
  }
  // oldR is a nonzero constant (g, h coprime). Scale cofactors so that
  // s·g + t·h ≡ 1 (rather than ≡ that constant).
  const inv = invModP(lc(oldR), p);
  return {
    s: mulP(oldS, [inv], p),
    t: mulP(oldT, [inv], p),
  };
}

/**
 * Solves the polynomial diophantine equation `Δg·h + Δh·g ≡ c (mod p)` with
 * `deg(Δg) < deg(g)`, `deg(Δh) < deg(h)`, given Bézout cofactors `s, t`
 * (`s·g + t·h ≡ 1 mod p`). From `(s·c)·g + (t·c)·h ≡ c`, reduce `t·c` modulo
 * the monic `g` (remainder is `Δg`, quotient `q`); the compensating term folds
 * back into `Δh = s·c + q·h`. The returned corrections are added (scaled by the
 * current modulus) to the running lifted factors `G`, `H` respectively.
 */
function diophantineModP(
  c: IntPoly,
  g: IntPoly,
  h: IntPoly,
  s: IntPoly,
  t: IntPoly,
  p: bigint
): { dg: IntPoly; dh: IntPoly } {
  const { q, r: dg } = divmodP(mulP(t, c, p), g, p);
  const dh = addP(mulP(s, c, p), mulP(q, h, p), p);
  return { dg, dh };
}

/**
 * Linear two-factor Hensel lift: given monic `g`, `h` over 𝔽_p with
 * `f ≡ g·h (mod p)`, lift to monic `G`, `H` over ℤ with `G·H ≡ f (mod p^k)`,
 * `G ≡ g (mod p)`, `H ≡ h (mod p)`, where `targetPk = p^k`. Coefficients are
 * kept in `[0, current modulus)` throughout.
 */
function henselLiftTwo(
  f: IntPoly,
  g: IntPoly,
  h: IntPoly,
  p: bigint,
  targetPk: bigint
): { g: IntPoly; h: IntPoly } {
  const gBase = reduceModP(g, p);
  const hBase = reduceModP(h, p);
  const { s, t } = bezoutModP(gBase, hBase, p);
  let bigG = gBase;
  let bigH = hBase;
  let mod = p;
  while (mod < targetPk) {
    const nextMod = mod * p;
    // e = f - G·H ≡ 0 (mod `mod`); c = (e / mod) reduced mod p.
    const e = sub(f, mul(bigG, bigH));
    const c = reduceModP(scalarExactDiv(e, mod), p);
    const { dg, dh } = diophantineModP(c, gBase, hBase, s, t, p);
    bigG = reduceIntoRange(add(bigG, scalarMul(dg, mod)), nextMod);
    bigH = reduceIntoRange(add(bigH, scalarMul(dh, mod)), nextMod);
    mod = nextMod;
  }
  return { g: bigG, h: bigH };
}

/**
 * Multifactor Hensel lift. Lifts the mod-`p` factorization `factorsModP` of the
 * monic integer polynomial `f` (with `∏ factorsModP ≡ f mod p`) to monic
 * integer factors whose product is `≡ f (mod targetPk)` and each of which is
 * `≡ its input factor (mod p)`. Coefficients are returned in the symmetric
 * range modulo `targetPk = p^k` (via `modSymmetric`).
 *
 * More than two factors are handled by a recursive factor tree: `factorsModP`
 * is split into two halves, the two half-products are lifted together by
 * `henselLiftTwo`, and each lifted half is recursively split into its own
 * factors.
 */
export function henselLift(
  f: IntPoly,
  factorsModP: IntPoly[],
  p: bigint,
  targetPk: bigint
): IntPoly[] {
  const n = factorsModP.length;
  if (n === 0) {
    return [];
  }
  if (n === 1) {
    // f ≡ the single factor (mod p); its lift is f itself reduced mod p^k.
    // f is monic, so the symmetric reduction preserves the leading 1.
    return [modSymmetric(f, targetPk)];
  }
  const mid = n >> 1;
  const left = factorsModP.slice(0, mid);
  const right = factorsModP.slice(mid);
  const gBase = productModP(left, p);
  const hBase = productModP(right, p);
  const { g: bigG, h: bigH } = henselLiftTwo(f, gBase, hBase, p, targetPk);
  const leftLifted = henselLift(bigG, left, p, targetPk);
  const rightLifted = henselLift(bigH, right, p, targetPk);
  return [...leftLifted, ...rightLifted];
}
