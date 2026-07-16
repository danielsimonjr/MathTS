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
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Euler numbers `E_0..E_n` (the coefficients in the secant Maclaurin series).
 *
 * `E_0 = 1`; all odd-index Euler numbers are 0; for even `m > 0`:
 * `E_m = -sum_{k=0}^{m/2-1} C(m, 2k) * E_{2k}`.
 *
 * @param n - Non-negative integer: compute E_0 through E_n
 * @returns Array of length `n + 1`: `[E_0, E_1, ..., E_n]`
 *
 * @example
 * eulerNumbers(6) // => [1, 0, -1, 0, 5, 0, -61]
 */
export function eulerNumbers(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('eulerNumbers requires a non-negative integer');
  }
  const E: number[] = new Array(n + 1).fill(0);
  E[0] = 1;
  for (let m = 1; m <= n; m++) {
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

/** Modular exponentiation `base^exp mod m` via BigInt (avoids overflow). */
function modPowBig(base: bigint, exp: bigint, mod: bigint): bigint {
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

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
 * Discrete logarithm via baby-step giant-step: the smallest `x >= 0` such
 * that `g^x === h (mod p)`, or `-1` if none exists within `[0, p-1]`.
 *
 * Uses `BigInt` internally for modular exponentiation/inversion to avoid
 * overflow. `m = ceil(sqrt(p-1))` baby steps are stored in a map; the giant
 * steps multiply by `g^(-m) mod p` each round.
 *
 * @param g - Base
 * @param h - Target
 * @param p - Prime modulus
 * @returns The smallest non-negative `x` with `g^x === h (mod p)`, or `-1`
 *
 * @example
 * discreteLog(2, 3, 5) // => 3   (2^3 = 8 === 3 mod 5)
 */
export function discreteLog(g: number, h: number, p: number): number {
  if (!Number.isInteger(g) || !Number.isInteger(h) || !Number.isInteger(p) || p < 2) {
    throw new Error('discreteLog requires integer g, h and a modulus p >= 2');
  }
  const P = BigInt(p);
  const G = ((BigInt(g) % P) + P) % P;
  const H = ((BigInt(h) % P) + P) % P;
  const m = BigInt(Math.max(1, Math.ceil(Math.sqrt(p - 1))));

  // Baby steps: g^j mod p for j = 0..m-1, keeping the smallest j per value.
  const table = new Map<string, bigint>();
  let cur = 1n;
  for (let j = 0n; j < m; j++) {
    const key = cur.toString();
    if (!table.has(key)) table.set(key, j);
    cur = (cur * G) % P;
  }

  // Giant steps: gamma_i = h * (g^-m)^i mod p.
  const gm = modPowBig(G, m, P);
  const gInvM = modInverseBig(gm, P);
  let gamma = H;
  for (let i = 0n; i < m; i++) {
    const key = gamma.toString();
    const j = table.get(key);
    if (j !== undefined) {
      return Number(i * m + j);
    }
    gamma = (gamma * gInvM) % P;
  }
  return -1;
}

// =============================================================================
// primitiveRoot — smallest primitive root modulo a prime
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
 * Smallest primitive root modulo a prime `p`.
 *
 * For each candidate `g = 2, 3, ...`, `g` is a primitive root iff
 * `g^((p-1)/q) !== 1 (mod p)` for every prime factor `q` of `p - 1`.
 *
 * @param p - An odd prime (p = 2 returns 1 trivially)
 * @returns The smallest primitive root modulo p
 *
 * @example
 * primitiveRoot(7) // => 3
 */
export function primitiveRoot(p: number): number {
  if (!Number.isInteger(p) || p < 2) {
    throw new Error('primitiveRoot requires an integer p >= 2');
  }
  if (p === 2) return 1;
  const phi = p - 1;
  const phiFactors = distinctPrimeFactors(phi);
  const P = BigInt(p);
  for (let g = 2; g < p; g++) {
    let isRoot = true;
    for (const q of phiFactors) {
      if (modPowBig(BigInt(g), BigInt(phi / q), P) === 1n) {
        isRoot = false;
        break;
      }
    }
    if (isRoot) return g;
  }
  throw new Error('primitiveRoot: no primitive root found (p may not be prime)');
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

  let cur = amod;
  let k = 1;
  while (cur !== 1) {
    cur = (cur * amod) % n;
    k++;
  }
  return k;
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
