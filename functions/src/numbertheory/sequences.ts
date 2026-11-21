/**
 * Integer sequences and enumerators: Motzkin, Narayana, Schroder, Delannoy,
 * Pell, tribonacci, Eulerian and Lah numbers, partition and composition
 * generators, Gray code, and binomial coefficients mod a prime (Lucas).
 */

import { assertLoopOrder } from '../utils/limits.js';
import { binomialBigInt } from '../probability/bigint-binomial.js';

/**
 * Largest index whose value is a finite double. The next index rounds to Infinity
 * (checked against exact integer arithmetic), so a larger index returns Infinity.
 */
const MOTZKIN_MAX_FINITE = 654;
const SCHRODER_MAX_FINITE = 407;
const PELL_MAX_FINITE = 806;
const TRIBONACCI_MAX_FINITE = 1167;
/** D(m, n) is not below D(405, 405), which is Infinity, once min(m, n) is 405 or more. */
const DELANNOY_FIRST_INFINITE = 405;
/** N(521, 261) is finite and N(523, 262) is Infinity; N(n, j) grows with n. */
const NARAYANA_FIRST_INFINITE = 262;
/** A(1023, 1) is finite and A(1024, 1) is Infinity. */
const EULERIAN_FIRST_INFINITE_N = 1024;
/** 171! is above the largest double. */
const LAH_MAX_FINITE_SPAN = 170;
/** Largest n for integerPartitionsGen (p(70) = 4087968 lists). */
const PARTITIONS_GEN_MAX = 70;

function assertNonNegInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(`${name} must be a non-negative integer`);
}

/** Exact binomial coefficient C(n, k) as a bigint (0 outside 0 <= k <= n). */
function binomialBig(n: number, k: number): bigint {
  return binomialBigInt(BigInt(n), BigInt(k));
}

/** Motzkin number M(n): number of Motzkin paths of length n. Infinity for n > 654. */
export function motzkin(n: number): number {
  assertNonNegInt(n, 'n');
  if (n < 2) return 1;
  if (n > MOTZKIN_MAX_FINITE) return Infinity;
  let m0 = 1n;
  let m1 = 1n;
  for (let k = 2; k <= n; k++) {
    const next = ((2n * BigInt(k) + 1n) * m1 + (3n * BigInt(k) - 3n) * m0) / BigInt(k + 2);
    m0 = m1;
    m1 = next;
  }
  return Number(m1);
}

/**
 * Narayana number N(n, k) = (1/n) C(n,k) C(n,k-1); 0 outside 1 <= k <= n. Infinity when
 * min(k, n + 1 - k) >= 262.
 */
export function narayana(n: number, k: number): number {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  if (k < 1 || k > n) return 0;
  // N(n, k) = N(n, n + 1 - k), and N(n, j) grows with n, so N(n, j) >= N(2j - 1, j).
  if (Math.min(k, n + 1 - k) >= NARAYANA_FIRST_INFINITE) return Infinity;
  return Number((binomialBig(n, k) * binomialBig(n, k - 1)) / BigInt(n));
}

/** Large Schroder number S(n) (1, 2, 6, 22, 90, ...). Infinity for n > 407. */
export function schroder(n: number): number {
  assertNonNegInt(n, 'n');
  if (n === 0) return 1;
  if (n === 1) return 2;
  if (n > SCHRODER_MAX_FINITE) return Infinity;
  let s0 = 1n;
  let s1 = 2n;
  for (let k = 2; k <= n; k++) {
    const kb = BigInt(k);
    const next = (3n * BigInt(2 * k - 1) * s1 - BigInt(k - 2) * s0) / (kb + 1n);
    s0 = s1;
    s1 = next;
  }
  return Number(s1);
}

/** Delannoy number D(m, n) = sum_k C(m,k) C(n,k) 2^k. Infinity when min(m, n) >= 405. */
export function delannoy(m: number, n: number): number {
  assertNonNegInt(m, 'm');
  assertNonNegInt(n, 'n');
  if (Math.min(m, n) >= DELANNOY_FIRST_INFINITE) return Infinity;
  let total = 0n;
  for (let k = 0; k <= Math.min(m, n); k++) {
    total += binomialBig(m, k) * binomialBig(n, k) * (1n << BigInt(k));
  }
  return Number(total);
}

/** Pell number P(n): P0 = 0, P1 = 1, P(n) = 2 P(n-1) + P(n-2). Infinity for n > 806. */
export function pell(n: number): number {
  assertNonNegInt(n, 'n');
  if (n > PELL_MAX_FINITE) return Infinity;
  let a = 0n;
  let b = 1n;
  for (let k = 0; k < n; k++) {
    [a, b] = [b, 2n * b + a];
  }
  return Number(a);
}

/** Tribonacci number T(n) with T(0) = 0, T(1) = 0, T(2) = 1. Infinity for n > 1167. */
export function tribonacci(n: number): number {
  assertNonNegInt(n, 'n');
  if (n > TRIBONACCI_MAX_FINITE) return Infinity;
  let a = 0n;
  let b = 0n;
  let c = 1n;
  for (let k = 0; k < n; k++) {
    [a, b, c] = [b, c, a + b + c];
  }
  return Number(a);
}

/**
 * Eulerian number A(n, k): permutations of n with k ascents. Defined for
 * 0 <= k <= n - 1 (and A(0, 0) = 1); 0 otherwise. Infinity for n >= 1024 and
 * 1 <= k <= n - 2.
 */
export function eulerianNumber(n: number, kIn: number): number {
  assertNonNegInt(n, 'n');
  if (n === 0 && kIn === 0) return 1;
  if (kIn < 0 || kIn >= n) return 0;
  // A(n, k) = A(n, n - 1 - k). A(n, 0) = 1, and A(n, k) >= A(n, 1) = 2^n - n - 1 for
  // 1 <= k <= n - 2.
  const k = Math.min(kIn, n - 1 - kIn);
  if (k >= 1 && n >= EULERIAN_FIRST_INFINITE_N) return Infinity;
  let total = 0n;
  for (let j = 0; j <= k; j++) {
    const term = binomialBig(n + 1, j) * BigInt(k + 1 - j) ** BigInt(n);
    total += j % 2 === 0 ? term : -term;
  }
  return Number(total);
}

/** Lah number L(n, k) = C(n-1, k-1) n! / k!; 0 unless 1 <= k <= n. Infinity when n - k > 170. */
export function lahNumber(n: number, k: number): number {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  if (k < 1 || k > n) return 0;
  // n!/k! has n - k factors, so it is at least (n - k)!, and 171! is above the largest double.
  if (n - k > LAH_MAX_FINITE_SPAN) return Infinity;
  // n!/k! = product of (k+1)..n
  let prod = 1n;
  for (let i = k + 1; i <= n; i++) prod *= BigInt(i);
  return Number(binomialBig(n - 1, k - 1) * prod);
}

/**
 * All integer partitions of n, in descending lexicographic order.
 *
 * @throws RangeError if `n` is above 70
 */
export function integerPartitionsGen(n: number): number[][] {
  assertNonNegInt(n, 'n');
  assertLoopOrder('integerPartitionsGen', 'n', n, PARTITIONS_GEN_MAX);
  const out: number[][] = [];
  const cur: number[] = [];
  const walk = (rem: number, maxPart: number): void => {
    if (rem === 0) {
      out.push([...cur]);
      return;
    }
    for (let p = Math.min(rem, maxPart); p >= 1; p--) {
      cur.push(p);
      walk(rem - p, p);
      cur.pop();
    }
  };
  walk(n, n);
  return out;
}

/** All compositions (ordered partitions) of n. There are 2^(n-1) for n >= 1. */
export function compositionsGen(n: number): number[][] {
  assertNonNegInt(n, 'n');
  if (n === 0) return [[]];
  const out: number[][] = [];
  const cur: number[] = [];
  const walk = (rem: number): void => {
    if (rem === 0) {
      out.push([...cur]);
      return;
    }
    for (let p = 1; p <= rem; p++) {
      cur.push(p);
      walk(rem - p);
      cur.pop();
    }
  };
  walk(n);
  return out;
}

/** Binary reflected Gray code over `bits` bits: 2^bits codewords. */
export function grayCode(bits: number): number[] {
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > 30) {
    throw new RangeError('bits must be an integer in [0, 30]');
  }
  const count = 1 << bits;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(i ^ (i >> 1));
  return out;
}

/**
 * Binomial coefficient C(n, k) modulo a prime p, by Lucas' theorem.
 * `p` must be prime.
 */
export function binomialMod(n: bigint, k: bigint, p: bigint): bigint {
  if (p < 2n || p > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('p must be a prime');
  for (let d = 2n; d * d <= p; d++) {
    if (p % d === 0n) throw new RangeError('p must be a prime');
  }
  if (n < 0n || k < 0n || k > n) return 0n;
  let result = 1n;
  let a = n;
  let b = k;
  while (a > 0n || b > 0n) {
    const ai = a % p;
    const bi = b % p;
    if (bi > ai) return 0n;
    result = (result * (binomialBig(Number(ai), Number(bi)) % p)) % p;
    a /= p;
    b /= p;
  }
  return result;
}
