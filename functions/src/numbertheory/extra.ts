/**
 * Number-theory fills — closes gaps left by the existing combinatorics/number-theory
 * surface (`typed/combinatorics.ts`): continued fractions, Euler numbers, the signed
 * Stirling numbers of the first kind, discrete logarithm (BSGS), primitive roots,
 * multiplicative order, the Kronecker symbol, and lexicographic
 * permutation/combination *enumerators* (the existing `permutations`/`combinations`
 * only return counts, not the tuples themselves).
 *
 * Plain exported functions (not `mathTyped` dispatch) — all take/return `number`
 * or generic arrays, matching the style of `descriptive-stats.ts`.
 *
 * @packageDocumentation
 */

import { assertAllocSize } from '../utils/limits.js';
import { chooseScalar } from '../wasm/special/scalars.js';
import { gcdBigInt } from '@danielsimonjr/mathts-core/internal';
import { modPow } from './modular.js';

// =============================================================================
// continuedFraction — simple continued fraction expansion
// =============================================================================

/**
 * Simple continued fraction expansion `[a0, a1, a2, ...]` of `x`, where
 * `a_i = floor(r)` and `r <- 1 / (r - a_i)`.
 *
 * Stops after `maxTerms` (default 20) or once the fractional part is smaller
 * than `1e-12` (the remaining value is effectively an integer).
 *
 * @param x - The number to expand
 * @param maxTerms - Maximum number of terms to compute (default 20)
 * @returns The sequence of partial-quotient terms
 *
 * @example
 * continuedFraction(3.245, 5) // => [3, 4, 12, 4, ...]
 */
export function continuedFraction(x: number, maxTerms = 20): number[] {
  if (!Number.isFinite(x)) {
    throw new Error('continuedFraction requires a finite number');
  }
  const terms: number[] = [];
  let r = x;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(r);
    terms.push(a);
    const frac = r - a;
    if (frac < 1e-12) break;
    r = 1 / frac;
  }
  return terms;
}

// =============================================================================
// eulerNumbers — Euler numbers E_0..E_n
// =============================================================================

/** Exact binomial coefficient `C(n, k)` for small non-negative integers. */
function binomialExact(n: number, k: number): number {
  return Math.round(chooseScalar(n, k));
}

/** First index from which every even Euler number is NaN in double (the recurrence sums opposite infinities). */
const EULER_NUMBERS_NAN_FROM = 188;

/**
 * Euler numbers `E_0..E_n` (the coefficients in the secant Maclaurin series).
 *
 * `E_0 = 1`; all odd-index Euler numbers are 0; for even `m > 0`:
 * `E_m = -sum_{k=0}^{m/2-1} C(m, 2k) * E_{2k}`.
 *
 * @param n - Non-negative integer: compute E_0 through E_n
 * @returns Array of length `n + 1`: `[E_0, E_1, ..., E_n]`
 * From index 188 the even entries are `NaN` and the odd entries are 0.
 *
 * @throws RangeError if the result has more than 100000000 elements
 *
 * @example
 * eulerNumbers(6) // => [1, 0, -1, 0, 5, 0, -61]
 */
export function eulerNumbers(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('eulerNumbers requires a non-negative integer');
  }
  assertAllocSize('eulerNumbers', [n + 1]);
  const E: number[] = new Array(n + 1).fill(0);
  E[0] = 1;
  const last = Math.min(n, EULER_NUMBERS_NAN_FROM);
  for (let m = 1; m <= last; m++) {
    if (m % 2 === 1) {
      E[m] = 0;
      continue;
    }
    let sum = 0;
    for (let k = 0; k < m / 2; k++) {
      sum += binomialExact(m, 2 * k) * E[2 * k];
    }
    E[m] = -sum;
  }
  for (let m = EULER_NUMBERS_NAN_FROM + 2; m <= n; m += 2) E[m] = NaN;
  return E;
}

// =============================================================================
// stirlingS1 — signed Stirling numbers of the first kind
// =============================================================================

/**
 * Signed Stirling number of the first kind `s(n, k)`.
 *
 * Recurrence: `s(n, k) = s(n-1, k-1) - (n-1)*s(n-1, k)`, with `s(0, 0) = 1`
 * and `s(n, 0) = 0` for `n > 0`.
 *
 * @param n - Non-negative integer
 * @param k - Non-negative integer, `0 <= k <= n`
 * @returns The signed Stirling number `s(n, k)`
 *
 * @example
 * stirlingS1(5, 2) // => -50
 */
export function stirlingS1(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new Error('stirlingS1 requires non-negative integers');
  }
  if (k > n) return 0;
  assertAllocSize('stirlingS1', [n + 1, n + 1]);
  const s: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  s[0][0] = 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j <= i; j++) {
      const prevDiag = j > 0 ? s[i - 1][j - 1] : 0;
      const prevSame = s[i - 1][j];
      s[i][j] = prevDiag - (i - 1) * prevSame;
    }
  }
  return s[n][k];
}

// =============================================================================
// Shared BigInt modular-arithmetic helpers (discreteLog / primitiveRoot)
// =============================================================================

/** Modular multiplicative inverse of `a` modulo `mod` via the extended Euclidean algorithm. */
function modInverseBig(a: bigint, mod: bigint): bigint {
  let oldR = a;
  let r = mod;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % mod) + mod) % mod;
}

// =============================================================================
// discreteLog — baby-step giant-step
// =============================================================================

/**
 * Largest baby-step count (2^24). The table is two `Uint32Array`s of twice this size: 268 MB
 * at the limit.
 *
 * A call at this limit (a modulus near 2^48) took 12 to 27 s when measured, by machine load.
 * The peak resident memory was about 330 MB in a process that loads this function alone, and
 * about 480 MB in a process that loads the full package. A lower limit refuses calls that
 * return in less than 20 s at a low load.
 */
const MAX_BABY_STEPS = 2 ** 24;

/**
 * Discrete logarithm for a modulus too large for the baby-step table: walk the powers of
 * `g` once. Return `j` at the first `g^j === h`, and `-1` when the walk returns to 1.
 *
 * @throws RangeError if neither happens within {@link MAX_BABY_STEPS} steps
 */
function discreteLogSmallOrder(
  G: bigint,
  H: bigint,
  P: bigint,
  p: number,
  mNumber: number
): number {
  let cur = 1n;
  for (let j = 0; j < MAX_BABY_STEPS; j++) {
    if (cur === H) return j;
    cur = (cur * G) % P;
    if (cur === 1n) return -1;
  }
  throw new RangeError(
    `discreteLog: p = ${p}${P === BigInt(p) ? '' : ` (reduced modulus N = ${P})`} needs ${mNumber} baby steps, above the supported maximum of ${MAX_BABY_STEPS}`
  );
}

/**
 * 32-bit hash of an integer in [0, 2^53). Both halves of the value change every bit of the
 * hash, so values that differ only above bit 32 (the powers of 2^22 + 1 modulo 2^44) get
 * different hashes.
 */
function hash32(value: number): number {
  const hi = Math.floor(value / 4294967296);
  const h = Math.imul((value >>> 0) ^ Math.imul(hi, 0x9e3779b1), 0x85ebca6b);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Discrete logarithm via baby-step giant-step: the smallest `x >= 0` such
 * that `g^x === h (mod p)`, or `-1` if none exists.
 *
 * Uses `BigInt` internally for modular exponentiation/inversion to avoid
 * overflow. When `g` and `p` share a factor, the common factors are first divided out of
 * `h` and `p`, one power of `g` per division. Then `m = ceil(sqrt(N-1))` baby steps for the
 * reduced modulus `N` are stored in a typed-array hash table; the giant steps multiply by
 * `g^(-m) mod N` each round. The return value includes the divided-out powers, so it is an exponent for the
 * original `p`.
 *
 * @param g - Base
 * @param h - Target
 * @param p - Modulus (any integer >= 2; `g` need not be coprime to it)
 * @returns The smallest non-negative `x` with `g^x === h (mod p)`, or `-1`
 * @throws RangeError if `p` is not a safe integer, or if `p` needs more than 2^24 baby
 *   steps and the first 2^24 powers of `g` (after common factors with `p` are divided out)
 *   neither reach `h` nor return to 1
 *
 * @example
 * discreteLog(2, 3, 5) // => 3   (2^3 = 8 === 3 mod 5)
 */
export function discreteLog(g: number, h: number, p: number): number {
  if (!Number.isInteger(g) || !Number.isInteger(h) || !Number.isInteger(p) || p < 2) {
    throw new Error('discreteLog requires integer g, h and a modulus p >= 2');
  }
  // Every residue must convert to a number key exactly.
  if (!Number.isSafeInteger(p)) {
    throw new RangeError('discreteLog: p must be a safe integer (at most 9007199254740991)');
  }
  let N = BigInt(p);
  let a = ((BigInt(g) % N) + N) % N;
  let b = ((BigInt(h) % N) + N) % N;
  if (b === 1n) return 0;
  // Non-coprime reduction: while gcd(g, N) = d > 1, a solution needs d | h. Divide d out of h
  // and N and fold g/d into a running factor: g^x === h (mod p) becomes
  // factor * g^(x - count) === b (mod N). Thus `factor === b` is the solution x = count, and
  // it is the smallest one, because each smaller x failed this test. b stays below N.
  let count = 0;
  let factor = 1n;
  for (let d = gcdBigInt(a, N); d !== 1n; d = gcdBigInt(a, N)) {
    if (b % d !== 0n) return -1;
    b /= d;
    N /= d;
    count++;
    factor = (factor * (a / d)) % N;
    if (factor === b) return count;
    a %= N;
  }
  // g is now invertible modulo N: solve g^x === b / factor, then add the stripped steps.
  const x = discreteLogCoprime(a, (b * modInverseBig(factor, N)) % N, N, p);
  return x < 0 ? -1 : x + count;
}

/**
 * Smallest `x >= 0` with `G^x === H (mod P)` for `gcd(G, P) = 1` and `P >= 2`, else `-1`.
 * `pOriginal` is the caller's modulus, for the error message.
 */
function discreteLogCoprime(G: bigint, H: bigint, P: bigint, pOriginal: number): number {
  // H has no inverse modulo P, so no power of the unit G equals it.
  if (gcdBigInt(H, P) !== 1n) return -1;
  const mNumber = Math.max(1, Math.ceil(Math.sqrt(Number(P) - 1)));
  // The table holds at most 2^24 entries. Above that, walk the powers of g with no table.
  if (mNumber > MAX_BABY_STEPS) return discreteLogSmallOrder(G, H, P, pOriginal, mNumber);
  const m = BigInt(mNumber);

  // Baby steps: g^j mod p for j = 0..m-1. The loop stops when the powers return to 1, so the
  // stored values are distinct and each has its smallest j.
  // Open addressing, linear probing, load factor at most 1/2, 8 bytes per slot. A slot holds
  // the 32-bit hash of the value and j + 1; 0 marks an empty slot. The top bits of the hash
  // select the slot. Two values can share a hash, so a lookup confirms a key match with g^j.
  let bits = 1;
  while (2 ** bits < 2 * mNumber) bits++;
  const mask = 2 ** bits - 1;
  const shift = 32 - bits;
  const keys = new Uint32Array(2 ** bits);
  const steps = new Uint32Array(2 ** bits);
  let cur = 1n;
  let cycled = false;
  for (let j = 0; j < mNumber && !cycled; j++) {
    const key = hash32(Number(cur));
    let s = key >>> shift;
    while (steps[s] !== 0) s = (s + 1) & mask;
    keys[s] = key;
    steps[s] = j + 1;
    cur = (cur * G) % P;
    cycled = cur === 1n;
  }

  // Giant steps: gamma_i = h * (g^-m)^i mod p. When the baby steps returned to 1, the table
  // holds every power of g, so the first lookup decides.
  const rounds = cycled ? 1n : m;
  const gm = modPow(G, m, P);
  const gInvM = modInverseBig(gm, P);
  let gamma = H;
  for (let i = 0n; i < rounds; i++) {
    const key = hash32(Number(gamma));
    let s = key >>> shift;
    while (steps[s] !== 0) {
      if (keys[s] === key) {
        const j = BigInt(steps[s] - 1);
        if (modPow(G, j, P) === gamma) return Number(i * m + j);
      }
      s = (s + 1) & mask;
    }
    gamma = (gamma * gInvM) % P;
  }
  return -1;
}

// =============================================================================
// primitiveRoot — smallest primitive root modulo n (n = 2, 4, p^k, 2p^k)
// =============================================================================

/** Distinct prime factors of `n` via trial division. */
function distinctPrimeFactors(nIn: number): number[] {
  let n = nIn;
  const primes: number[] = [];
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) {
      primes.push(d);
      while (n % d === 0) n /= d;
    }
  }
  if (n > 1) primes.push(n);
  return primes;
}

/**
 * Smallest primitive root modulo `n`.
 *
 * A primitive root exists only for `n` in {1, 2, 4, p^k, 2p^k} (p an odd
 * prime); for any other `n` (8, 12, 15, ...) this throws, matching the
 * file's contract of throwing `Error` on invalid input. For such `n`, `g` is a
 * primitive root iff `gcd(g, n) = 1` and `g^(φ(n)/q) !== 1 (mod n)` for every
 * prime factor `q` of `φ(n)`.
 *
 * @param n - An integer >= 2 with a primitive root (n = 2 returns 1)
 * @returns The smallest primitive root modulo n
 * @throws Error if n < 2, non-integer, or n has no primitive root
 *
 * @example
 * primitiveRoot(7) // => 3
 * primitiveRoot(4) // => 3
 * primitiveRoot(8) // throws (no primitive root)
 */
export function primitiveRoot(n: number): number {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error('primitiveRoot requires an integer p >= 2');
  }
  if (n === 2) return 1;
  if (n === 4) return 3;
  // Existence: n = p^k or 2 p^k with p an odd prime.
  const m = n % 2 === 0 ? n / 2 : n;
  if (m % 2 === 0) throw new Error(`primitiveRoot: ${n} has no primitive root`);
  const oddPrimes = distinctPrimeFactors(m);
  if (oddPrimes.length !== 1) throw new Error(`primitiveRoot: ${n} has no primitive root`);
  const q0 = oddPrimes[0];
  // φ(n) = φ(m) = m / q0 · (q0 − 1)
  const phi = (m / q0) * (q0 - 1);
  const phiFactors = distinctPrimeFactors(phi);
  const N = BigInt(n);
  for (let g = 2; g < n; g++) {
    if (gcdInt(g, n) !== 1) continue;
    let isRoot = true;
    for (const q of phiFactors) {
      if (modPow(BigInt(g), BigInt(phi / q), N) === 1n) {
        isRoot = false;
        break;
      }
    }
    if (isRoot) return g;
  }
  throw new Error(`primitiveRoot: no primitive root found for ${n}`);
}

// =============================================================================
// multiplicativeOrder — order of a mod n
// =============================================================================

function gcdInt(aIn: number, bIn: number): number {
  let a = Math.abs(aIn);
  let b = Math.abs(bIn);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Multiplicative order of `a` modulo `n`: the smallest `k > 0` with
 * `a^k === 1 (mod n)`. Returns `-1` if `gcd(a, n) !== 1` (no order exists).
 *
 * @param a - Integer
 * @param n - Positive integer modulus
 * @returns The multiplicative order, or -1 if undefined
 *
 * @example
 * multiplicativeOrder(2, 7) // => 3
 */
export function multiplicativeOrder(a: number, n: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(n) || n < 1) {
    throw new Error('multiplicativeOrder requires integers with modulus n >= 1');
  }
  const amod = ((a % n) + n) % n;
  if (gcdInt(amod, n) !== 1) return -1;
  if (n === 1) return 1;

  // ord divides phi(n): start from phi(n) and strip every prime q of phi(n)
  // while a^(ord/q) is still 1. BigInt keeps the modular products exact for
  // any safe-integer modulus (a plain `cur * amod` overflows 2^53 past n ~ 9.5e7).
  let phi = n;
  for (const p of distinctPrimeFactors(n)) phi = (phi / p) * (p - 1);

  const nBig = BigInt(n);
  const aBig = BigInt(amod);
  let ord = phi;
  for (const q of distinctPrimeFactors(phi)) {
    while (ord % q === 0 && modPow(aBig, BigInt(ord / q), nBig) === 1n) {
      ord /= q;
    }
  }
  return ord;
}

// =============================================================================
// kroneckerSymbol — generalizes the Jacobi symbol to all integers
// =============================================================================

/** The Kronecker symbol `(a|2)`: 0 if a is even, else ±1 by a mod 8. */
function kroneckerTwo(a: number): number {
  if (a % 2 === 0) return 0;
  const r = ((a % 8) + 8) % 8;
  return r === 1 || r === 7 ? 1 : -1;
}

/**
 * Kronecker symbol `(a|n)`, generalizing the Jacobi symbol `(a|n)` (odd
 * positive `n`) to all integers `n`.
 *
 * - `(a|0) = 1` if `|a| = 1`, else `0`.
 * - Sign of `n` is extracted first: `(a|-1) = -1` if `a < 0`, else `1`.
 * - Factors of 2 are extracted from `n` using `(a|2)`: `0` if `a` even,
 *   `1` if `a === ±1 (mod 8)`, `-1` if `a === ±3 (mod 8)`.
 * - The remaining odd part is evaluated via the standard Jacobi reciprocity
 *   recursion.
 *
 * @param a - Integer
 * @param n - Integer
 * @returns -1, 0, or 1
 *
 * @example
 * kroneckerSymbol(2, 3) // => -1
 */
export function kroneckerSymbol(a: number, n: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(n)) {
    throw new Error('kroneckerSymbol requires integers');
  }
  if (n === 0) {
    return Math.abs(a) === 1 ? 1 : 0;
  }

  let sign = 1;
  let nn = n;
  if (nn < 0) {
    nn = -nn;
    if (a < 0) sign = -1;
  }

  let v = 0;
  while (nn % 2 === 0) {
    nn /= 2;
    v++;
  }
  if (v > 0) {
    const k2 = kroneckerTwo(a);
    if (k2 === 0) return 0;
    sign *= Math.pow(k2, v);
  }

  if (nn === 1) return sign;

  // Standard Jacobi reciprocity recursion on the remaining odd part.
  let aa = ((a % nn) + nn) % nn;
  let N = nn;
  let jac = 1;
  while (aa !== 0) {
    while (aa % 2 === 0) {
      aa /= 2;
      if (N % 8 === 3 || N % 8 === 5) jac = -jac;
    }
    [aa, N] = [N, aa];
    if (aa % 4 === 3 && N % 4 === 3) jac = -jac;
    aa = aa % N;
  }
  return sign * (N === 1 ? jac : 0);
}

// =============================================================================
// permutationsGen / combinationsGen — lexicographic tuple enumerators
// =============================================================================

/**
 * Enumerate all length-`k` combinations of `arr` (index-order subsequences,
 * i.e. lexicographic order for a sorted input) as an array of tuples.
 *
 * @param arr - Source array
 * @param k - Combination length
 * @returns All `C(arr.length, k)` combinations, in lexicographic order
 *
 * @example
 * combinationsGen([1, 2, 3], 2) // => [[1,2],[1,3],[2,3]]
 */
export function combinationsGen<T>(arr: readonly T[], k: number): T[][] {
  const n = arr.length;
  if (!Number.isInteger(k) || k < 0 || k > n) {
    throw new Error('combinationsGen: k must be an integer in [0, arr.length]');
  }
  const result: T[][] = [];
  const combo: T[] = [];
  function backtrack(start: number): void {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(arr[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return result;
}

/**
 * Enumerate all length-`k` permutations (ordered arrangements) of `arr`
 * as an array of tuples, in lexicographic order of index selection.
 * `k` defaults to `arr.length` (full permutations).
 *
 * @param arr - Source array
 * @param k - Permutation length (default: `arr.length`)
 * @returns All `n! / (n-k)!` permutations, in lexicographic order
 *
 * @example
 * permutationsGen([1, 2, 3], 2) // => 6 tuples: [1,2],[1,3],[2,1],[2,3],[3,1],[3,2]
 */
export function permutationsGen<T>(arr: readonly T[], k: number = arr.length): T[][] {
  const n = arr.length;
  if (!Number.isInteger(k) || k < 0 || k > n) {
    throw new Error('permutationsGen: k must be an integer in [0, arr.length]');
  }
  const result: T[][] = [];
  const used = new Array<boolean>(n).fill(false);
  const perm: T[] = [];
  function backtrack(): void {
    if (perm.length === k) {
      result.push(perm.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      perm.push(arr[i]);
      backtrack();
      perm.pop();
      used[i] = false;
    }
  }
  backtrack();
  return result;
}
