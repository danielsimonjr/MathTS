/**
 * Univariate polynomial factorization over ℤ — the top-level Zassenhaus
 * pipeline that ties together the factorization engine modules.
 *
 * Pipeline:
 *   1. Strip integer content and sign (constant prefix).
 *   2. Yun square-free decomposition (`squareFreeDecompose`).
 *   3. For each square-free primitive part `g` (possibly non-monic):
 *      pick a prime `p` with `p ∤ lc(g)` and image square-free mod p (fewest
 *      modular factors among the first candidates), factor `g` mod p, choose
 *      `k` with `p^k` large enough (Landau–Mignotte, with the extra leading
 *      coefficient factor), build the monic integer associate of `g` mod p^k,
 *      Hensel-lift the mod-p factors, then recombine subsets by exact division
 *      over ℤ (the leading-coefficient method for non-monic `g`).
 *   4. Emit each irreducible factor with the multiplicity of its square-free
 *      level; sort deterministically.
 *
 * Part of the univariate factorization engine
 * (`functions/src/typed/factorization/`) — `bigint`-only by design.
 */

import {
  trim,
  degree,
  lc,
  isZero,
  mul,
  scalarMul,
  primitivePart,
  content,
  derivative,
  exactDivide,
  landauMignotte,
  modSymmetric,
  type IntPoly,
} from './integer-poly.js';
import { reduceModP, makeMonicP, gcdP, factorModP } from './finite-field.js';
import { henselLift } from './hensel.js';
import { squareFreeDecompose } from './square-free.js';

/** Result of factoring an integer polynomial: a constant times irreducibles. */
export type Factorization = {
  constant: bigint;
  factors: Array<{ poly: IntPoly; mult: number }>;
};

/**
 * Beyond this many modular factors, subset recombination is skipped: the
 * square-free level is returned whole and a warning is logged (no silent
 * truncation).
 */
const MAX_MODULAR_FACTORS = 24;

/** Number of leading prime candidates to weigh by modular-factor count. */
const PRIME_CANDIDATE_WINDOW = 5;

/** Emits a diagnostic when the recombination cap is hit. */
function log(message: string): void {
  console.warn(message);
}

/** Trial-division primality test for the small primes used as lift bases. */
function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  if (n < 4n) return true;
  if (n % 2n === 0n) return false;
  for (let i = 3n; i * i <= n; i += 2n) {
    if (n % i === 0n) return false;
  }
  return true;
}

/**
 * Modular inverse of `a` modulo `m` via the extended Euclidean algorithm over
 * bigint. Returns a representative in `[0, m)`. Requires `gcd(a, m) = 1`
 * (throws otherwise) — used only for `L` invertible mod `p^k` since `p ∤ L`.
 */
function invMod(a: bigint, m: bigint): bigint {
  let oldR = ((a % m) + m) % m;
  let r = m;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) {
    throw new RangeError('invMod: arguments are not coprime');
  }
  return ((oldS % m) + m) % m;
}

/** Whether `reduceModP(g, p)` is square-free over 𝔽_p (image square-free). */
function isImageSquareFree(g: IntPoly, p: bigint): boolean {
  const gbar = reduceModP(g, p);
  const gbarDeriv = reduceModP(derivative(g), p);
  return degree(gcdP(gbar, gbarDeriv, p)) === 0;
}

/**
 * Selects a lifting prime for the square-free primitive `g`: among the first
 * `PRIME_CANDIDATE_WINDOW` primes with `p ∤ lc(g)` and image square-free, the
 * one whose mod-p factorization has the fewest factors. Returns the prime and
 * its (monic) modular irreducible factors.
 */
function selectPrime(g: IntPoly, L: bigint): { p: bigint; modFactors: IntPoly[] } {
  let best: { p: bigint; modFactors: IntPoly[] } | null = null;
  let considered = 0;
  let candidate = 2n;
  while (considered < PRIME_CANDIDATE_WINDOW) {
    while (!isPrime(candidate) || L % candidate === 0n || !isImageSquareFree(g, candidate)) {
      candidate += 1n;
    }
    const gp = makeMonicP(reduceModP(g, candidate), candidate);
    const modFactors = factorModP(gp, candidate);
    if (best === null || modFactors.length < best.modFactors.length) {
      best = { p: candidate, modFactors };
    }
    considered += 1;
    candidate += 1n;
    if (best.modFactors.length === 1) {
      break;
    }
  }
  // best is always assigned in the first loop iteration.
  return best as { p: bigint; modFactors: IntPoly[] };
}

/** Minimal `k` with `p^k >= bound`, returned as `p^k`. */
function powAtLeast(p: bigint, bound: bigint): bigint {
  let pk = p;
  while (pk < bound) {
    pk *= p;
  }
  return pk;
}

/** Yields every size-`k` subset of `[0, n)` as an index array. */
function* combinations(n: number, k: number): Generator<number[]> {
  if (k < 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.slice();
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) {
      i -= 1;
    }
    if (i < 0) return;
    idx[i] += 1;
    for (let j = i + 1; j < k; j += 1) {
      idx[j] = idx[j - 1] + 1;
    }
  }
}

/**
 * Recombination candidate for a subset of lifted factors: `L·∏ u_i` reduced
 * symmetrically mod `Pk`, then primitive part (positive lc).
 */
function subsetCandidate(pool: IntPoly[], indices: number[], L: bigint, Pk: bigint): IntPoly {
  let prod: IntPoly = [1n];
  for (const i of indices) {
    prod = mul(prod, pool[i]);
  }
  return primitivePart(modSymmetric(scalarMul(prod, L), Pk));
}

/**
 * Factors a square-free primitive integer polynomial `g` (possibly non-monic)
 * into its irreducible factors over ℤ (each primitive, positive lc).
 */
function factorSquareFree(g: IntPoly): IntPoly[] {
  if (degree(g) <= 0) {
    return [];
  }
  if (degree(g) === 1) {
    return [primitivePart(g)];
  }

  const L = lc(g);
  const { p, modFactors } = selectPrime(g, L);

  if (modFactors.length === 1) {
    return [primitivePart(g)];
  }
  if (modFactors.length > MAX_MODULAR_FACTORS) {
    log(
      `factorUnivariateZ: ${modFactors.length} modular factors exceeds cap ` +
        `${MAX_MODULAR_FACTORS}; returning square-free part of degree ${degree(g)} unfactored`
    );
    return [primitivePart(g)];
  }

  // p^k >= 2·n·L·landauMignotte(g) + 1 (extra L for the leading-coeff method).
  const n = BigInt(degree(g));
  const Labs = L < 0n ? -L : L;
  const bound = 2n * n * Labs * landauMignotte(g) + 1n;
  const Pk = powAtLeast(p, bound);

  // Monic integer associate of g mod Pk: L⁻¹·g, symmetric-reduced.
  const Linv = invMod(((L % Pk) + Pk) % Pk, Pk);
  const gMonic = modSymmetric(scalarMul(g, Linv), Pk);
  const u = henselLift(gMonic, modFactors, p, Pk);

  const found: IntPoly[] = [];
  let pool = u.slice();
  let gCur = g;
  let Lcur = lc(gCur);
  let size = 1;
  while (2 * size <= pool.length) {
    let matched: { cand: IntPoly; indices: number[] } | null = null;
    for (const indices of combinations(pool.length, size)) {
      const cand = subsetCandidate(pool, indices, Lcur, Pk);
      if (degree(cand) < 1) {
        continue;
      }
      if (exactDivide(gCur, cand) !== null) {
        matched = { cand, indices };
        break;
      }
    }
    if (matched === null) {
      size += 1;
      continue;
    }
    const quotient = exactDivide(gCur, matched.cand);
    if (quotient === null) {
      throw new Error('factorUnivariateZ: recombination divisor stopped dividing');
    }
    found.push(primitivePart(matched.cand));
    gCur = quotient;
    Lcur = lc(gCur);
    const drop = new Set(matched.indices);
    pool = pool.filter((_, i) => !drop.has(i));
  }
  if (degree(gCur) > 0) {
    found.push(primitivePart(gCur));
  }
  return found;
}

/**
 * Compares two integer polynomials for the canonical factor ordering: by
 * degree ascending, then coefficient array element-wise from index 0 upward,
 * numerically ascending.
 */
function comparePolys(a: IntPoly, b: IntPoly): number {
  const da = degree(a);
  const db = degree(b);
  if (da !== db) {
    return da - db;
  }
  const ta = trim(a);
  const tb = trim(b);
  for (let i = 0; i < ta.length; i += 1) {
    if (ta[i] !== tb[i]) {
      return ta[i] < tb[i] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Full univariate factorization of `f` over ℤ into a constant times
 * irreducible primitive factors with multiplicities. Trivial inputs (zero,
 * constant, degree ≤ 1) short-circuit.
 */
export function factorUnivariateZ(f: IntPoly): Factorization {
  const tf = trim(f);
  if (isZero(tf)) {
    return { constant: 0n, factors: [] };
  }
  if (tf.length === 1) {
    return { constant: tf[0], factors: [] };
  }

  // constant = content · sign(lc); the primitive part carries positive lc.
  const cont = content(tf);
  const sign = lc(tf) < 0n ? -1n : 1n;
  const constant = cont * sign;
  const prim = primitivePart(tf);

  if (degree(prim) === 1) {
    return { constant, factors: [{ poly: prim, mult: 1 }] };
  }

  const factors: Array<{ poly: IntPoly; mult: number }> = [];
  for (const { factor: g, mult } of squareFreeDecompose(prim)) {
    for (const irreducible of factorSquareFree(g)) {
      factors.push({ poly: irreducible, mult });
    }
  }

  factors.sort((a, b) => comparePolys(a.poly, b.poly));
  return { constant, factors };
}
