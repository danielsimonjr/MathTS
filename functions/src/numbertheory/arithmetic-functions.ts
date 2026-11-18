/**
 * Arithmetic functions and integer power / root helpers: squarefree tests,
 * radical, Omega counts, Liouville, von Mangoldt, Mertens, perfect and
 * prime-power tests, exact integer roots, digit sums, Collatz and primorial.
 */

import { assertLoopOrder, MAX_ALLOC_ELEMENTS } from '../utils/limits.js';
import { trialFactorize as factorize } from './modular.js';

/** Largest `n` for primorial (n = 1e7 takes about 2 s). */
const PRIMORIAL_MAX_N = 10_000_000;

function assertPositiveInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`${name} must be a positive integer`);
}

/** Sum of the divisors of n (sigma), computed from the factorization. */
function sigma(n: number): number {
  let total = 1;
  for (const [p, e] of factorize(n)) {
    let term = 1;
    let pk = 1;
    for (let i = 0; i < e; i++) {
      pk *= p;
      term += pk;
    }
    total *= term;
  }
  return total;
}

/** True when n is a positive integer with no square factor greater than 1. */
export function isSquarefree(n: number): boolean {
  assertPositiveInt(n, 'n');
  return factorize(n).every(([, e]) => e === 1);
}

/** Product of the distinct prime factors of n (rad(n)). */
export function radical(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).reduce((acc, [p]) => acc * p, 1);
}

/** Number of prime factors counted with multiplicity (Omega). */
export function bigOmega(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).reduce((acc, [, e]) => acc + e, 0);
}

/** Number of distinct prime factors (omega). */
export function smallOmega(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).length;
}

/** Liouville function lambda(n) = (-1)^Omega(n). */
export function liouvilleLambda(n: number): -1 | 1 {
  return bigOmega(n) % 2 === 0 ? 1 : -1;
}

/** von Mangoldt function: ln p when n = p^k (k >= 1), otherwise 0. */
export function vonMangoldt(n: number): number {
  assertPositiveInt(n, 'n');
  const f = factorize(n);
  return f.length === 1 ? Math.log(f[0][0]) : 0;
}

/** Mertens function M(n) = sum of mu(k) for k = 1..n. Throws RangeError for n above 100000000. */
export function mertens(n: number): number {
  assertPositiveInt(n, 'n');
  assertLoopOrder('mertens', 'n', n, MAX_ALLOC_ELEMENTS);
  // Linear sieve: each composite is marked once, by its smallest prime factor.
  const mu = new Int8Array(n + 1);
  const composite = new Uint8Array(n + 1);
  const primes: number[] = [];
  mu[1] = 1;
  let total = 1;
  for (let i = 2; i <= n; i++) {
    if (composite[i] === 0) {
      primes.push(i);
      mu[i] = -1;
    }
    for (const p of primes) {
      const ip = i * p;
      if (ip > n) break;
      composite[ip] = 1;
      if (i % p === 0) {
        mu[ip] = 0;
        break;
      }
      mu[ip] = -mu[i];
    }
    total += mu[i];
  }
  return total;
}

/** True when n equals the sum of its proper divisors (n >= 2). */
export function isPerfect(n: number): boolean {
  assertPositiveInt(n, 'n');
  return n >= 2 && sigma(n) - n === n;
}

/**
 * Floor of the square root of a non-negative bigint (Newton iteration). A finite number
 * is floored first, so the result is always a bigint.
 */
export function integerSqrt(value: bigint | number): bigint {
  let n: bigint;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('integerSqrt: n must be finite');
    n = BigInt(Math.floor(value));
  } else {
    n = value;
  }
  if (n < 0n) throw new RangeError('integerSqrt requires a non-negative argument');
  if (n < 2n) return n;
  // Newton iteration from a power of two that is not below the root. The sequence
  // decreases until it reaches floor(sqrt(n)). A float estimate is wrong for a big
  // bigint, so the code does not use one.
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** Floor of the k-th root of a non-negative bigint (binary search). */
export function integerNthRoot(n: bigint, k: number): bigint {
  if (n < 0n) throw new RangeError('integerNthRoot requires a non-negative argument');
  if (!Number.isSafeInteger(k) || k < 1) throw new RangeError('k must be a positive integer');
  if (n < 2n || k === 1) return n;
  const bits = n.toString(2).length;
  let lo = 0n;
  let hi = 1n << BigInt(Math.ceil(bits / k) + 1);
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (mid ** BigInt(k) <= n) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

/**
 * Perfect-power test. Returns `{ base, exp }` with `n = base^exp`, `base > 1`,
 * and `exp` as large as possible; `null` if n is not a perfect power (or n < 2).
 */
export function isPerfectPower(n: number): { base: number; exp: number } | null {
  if (!Number.isSafeInteger(n) || n < 2) return null;
  const big = BigInt(n);
  const maxExp = Math.floor(Math.log2(n));
  for (let k = maxExp; k >= 2; k--) {
    const r = integerNthRoot(big, k);
    if (r > 1n && r ** BigInt(k) === big) return { base: Number(r), exp: k };
  }
  return null;
}

/**
 * Prime-power test: `{ p, k }` with `n = p^k`, `k >= 1`; `null` if n is not a
 * prime power (or n < 2).
 */
export function isPrimePower(n: number): { p: number; k: number } | null {
  if (!Number.isSafeInteger(n) || n < 2) return null;
  const f = factorize(n);
  return f.length === 1 ? { p: f[0][0], k: f[0][1] } : null;
}

/** Sum of the digits of n in the given base (default 10). */
export function digitSum(n: number | bigint, base = 10): number {
  if (!Number.isInteger(base) || base < 2) throw new RangeError('base must be an integer >= 2');
  let m = typeof n === 'bigint' ? n : BigInt(n);
  if (m < 0n) throw new RangeError('digitSum requires a non-negative integer');
  const b = BigInt(base);
  let total = 0n;
  while (m > 0n) {
    total += m % b;
    m /= b;
  }
  return Number(total);
}

/** Digital root (repeated digit sum until a single digit), base 10. */
export function digitalRoot(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError('digitalRoot requires a non-negative integer');
  if (n === 0) return 0;
  return 1 + ((n - 1) % 9);
}

/** Number of steps for the Collatz (3n+1) sequence to reach 1. */
export function collatzSteps(n: number): number {
  assertPositiveInt(n, 'n');
  let m = n;
  let steps = 0;
  while (m !== 1) {
    m = m % 2 === 0 ? m / 2 : 3 * m + 1;
    steps++;
  }
  return steps;
}

/** Primorial n# = product of all primes <= n (n >= 0). Throws RangeError for n above 10000000. */
export function primorial(n: number): bigint {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError('primorial requires a non-negative integer');
  assertLoopOrder('primorial', 'n', n, PRIMORIAL_MAX_N);
  // Sieve the primes, then multiply them in a balanced tree so that the operands stay
  // equal in size.
  const composite = new Uint8Array(n + 1);
  let level: bigint[] = [];
  for (let i = 2; i <= n; i++) {
    if (composite[i] === 0) {
      level.push(BigInt(i));
      for (let j = i * i; j <= n; j += i) composite[j] = 1;
    }
  }
  if (level.length === 0) return 1n;
  while (level.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i + 1 < level.length; i += 2) next.push(level[i] * level[i + 1]);
    if (level.length % 2 === 1) next.push(level[level.length - 1]);
    level = next;
  }
  return level[0];
}
